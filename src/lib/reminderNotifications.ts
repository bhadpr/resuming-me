import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { noteReminderAlerts } from './alertBudget'
import { reportAlertsStatus } from './alertsStatus'
import { digestNotificationIds } from './dailyDigest'
import { REENTRY_NOTIFICATION_ID } from './reentry'
import { todayLocalDate } from './dates'
import { completeGuestReminder, loadGuestDraft, updateGuestReminder } from './guestDraft'
import { translate, type Locale } from './i18n'
import { requestDailyDigestPermission } from './localNotifications'
import {
  activeReminderSnoozes,
  clearReminderSnooze,
  planReminderAlerts,
  reminderNotificationIds,
  snoozeReminder,
  type ReminderAlertCopy,
} from './reminderAlerts'
import { completeReminder, getReminder, moveReminder } from './reminders'
import {
  announceRemindersChanged,
  formatReminderTime,
  readPartTimes,
  tomorrowOf,
  type Reminder,
  type ReminderInput,
} from './reminderSchedule'
import { watchSharedEventAlerts } from './sharedEventCheck'
import { createSupabaseClient } from './supabase'
import { track } from './track'

const CHANNEL_ID = 'reminder'
const ACTION_TYPE = 'reminder-due'
/** A repeating reminder has Done and In 1 hour, but no Tomorrow: its next day is already set. */
const REPEAT_ACTION_TYPE = 'reminder-repeat-due'
const ACTION_DONE = 'reminder-done'
const ACTION_TOMORROW = 'reminder-tomorrow'
const ACTION_LATER = 'reminder-later'

/** Done, Tomorrow, and Later. On iPhone those buttons open the app, so they still work after it was closed. */
export function reminderNotificationActionTypes(labels: ReminderActionLabels, foreground: boolean) {
  const done = { id: ACTION_DONE, title: labels.done, foreground }
  const tomorrow = { id: ACTION_TOMORROW, title: labels.tomorrow, foreground }
  const later = { id: ACTION_LATER, title: labels.later, foreground }
  return [
    { id: ACTION_TYPE, actions: [done, tomorrow, later] },
    { id: REPEAT_ACTION_TYPE, actions: [done, later] },
  ]
}

export type ReminderActionLabels = {
  done: string
  tomorrow: string
  later: string
}

/** Alert bodies and button labels in the app's language. */
export function reminderAlertText(locale: Locale): { copy: ReminderAlertCopy; labels: ReminderActionLabels } {
  return {
    copy: {
      now: translate(locale, 'reminders.alertNow'),
      lead: (minutes) => translate(locale, 'reminders.alertLead', { count: minutes }),
      dayBefore: (reminder) =>
        reminder.hour != null && reminder.minute != null
          ? translate(locale, 'reminders.alertTomorrowAt', {
              time: formatReminderTime(reminder.hour, reminder.minute, locale),
            })
          : translate(locale, 'reminders.alertTomorrow'),
      weekBefore: (reminder) =>
        reminder.hour != null && reminder.minute != null
          ? translate(locale, 'reminders.alertWeekAt', {
              time: formatReminderTime(reminder.hour, reminder.minute, locale),
            })
          : translate(locale, 'reminders.alertWeek'),
    },
    labels: {
      done: translate(locale, 'reminders.done'),
      tomorrow: translate(locale, 'reminders.tomorrow'),
      later: translate(locale, 'reminders.later'),
    },
  }
}

function nativePluginAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')
}

async function ensureReminderChannel(): Promise<void> {
  try {
    const { channels } = await LocalNotifications.listChannels()
    if (channels.some((channel) => channel.id === CHANNEL_ID)) return
  } catch {
    /* create below */
  }
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Reminders',
      description: 'An alert at the time you set for a reminder.',
      importance: 4,
      vibration: true,
    })
  } catch {
    /* already exists */
  }
}

