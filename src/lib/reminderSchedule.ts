import { addDays, daysBetween, parseLocalDate, todayLocalDate } from './dates'
import { localeTag, type Locale } from './i18n'

export const REMINDER_TEXT_MAX = 120
export const REMINDER_OPEN_MAX = 100
/** Done reminders older than this are not loaded. Today only needs today's. */
export const REMINDER_DONE_KEEP_MS = 36 * 60 * 60 * 1000

export interface Reminder {
  id: string
  text: string
  /** YYYY-MM-DD, local. */
  day: string
  /** Both null means any time that day. */
  hour: number | null
  minute: number | null
  /** An evening alert on the day before. */
  remindBefore: boolean
  kind: ReminderKind
  /** Done makes next year's copy. */
  everyYear: boolean
  doneAt: string | null
  /** Set on the organizer's reminder and on every copy of a shared event. Such a reminder is not edited. */
  sharedEventId?: string | null
  /** The person turned this reminder's alerts off. It still shows on Today. */
  alertOff?: boolean
  /** The shared event's status, learned on load. Missing means active or not known yet. */
  sharedStatus?: SharedReminderStatus
  /** This account made the shared event, so it can share it again. Copies from others are false. */
  sharedByMe?: boolean
}

export type SharedReminderStatus = 'active' | 'cancelled' | 'switched_off'

/** A copy whose event the organizer cancelled or the admin switched off. */
export function isSharedEventGone(reminder: Pick<Reminder, 'sharedStatus'>): boolean {
  return reminder.sharedStatus === 'cancelled' || reminder.sharedStatus === 'switched_off'
}

/** Whether the reminder may still alert. Done, silenced and cancelled reminders do not. */
export function reminderAlerts(reminder: Reminder): boolean {
  return !reminder.doneAt && !reminder.alertOff && !isSharedEventGone(reminder)
}

export interface ReminderInput {
  text: string
  day: string
  hour: number | null
  minute: number | null
  remindBefore?: boolean
  kind?: ReminderKind
  everyYear?: boolean
  sharedEventId?: string | null
  alertOff?: boolean
}

/** Only changes the icon. A reminder with no kind chosen is Other. */
export const REMINDER_KINDS = ['errand', 'bill', 'doctor', 'event', 'other'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]

export function reminderKindOf(value: unknown): ReminderKind {
  return REMINDER_KINDS.includes(value as ReminderKind) ? (value as ReminderKind) : 'other'
}

/** Same date next year. 29 February becomes 28 February. */
export function nextYearDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const last = new Date(year + 1, month, 0).getDate()
  return `${year + 1}-${String(month).padStart(2, '0')}-${String(Math.min(date, last)).padStart(2, '0')}`
}

/** The open copy that appears when an every-year reminder is done. */
export function nextYearCopy(reminder: Reminder): ReminderInput {
  return {
    text: reminder.text,
    day: nextYearDay(reminder.day),
    hour: reminder.hour,
    minute: reminder.minute,
    remindBefore: reminder.remindBefore,
    kind: reminder.kind,
    everyYear: true,
  }
}

/** Whether a reminder is the copy made when this every-year reminder was done. */
export function isNextYearCopyOf(candidate: Reminder, reminder: Reminder): boolean {
  return (
    candidate.id !== reminder.id &&
    candidate.everyYear &&
    !candidate.doneAt &&
    candidate.text === reminder.text &&
    candidate.day === nextYearDay(reminder.day)
  )
}

export type ReminderIssue = 'text' | 'day' | 'full'

export const REMINDER_PARTS = ['morning', 'afternoon', 'evening'] as const
export type ReminderPart = (typeof REMINDER_PARTS)[number]
export type PartTimes = Record<ReminderPart, { hour: number; minute: number }>

export const DEFAULT_PART_TIMES: PartTimes = {
  morning: { hour: 9, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 18, minute: 0 },
}

export const PART_TIMES_STORAGE_KEY = 'resuming-reminder-part-times'
/** Fired when reminders or their alerts change outside React, such as from a notification button. */
export const REMINDERS_CHANGED = 'resuming-reminders-changed'

export function announceRemindersChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMINDERS_CHANGED))
}

export function cleanReminderText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, REMINDER_TEXT_MAX)
}

export function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Values passed in router state as { reminderPrefill }, as Cancel and make a new one does. */
export function reminderPrefillFrom(state: unknown): ReminderInput | undefined {
  const value = (state as { reminderPrefill?: unknown } | null)?.reminderPrefill as Partial<ReminderInput> | undefined
  if (!value || typeof value.text !== 'string' || !isDay(value.day)) return undefined
  const timed = Number.isInteger(value.hour) && Number.isInteger(value.minute)
  return {
    text: value.text,
    day: value.day,
    hour: timed ? value.hour! : null,
    minute: timed ? value.minute! : null,
    remindBefore: value.remindBefore === true,
    kind: reminderKindOf(value.kind),
  }
}

