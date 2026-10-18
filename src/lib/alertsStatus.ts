import { LocalNotifications } from '@capacitor/local-notifications'
import { todayLocalDate } from './dates'
import { track, type EventProps } from './track'

const LAST_KEY = 'resuming-alerts-status-sent'

export type NotificationPermission = 'granted' | 'denied' | 'prompt'
export type ExactAlarms = 'granted' | 'denied' | 'unknown'

/** Android answers "prompt", "prompt-with-rationale", "granted" or "denied". */
export function notificationPermission(display: string | null | undefined): NotificationPermission {
  if (display === 'granted') return 'granted'
  if (display === 'denied') return 'denied'
  return 'prompt'
}

export function exactAlarmState(value: string | null | undefined): ExactAlarms {
  if (value === 'granted') return 'granted'
  if (value == null) return 'unknown'
  return 'denied'
}

/** What the admin sees: whether alerts can ring on this phone, and how many are waiting to. */
export function alertsStatusProps(
  notifications: NotificationPermission,
  exact: ExactAlarms,
  planned: number,
): EventProps {
  return { notifications, exact_alarms: exact, planned: Math.max(0, Math.min(Math.trunc(planned), 64)) }
}

/** Once a day, or sooner when the answer changed, so a person who sits on one state sends one event a day. */
export function shouldReportAlertsStatus(last: string | null, today: string, state: string): boolean {
  return last !== `${today}|${state}`
}

/**
 * Report whether the alerts this phone has planned are able to ring: the notification permission
 * and the Android "Alarms & reminders" setting. Counts only; nothing about the reminders themselves.
 * Does nothing when nothing is planned, since the permission does not matter then.
 */
export async function reportAlertsStatus(display: string | null | undefined, planned: number): Promise<void> {
  if (planned <= 0) return
  try {
    const notifications = notificationPermission(display)
    let exact: ExactAlarms = 'unknown'
    try {
      exact = exactAlarmState((await LocalNotifications.checkExactNotificationSetting()).exact_alarm)
    } catch {
      exact = 'unknown'
    }
    const state = `${notifications}|${exact}`
    const today = todayLocalDate()
    let last: string | null = null
    try {
      last = localStorage.getItem(LAST_KEY)
    } catch {
      last = null
    }
    if (!shouldReportAlertsStatus(last, today, state)) return
    track('alerts_status', alertsStatusProps(notifications, exact, planned))
    try {
      localStorage.setItem(LAST_KEY, `${today}|${state}`)
    } catch {
      /* worst case it is sent again tomorrow */
    }
  } catch {
    /* reporting must never get in the way of arming the alerts */
  }
}