/** Arms alerts for reminders with a time or a day-before alert. Reminders with no time ride in the daily notification. */
export async function syncReminderNotifications(
  reminders: readonly Reminder[],
  copy: ReminderAlertCopy,
  labels: ReminderActionLabels,
  now = new Date(),
): Promise<void> {
  if (!nativePluginAvailable()) return
  await LocalNotifications.registerActionTypes({
    types: reminderNotificationActionTypes(labels, Capacitor.getPlatform() === 'ios'),
  })
  await LocalNotifications.cancel({ notifications: reminderNotificationIds().map((id) => ({ id })) })
  const planned = planReminderAlerts(reminders, activeReminderSnoozes(now), now, readPartTimes().evening, copy)
  const fit = Capacitor.getPlatform() === 'ios' ? noteReminderAlerts(planned) : null
  const alerts = fit ? fit.reminders : planned
  if (fit) {
    const keep = new Set([...fit.digests.map((item) => item.id), ...(fit.reentry ? [fit.reentry.id] : [])])
    const drop = [...digestNotificationIds(), REENTRY_NOTIFICATION_ID].filter((id) => !keep.has(id))
    if (drop.length > 0) {
      await LocalNotifications.cancel({ notifications: drop.map((id) => ({ id })) })
    }
  }
  const permission = alerts.length > 0 ? await LocalNotifications.checkPermissions() : null
  void reportAlertsStatus(permission?.display, alerts.length)
  if (alerts.length === 0 || permission?.display !== 'granted') {
    await watchSharedEventAlerts(false)
    return
  }
  const sharedEventIds = new Map(reminders.map((item) => [item.id, item.sharedEventId ?? null]))
  const repeating = new Set(
    reminders.filter((item) => item.repeat || item.sharedListItemId || item.sharedListId).map((item) => item.id),
  )
  await ensureReminderChannel()
  await LocalNotifications.schedule({
    notifications: alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      body: alert.body,
      schedule: { at: alert.at, allowWhileIdle: true },
      extra: {
        dest: 'today',
        kind: 'reminder',
        reminderId: alert.reminderId,
        alert: alert.kind,
        sharedEventId: sharedEventIds.get(alert.reminderId) ?? null,
      },
      channelId: CHANNEL_ID,
      actionTypeId:
        alert.kind === 'before' || alert.kind === 'week' ? undefined : repeating.has(alert.reminderId) ? REPEAT_ACTION_TYPE : ACTION_TYPE,
      autoCancel: true,
    })),
  })
  await watchSharedEventAlerts(alerts.some((alert) => sharedEventIds.get(alert.reminderId)))
}

/** Asks for notification permission once a saved reminder would alert. Android only. */
export async function askForReminderAlerts(input: ReminderInput): Promise<void> {
  if (!nativePluginAvailable()) return
  if (input.hour == null && !input.remindBefore && !input.remindWeekBefore) return
  try {
    await requestDailyDigestPermission()
  } catch {
    /* they can turn it on in system settings */
  }
  announceRemindersChanged()
}

async function signedInUserId(): Promise<string | null> {
  const { data } = await createSupabaseClient().auth.getUser()
  return data.user?.id ?? null
}

async function markDoneFromNotification(reminderId: string): Promise<void> {
  const doneAt = new Date().toISOString()
  if (reminderId.startsWith('guest-')) {
    const draft = loadGuestDraft()
    if (draft) completeGuestReminder(draft, reminderId, doneAt)
    track('reminder_done', { signed_in: false, from: 'notification' })
    return
  }
  const userId = await signedInUserId()
  if (!userId) return
  const reminder = await getReminder(reminderId)
  if (!reminder || reminder.doneAt) return
  await completeReminder(userId, reminder, doneAt)
  track('reminder_done', { signed_in: true, from: 'notification', every_year: reminder.everyYear })
}

async function moveToTomorrowFromNotification(reminderId: string): Promise<void> {
  const day = tomorrowOf(todayLocalDate())
  if (reminderId.startsWith('guest-')) {
    const draft = loadGuestDraft()
    if (draft) updateGuestReminder(draft, reminderId, { day })
    return
  }
  if (!(await signedInUserId())) return
  await moveReminder(reminderId, day)
}

async function handleReminderAction(actionId: string, reminderId: string): Promise<void> {
  if (actionId === ACTION_LATER) {
    snoozeReminder(reminderId)
    return
  }
  clearReminderSnooze(reminderId)
  if (actionId === ACTION_DONE) await markDoneFromNotification(reminderId)
  if (actionId === ACTION_TOMORROW) await moveToTomorrowFromNotification(reminderId)
  announceRemindersChanged()
}

/** Done, Tomorrow, and In 1 hour on a reminder alert. */
export async function listenForReminderNotificationActions(): Promise<() => void> {
  if (!nativePluginAvailable()) return () => {}
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const extra = event.notification.extra as { kind?: string; reminderId?: unknown } | undefined
    if (extra?.kind !== 'reminder' || typeof extra.reminderId !== 'string') return
    if (event.actionId !== ACTION_DONE && event.actionId !== ACTION_TOMORROW && event.actionId !== ACTION_LATER) {
      return
    }
    void handleReminderAction(event.actionId, extra.reminderId).catch(() => {})
  })
  return () => {
    void handle.remove()
  }
}