/** Router state { reminderShare: true }: the list's Share opens the reminder at its share section. */
export function reminderShareRequested(state: unknown): boolean {
  return (state as { reminderShare?: unknown } | null)?.reminderShare === true
}

export function validateReminder(input: ReminderInput): ReminderIssue | null {
  if (!cleanReminderText(input.text)) return 'text'
  if (!isDay(input.day)) return 'day'
  return null
}

/** Local day a done time falls on. */
export function doneDay(reminder: Pick<Reminder, 'doneAt'>): string | null {
  if (!reminder.doneAt) return null
  const at = new Date(reminder.doneAt)
  return Number.isNaN(at.getTime()) ? null : todayLocalDate(at)
}

function byDayThenTime(a: Reminder, b: Reminder): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1
  if (a.hour == null && b.hour == null) return 0
  if (a.hour == null) return 1
  if (b.hour == null) return -1
  return a.hour - b.hour || (a.minute ?? 0) - (b.minute ?? 0)
}

/** Open reminders for today, including earlier days that are still open. A cancelled event leaves after its day. */
export function remindersForToday(list: readonly Reminder[], today: string): Reminder[] {
  return list
    .filter((item) => !item.doneAt && item.day <= today && !(item.day < today && isSharedEventGone(item)))
    .sort(byDayThenTime)
}

/** Reminders marked done today, newest first. */
export function remindersDoneToday(list: readonly Reminder[], today: string): Reminder[] {
  return list
    .filter((item) => doneDay(item) === today)
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
}

/** Open reminders after today, by date. */
export function remindersComingUp(list: readonly Reminder[], today: string): Reminder[] {
  return list.filter((item) => !item.doneAt && item.day > today).sort(byDayThenTime)
}

export function openReminderCount(list: readonly Reminder[]): number {
  return list.filter((item) => !item.doneAt).length
}

export function tomorrowOf(today: string): string {
  return addDays(today, 1)
}

function isClock(value: unknown): value is { hour: number; minute: number } {
  if (!value || typeof value !== 'object') return false
  const { hour, minute } = value as { hour: unknown; minute: unknown }
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    (hour as number) >= 0 &&
    (hour as number) <= 23 &&
    (minute as number) >= 0 &&
    (minute as number) <= 59
  )
}

/** Morning, afternoon, and evening times on this device. */
export function readPartTimes(): PartTimes {
  try {
    const raw = localStorage.getItem(PART_TIMES_STORAGE_KEY)
    if (!raw) return DEFAULT_PART_TIMES
    const parsed = JSON.parse(raw) as Partial<Record<ReminderPart, unknown>>
    const next = { ...DEFAULT_PART_TIMES }
    for (const part of REMINDER_PARTS) {
      const value = parsed[part]
      if (isClock(value)) next[part] = { hour: value.hour, minute: value.minute }
    }
    return next
  } catch {
    return DEFAULT_PART_TIMES
  }
}

export function savePartTimes(times: PartTimes): void {
  try {
    localStorage.setItem(PART_TIMES_STORAGE_KEY, JSON.stringify(times))
  } catch {
    /* ignore */
  }
  announceRemindersChanged()
}

/** Which time chip a saved reminder belongs to. */
export function partOfTime(
  hour: number | null,
  minute: number | null,
  parts: PartTimes,
): ReminderPart | 'any' | 'pick' {
  if (hour == null || minute == null) return 'any'
  const match = REMINDER_PARTS.find((part) => parts[part].hour === hour && parts[part].minute === minute)
  return match ?? 'pick'
}

export function formatReminderTime(hour: number, minute: number, locale: Locale): string {
  const date = new Date(2024, 0, 7, hour, minute)
  return date.toLocaleTimeString(localeTag(locale), { hour: 'numeric', minute: '2-digit' })
}

/** "9 am" on the hour, "9:30 am" otherwise. */
export function formatShortReminderTime(hour: number, minute: number, locale: Locale): string {
  const date = new Date(2024, 0, 7, hour, minute)
  return date.toLocaleTimeString(
    localeTag(locale),
    minute === 0 ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' },
  )
}

/** Weekday name within the past or coming week, otherwise a short date. */
export function formatReminderDay(day: string, today: string, locale: Locale): string {
  const date = parseLocalDate(day)
  const gap = Math.abs(daysBetween(today, day))
  if (gap <= 6) return date.toLocaleDateString(localeTag(locale), { weekday: 'long' })
  return date.toLocaleDateString(localeTag(locale), { weekday: 'short', day: 'numeric', month: 'short' })
}
