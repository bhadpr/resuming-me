import { addDays, parseLocalDate, todayLocalDate } from './dates'
import { effectiveReminder, isRepeating, upcomingOccurrences } from './reminderRepeat'
import {
  announceRemindersChanged,
  remindLeadFor,
  reminderAlerts,
  remindersForToday,
  type Reminder,
} from './reminderSchedule'

export const REMINDER_NOTIFICATION_ID_BASE = 9000
/** Only the soonest alerts are armed. The rest are armed on a later app open. */
export const REMINDER_NOTIFICATION_SLOTS = 64
export const REMINDER_SNOOZE_MS = 60 * 60 * 1000

const SNOOZE_STORAGE_KEY = 'resuming-reminder-snoozes'

export type ReminderAlertKind = 'time' | 'lead' | 'before' | 'week' | 'snooze'

export interface ReminderAlert {
  id: number
  reminderId: string
  kind: ReminderAlertKind
  at: Date
  title: string
  body: string
}

export interface ReminderSnooze {
  reminderId: string
  until: Date
}

export interface ReminderAlertCopy {
  /** Body of the alert at the reminder's time, and after In 1 hour. */
  now: string
  /** Body of the alert a few minutes before the clock time. */
  lead: (minutes: number) => string
  /** Body of the evening alert, given the reminder. */
  dayBefore: (reminder: Reminder) => string
  /** Body of the alert a week ahead, given the reminder. */
  weekBefore: (reminder: Reminder) => string
}

function atClock(day: string, hour: number, minute: number): Date {
  const at = parseLocalDate(day)
  at.setHours(hour, minute, 0, 0)
  return at
}

function pushLead(
  alerts: Array<Omit<ReminderAlert, 'id'>>,
  reminder: Reminder,
  day: string,
  now: Date,
  copy: ReminderAlertCopy,
): void {
  const lead = remindLeadFor(reminder)
  if (reminder.hour == null || reminder.minute == null || !lead) return
  const at = new Date(atClock(day, reminder.hour, reminder.minute).getTime() - lead * 60_000)
  if (at <= now) return
  alerts.push({ reminderId: reminder.id, kind: 'lead', at, title: reminder.text, body: copy.lead(lead) })
}

/** Every alert that should be armed now, soonest first, with notification ids. */
export function planReminderAlerts(
  reminders: readonly Reminder[],
  snoozes: readonly ReminderSnooze[],
  now: Date,
  evening: { hour: number; minute: number },
  copy: ReminderAlertCopy,
): ReminderAlert[] {
  const today = todayLocalDate(now)
  const open = reminders.map((item) => effectiveReminder(item, today)).filter(reminderAlerts)
  const byId = new Map(open.map((item) => [item.id, item]))
  const alerts: Array<Omit<ReminderAlert, 'id'>> = []

  for (const reminder of open) {
    if (isRepeating(reminder)) {
      // A repeat rings at its time on each of its next few days, and has no evening-before alert.
      if (reminder.hour != null && reminder.minute != null) {
        for (const day of upcomingOccurrences(reminder)) {
          pushLead(alerts, reminder, day, now, copy)
          const at = atClock(day, reminder.hour, reminder.minute)
          if (at > now) {
            alerts.push({ reminderId: reminder.id, kind: 'time', at, title: reminder.text, body: copy.now })
          }
        }
      }
      continue
    }
    if (reminder.hour != null && reminder.minute != null) {
      pushLead(alerts, reminder, reminder.day, now, copy)
      const at = atClock(reminder.day, reminder.hour, reminder.minute)
      if (at > now) {
        alerts.push({ reminderId: reminder.id, kind: 'time', at, title: reminder.text, body: copy.now })
      }
    }
    if (reminder.remindWeekBefore) {
      const at = atClock(addDays(reminder.day, -7), evening.hour, evening.minute)
      if (at > now) {
        alerts.push({
          reminderId: reminder.id,
          kind: 'week',
          at,
          title: reminder.text,
          body: copy.weekBefore(reminder),
        })
      }
    }
    if (reminder.remindBefore) {
      const at = atClock(addDays(reminder.day, -1), evening.hour, evening.minute)
      if (at > now) {
        alerts.push({
          reminderId: reminder.id,
          kind: 'before',
          at,
          title: reminder.text,
          body: copy.dayBefore(reminder),
        })
      }
    }
  }

  for (const snooze of snoozes) {
    const reminder = byId.get(snooze.reminderId)
    if (!reminder || snooze.until <= now) continue
    alerts.push({ reminderId: reminder.id, kind: 'snooze', at: snooze.until, title: reminder.text, body: copy.now })
  }

  return alerts
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, REMINDER_NOTIFICATION_SLOTS)
    .map((alert, index) => ({ ...alert, id: REMINDER_NOTIFICATION_ID_BASE + index }))
}

export function reminderNotificationIds(): number[] {
  return Array.from({ length: REMINDER_NOTIFICATION_SLOTS }, (_, index) => REMINDER_NOTIFICATION_ID_BASE + index)
}

/** Names for the daily notification: open reminders on Today that have no time of their own. */
export function untimedReminderNames(reminders: readonly Reminder[], today: string): string[] {
  return remindersForToday(reminders, today)
    .filter((item) => item.hour == null && reminderAlerts(item))
    .map((item) => item.text)
}

function storage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

function readSnoozes(): Array<{ reminderId: string; until: string }> {
  const store = storage()
  if (!store) return []
  try {
    const parsed = JSON.parse(store.getItem(SNOOZE_STORAGE_KEY) ?? '[]') as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item): item is { reminderId: string; until: string } =>
        !!item &&
        typeof item.reminderId === 'string' &&
        typeof item.until === 'string' &&
        Number.isFinite(Date.parse(item.until)),
    )
  } catch {
    return []
  }
}

function writeSnoozes(list: Array<{ reminderId: string; until: string }>): void {
  storage()?.setItem(SNOOZE_STORAGE_KEY, JSON.stringify(list))
  announceRemindersChanged()
}

export function activeReminderSnoozes(now = new Date()): ReminderSnooze[] {
  return readSnoozes()
    .map((item) => ({ reminderId: item.reminderId, until: new Date(item.until) }))
    .filter((item) => item.until > now)
}

/** In 1 hour from a notification. Returns when it will come back. */
export function snoozeReminder(reminderId: string, now = new Date()): Date {
  const until = new Date(now.getTime() + REMINDER_SNOOZE_MS)
  const kept = readSnoozes().filter((item) => item.reminderId !== reminderId && Date.parse(item.until) > now.getTime())
  writeSnoozes([...kept, { reminderId, until: until.toISOString() }])
  return until
}

export function clearReminderSnooze(reminderId: string): void {
  const current = readSnoozes()
  const kept = current.filter((item) => item.reminderId !== reminderId)
  if (kept.length !== current.length) writeSnoozes(kept)
}
