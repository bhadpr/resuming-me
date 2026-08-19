import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import {
  buildDigestNotifications,
  digestNotificationIds,
  loadDailyDigestPrefs,
  saveDailyDigestPrefs,
  type DigestItem,
  type DigestNotification,
} from './dailyDigest'
import { REENTRY_NOTIFICATION_ID, buildReentryNotification } from './reentry'
import type { Activity } from './activities'
import type { LogEntry } from './logs'

const CHANNEL_ID = 'daily-digest'
const TEST_NOTIFICATION_ID = 7199

function nativePluginAvailable(): boolean {
  return (
    Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')
  )
}

/** Turn the daily reminder on from Get started. No-ops permission on web. */
export async function enableDailyDigestFromOnboarding(
  hour: number,
  minute: number,
): Promise<void> {
  saveDailyDigestPrefs({ enabled: true, hour, minute })
  if (!nativePluginAvailable()) return

  const granted = await requestDailyDigestPermission()
  if (!granted) {
    saveDailyDigestPrefs({ enabled: false, hour, minute })
    throw new Error(
      'Notifications are off for Resuming. You can turn them on in system settings.',
    )
  }
  await requestExactAlarms()
}

export async function requestDailyDigestPermission(): Promise<boolean> {
  if (!nativePluginAvailable()) return false
  const existing = await LocalNotifications.checkPermissions()
  if (existing.display === 'granted') return true
  const next = await LocalNotifications.requestPermissions()
  return next.display === 'granted'
}

export async function hasExactAlarms(): Promise<boolean> {
  if (!nativePluginAvailable()) return true
  try {
    const status = await LocalNotifications.checkExactNotificationSetting()
    return status.exact_alarm === 'granted'
  } catch {
    return true
  }
}

/** Opens Android Alarms & reminders if exact alarms are off. */
export async function requestExactAlarms(): Promise<boolean> {
  if (await hasExactAlarms()) return true
  try {
    const status = await LocalNotifications.changeExactNotificationSetting()
    return status.exact_alarm === 'granted'
  } catch {
    return false
  }
}

async function ensureDigestChannel(): Promise<void> {
  try {
    const { channels } = await LocalNotifications.listChannels()
    if (channels.some((channel) => channel.id === CHANNEL_ID)) return
  } catch {
    /* create below */
  }
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Daily reminder',
      description: 'Once a day if something is still open. Silent if you are done.',
      importance: 3,
      vibration: false,
      lights: false,
    })
  } catch {
    /* already exists */
  }
}

async function cancelDigestNotifications(): Promise<void> {
  await LocalNotifications.cancel({
    notifications: [
      ...digestNotificationIds().map((id) => ({ id })),
      { id: REENTRY_NOTIFICATION_ID },
    ],
  })
}

export interface QuietScheduleInput {
  activities: Array<Pick<Activity, 'id' | 'archived' | 'created_at'>>
  entries: Array<Pick<LogEntry, 'activity_id' | 'type' | 'date' | 'duration_seconds'>>
  today: string
}

export async function syncDailyDigestSchedule(
  rows: DigestItem[],
  quiet?: QuietScheduleInput | null,
): Promise<void> {
  if (!nativePluginAvailable()) return

  await cancelDigestNotifications()

  const prefs = loadDailyDigestPrefs()
  const now = new Date()
  const notifications: DigestNotification[] = [
    ...buildDigestNotifications(rows, prefs, now),
  ]
  const reentry = quiet
    ? buildReentryNotification({ ...quiet, prefs, now })
    : null
  if (reentry) notifications.push(reentry)
  if (notifications.length === 0) return

  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return

  await ensureDigestChannel()
  await LocalNotifications.schedule({
    notifications: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: { at: item.at, allowWhileIdle: true },
      extra: { dest: 'today' },
      channelId: CHANNEL_ID,
      autoCancel: true,
    })),
  })
}

export async function scheduleTestDigest(): Promise<Date> {
  if (!nativePluginAvailable()) {
    throw new Error('Reminders are only available in the Android app.')
  }
  const granted = await requestDailyDigestPermission()
  if (!granted) {
    throw new Error('Notifications are off for Resuming. Turn them on in system settings.')
  }
  await ensureDigestChannel()
  const at = new Date(Date.now() + 5000)
  await LocalNotifications.schedule({
    notifications: [
      {
        id: TEST_NOTIFICATION_ID,
        title: 'Resuming',
        body: 'Just checking in. Tap to open Today.',
        schedule: { at, allowWhileIdle: true },
        extra: { dest: 'today' },
        channelId: CHANNEL_ID,
        autoCancel: true,
      },
    ],
  })
  return at
}

export async function listenForDigestNotificationTap(
  onOpenToday: () => void,
): Promise<() => void> {
  if (!nativePluginAvailable()) return () => {}

  const handle = await LocalNotifications.addListener(
    'localNotificationActionPerformed',
    (event) => {
      if (event.notification.extra?.dest === 'today') onOpenToday()
    },
  )

  return () => {
    void handle.remove()
  }
}
