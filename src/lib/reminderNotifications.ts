import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
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
import { createSupabaseClient } from './supabase'
import { track } from './track'

const CHANNEL_ID = 'reminder'
const ACTION_TYPE = 'reminder-due'
const ACTION_DONE = 'reminder-done'
const ACTION_TOMORROW = 'reminder-tomorrow'
const ACTION_LATER = 'reminder-later'

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
      dayBefore: (reminder) =>
        reminder.hour != null && reminder.minute != null
          ? translate(locale, 'reminders.alertTomorrowAt', {
              time: formatReminderTime(reminder.hour, reminder.minute, locale),
            })
          : translate(locale, 'reminders.alertTomorrow'),
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
    types: [
      {
        id: ACTION_TYPE,
        actions: [
          { id: ACTION_DONE, title: labels.done },
          { id: ACTION_TOMORROW, title: labels.tomorrow },
          { id: ACTION_LATER, title: labels.later },
        ],
      },
    ],
  })
  await LocalNotifications.cancel({ notifications: reminderNotificationIds().map((id) => ({ id })) })
  const alerts = planReminderAlerts(reminders, activeReminderSnoozes(now), now, readPartTimes().evening, copy)
  if (alerts.length === 0) return
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return
  await ensureReminderChannel()
  await LocalNotifications.schedule({
    notifications: alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      body: alert.body,
      schedule: { at: alert.at, allowWhileIdle: true },
      extra: { dest: 'today', kind: 'reminder', reminderId: alert.reminderId, alert: alert.kind },
      channelId: CHANNEL_ID,
      actionTypeId: alert.kind === 'before' ? undefined : ACTION_TYPE,
      autoCancel: true,
    })),
  })
}

/** Asks for notification permission once a saved reminder would alert. Android only. */
export async function askForReminderAlerts(input: ReminderInput): Promise<void> {
  if (!nativePluginAvailable()) return
  if (input.hour == null && !input.remindBefore) return
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
