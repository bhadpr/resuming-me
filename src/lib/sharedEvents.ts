import { parseLocalDate } from './dates'
import { localeTag, translate, type Locale } from './i18n'
import { PLAY_PACKAGE } from './marketing'
import {
  cleanReminderText,
  formatReminderTime,
  reminderKindOf,
  type Reminder,
  type ReminderInput,
  type ReminderKind,
  type SharedReminderStatus,
} from './reminderSchedule'
import { linkReminderToSharedEvent } from './reminders'
import { createSupabaseClient } from './supabase'
import { getOrCreateAnonId } from './track'

export const SHARED_FROM_MAX = 60
export const SHARED_EVENT_ORIGIN = 'https://resuming.me'

export type SharedEventStatus = SharedReminderStatus

export interface SharedEvent {
  id: string
  code: string
  /** Null when the admin switched the event off. */
  text: string | null
  from: string | null
  /** YYYY-MM-DD in the organizer's time zone. */
  day: string
  hour: number | null
  minute: number | null
  timeZone: string
  kind: ReminderKind
  status: SharedEventStatus
  takingAdds: boolean
}

/** Why sharing or adding did not work. */
export type SharedEventIssue = 'links' | 'dailyCap' | 'pastDay' | 'closed' | 'ended' | 'unavailable' | 'failed'

export class SharedEventError extends Error {
  constructor(readonly issue: SharedEventIssue) {
    super(`shared_event_${issue}`)
    this.name = 'SharedEventError'
  }
}

/** Same pattern as public.has_web_link, so the app refuses before the server does. */
const WEB_LINK =
  /(https?:|www\.|[a-z0-9-]+\.(?:com|in|net|org|me|io|co|info|xyz|app|link|ly|gl|to|site|online|shop|club|top|live|store|click)(?![a-z0-9]))/i

export function hasWebLink(text: string | null | undefined): boolean {
  return Boolean(text) && WEB_LINK.test(text!)
}

export function cleanFromLine(value: string): string | null {
  const text = value.replace(/\s+/g, ' ').trim().slice(0, SHARED_FROM_MAX)
  return text || null
}

/** The new reminder that Cancel and make a new one opens with. Not shared until shared again. */
export function replacementReminder(reminder: Reminder): ReminderInput {
  return {
    text: reminder.text,
    day: reminder.day,
    hour: reminder.hour,
    minute: reminder.minute,
    remindBefore: reminder.remindBefore,
    kind: reminder.kind,
  }
}

/** Only a one-day reminder that has not passed or been done. */
export function isShareableReminder(reminder: Reminder, today: string): boolean {
  return !reminder.everyYear && !reminder.doneAt && reminder.day >= today
}

export function isSharedEventCode(value: string): boolean {
  return /^[a-z0-9]{6,12}$/.test(value)
}

export function sharedEventUrl(code: string): string {
  return `${SHARED_EVENT_ORIGIN}/e/${code}`
}

/** The code from a resuming.me/e/<code> link that opened the app. */
export function sharedEventCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname !== 'resuming.me' && parsed.hostname !== 'www.resuming.me') return null
    const match = /^\/e\/([a-z0-9]+)\/?$/i.exec(parsed.pathname)
    const code = match?.[1].toLowerCase() ?? ''
    return isSharedEventCode(code) ? code : null
  } catch {
    return null
  }
}

/** Play hands back the referrer query string, which may also carry marketing codes. */
export function eventCodeFromReferrer(referrer: string): string | null {
  const code = new URLSearchParams(referrer).get('event')?.trim().toLowerCase() ?? ''
  return isSharedEventCode(code) ? code : null
}

const INSTALL_EVENT_CHECKED_KEY = 'resuming-install-event-checked'

/** The event code an install came with, once per install. */
export async function takeInstallEventCode(
  read: () => Promise<{ referrer: string } | null>,
): Promise<string | null> {
  try {
    if (localStorage.getItem(INSTALL_EVENT_CHECKED_KEY)) return null
  } catch {
    return null
  }
  const attribution = await read()
  if (!attribution) return null
  try {
    localStorage.setItem(INSTALL_EVENT_CHECKED_KEY, '1')
  } catch {
    /* worst case the confirm screen shows again next start */
  }
  return eventCodeFromReferrer(attribution.referrer)
}

/** Minutes the zone is ahead of UTC at this moment. */
function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((wall - Math.floor(ms / 60_000) * 60_000) / 60_000)
}

/**
 * The event's day and time on this phone, or null when the phone keeps the same clock
 * (same zone, no time, or a zone the phone does not know).
 */
export function localEventTime(
  event: Pick<SharedEvent, 'day' | 'hour' | 'minute' | 'timeZone'>,
  deviceZone?: string,
): { day: string; hour: number; minute: number } | null {
  if (event.hour == null || event.minute == null) return null
  const [year, month, date] = event.day.split('-').map(Number)
  try {
    const wall = Date.UTC(year, month - 1, date, event.hour, event.minute)
    const guess = wall - zoneOffsetMinutes(wall, event.timeZone) * 60_000
    const instant = wall - zoneOffsetMinutes(guess, event.timeZone) * 60_000
    const zone = deviceZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone
    const local = new Date(instant + zoneOffsetMinutes(instant, zone) * 60_000)
    const result = {
      day: `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`,
      hour: local.getUTCHours(),
      minute: local.getUTCMinutes(),
    }
    if (result.day === event.day && result.hour === event.hour && result.minute === event.minute) return null
    return result
  } catch {
    return null
  }
}

/** The Play listing, with the event code in the install referrer. */
export function sharedEventInstallLink(code: string): string {
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(`event=${code}`)}`
}

export function whatsAppShareUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`
}

/** "Sun, 7 Sep, 7:00 pm", or only the date when there is no time. */
export function formatSharedWhen(
  event: Pick<SharedEvent, 'day' | 'hour' | 'minute'>,
  locale: Locale,
): string {
  const date = parseLocalDate(event.day).toLocaleDateString(localeTag(locale), {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  if (event.hour == null || event.minute == null) return date
  return `${date}, ${formatReminderTime(event.hour, event.minute, locale)}`
}

export function sharedEventMessage(
  event: Pick<SharedEvent, 'code' | 'text' | 'from' | 'day' | 'hour' | 'minute'>,
  locale: Locale,
): string {
  return translate(locale, event.from ? 'sharedEvent.messageFrom' : 'sharedEvent.message', {
    text: event.text ?? '',
    from: event.from ?? '',
    when: formatSharedWhen(event, locale),
    url: sharedEventUrl(event.code),
  })
}

function issueFromError(error: { code?: string; message?: string }): SharedEventIssue {
  const message = error.message ?? ''
  if (message.includes('shared_events_no_links')) return 'links'
  if (message.includes('shared_events_daily_cap')) return 'dailyCap'
  if (message.includes('shared_events_past_day')) return 'pastDay'
  if (message.includes('shared_event_closed')) return 'closed'
  if (message.includes('shared_event_ended')) return 'ended'
  if (message.includes('shared_event_unavailable')) return 'unavailable'
  return 'failed'
}

function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

export interface OwnedSharedEvent {
  id: string
  code: string
  from: string | null
  status: SharedEventStatus
  takingAdds: boolean
  /** Accounts and guest devices that added it. */
  followers: number
}

function statusOf(value: string): SharedEventStatus {
  return value === 'cancelled' || value === 'switched_off' ? value : 'active'
}

/** An event this account owns. Null for someone else's event. */
export async function ownedSharedEvent(eventId: string): Promise<OwnedSharedEvent | null> {
  const { data, error } = await createSupabaseClient().rpc('my_shared_event', { p_event_id: eventId })
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    from: row.from_line,
    status: statusOf(row.status),
    takingAdds: row.taking_adds,
    followers: Number(row.followers) || 0,
  }
}

/** Open or close the link to new people. People who added it keep it either way. */
export async function setSharedEventTakingAdds(eventId: string, takingAdds: boolean): Promise<void> {
  const { error } = await createSupabaseClient()
    .from('shared_events')
    .update({ taking_adds: takingAdds })
    .eq('id', eventId)
  if (error) throw new SharedEventError(issueFromError(error))
}

/** Copies show it was cancelled and stop alerting. There is no undo. */
export async function cancelSharedEvent(eventId: string): Promise<void> {
  const { error } = await createSupabaseClient()
    .from('shared_events')
    .update({ status: 'cancelled' })
    .eq('id', eventId)
  if (error) throw new SharedEventError(issueFromError(error))
}

/** A new code for the same event. The old link stops working. Counts toward the daily limit. */
export async function resetSharedEventLink(eventId: string): Promise<string> {
  const { data, error } = await createSupabaseClient().rpc('reset_shared_event_code', { p_event_id: eventId })
  if (error) throw new SharedEventError(issueFromError(error))
  return data
}

/** Removing a copy ends the follow, so the organizer's count drops. */
export async function unfollowSharedEvent(eventId: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('unfollow_shared_event', {
    p_event_id: eventId,
    p_device_id: getOrCreateAnonId(),
  })
  if (error) throw error
}

/** Best effort: a copy still goes when the network does not. */
export function forgetSharedReminder(reminder: Pick<Reminder, 'sharedEventId'>): void {
  if (reminder.sharedEventId) void unfollowSharedEvent(reminder.sharedEventId).catch(() => {})
}

export const SHARED_REPORT_REASONS = ['spam', 'harmful', 'other'] as const
export type SharedReportReason = (typeof SHARED_REPORT_REASONS)[number]

/** One report per account or device. Reporting again changes nothing. */
export async function reportSharedEvent(eventId: string, reason: SharedReportReason): Promise<void> {
  const { error } = await createSupabaseClient().rpc('report_shared_event', {
    p_event_id: eventId,
    p_reason: reason,
    p_device_id: getOrCreateAnonId(),
  })
  if (error) throw error
}

export interface AdminSharedEvent {
  id: string
  code: string
  text: string
  from: string
  day: string
  status: SharedEventStatus
  takingAdds: boolean
  createdAt: string
  followers: number
  reports: { total: number; spam: number; harmful: number; other: number }
}

/** Reported events first, then the newest. Admin only. */
export async function listSharedEventsForAdmin(): Promise<AdminSharedEvent[]> {
  const { data, error } = await createSupabaseClient().rpc('admin_shared_events')
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    text: row.text,
    from: row.from_line,
    day: row.day,
    status: statusOf(row.status),
    takingAdds: row.taking_adds,
    createdAt: row.created_at,
    followers: Number(row.followers) || 0,
    reports: {
      total: Number(row.reports) || 0,
      spam: Number(row.spam) || 0,
      harmful: Number(row.harmful) || 0,
      other: Number(row.other) || 0,
    },
  }))
}

/** Switched off, the event page shows nothing and copies stop alerting. Admin only. */
export async function setSharedEventSwitchedOff(eventId: string, off: boolean): Promise<void> {
  const { error } = await createSupabaseClient()
    .from('shared_events')
    .update({ status: off ? 'switched_off' : 'active' })
    .eq('id', eventId)
  if (error) throw error
}

/** Makes the event from the organizer's reminder and links the two. */
export async function createSharedEvent(
  userId: string,
  reminder: Reminder,
  from: string | null,
): Promise<{ id: string; code: string }> {
  const text = cleanReminderText(reminder.text)
  if (hasWebLink(text) || hasWebLink(from)) throw new SharedEventError('links')
  const client = createSupabaseClient()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data, error } = await client
      .from('shared_events')
      .insert({
        owner_id: userId,
        text,
        from_line: from,
        day: reminder.day,
        hour: reminder.hour,
        minute: reminder.hour == null ? null : reminder.minute,
        time_zone: deviceTimeZone(),
        kind: reminderKindOf(reminder.kind),
      })
      .select('id, code')
      .single()
    if (error) {
      if (error.code === '23505' && (error.message ?? '').includes('code')) continue
      throw new SharedEventError(issueFromError(error))
    }
    await linkReminderToSharedEvent(reminder.id, data.id)
    return data
  }
  throw new SharedEventError('failed')
}

/** Null when no event has this code. */
export async function getSharedEvent(code: string): Promise<SharedEvent | null> {
  const { data, error } = await createSupabaseClient().rpc('get_shared_event', { p_code: code })
  if (error) throw error
  const row = data?.[0]
  if (!row) return null
  return {
    id: row.id,
    code: row.code,
    text: row.text,
    from: row.from_line,
    day: row.day,
    hour: row.hour,
    minute: row.minute,
    timeZone: row.time_zone,
    kind: reminderKindOf(row.kind),
    status: statusOf(row.status),
    takingAdds: row.taking_adds,
  }
}

/** Counts this account or this guest device once. A guest follow moves to the account at sign-in. */
export async function followSharedEvent(eventId: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('follow_shared_event', {
    p_event_id: eventId,
    p_device_id: getOrCreateAnonId(),
  })
  if (error) throw new SharedEventError(issueFromError(error))
}

/** Whether this account already has a reminder for the event, as organizer or follower. */
export async function hasSharedEventReminder(eventId: string): Promise<boolean> {
  const { count, error } = await createSupabaseClient()
    .from('reminders')
    .select('id', { count: 'exact', head: true })
    .eq('shared_event_id', eventId)
  if (error) throw error
  return (count ?? 0) > 0
}

/** Why the event cannot be added now, or null when it can. */
export function sharedEventBlock(
  event: SharedEvent | null,
  today: string,
): 'unavailable' | 'cancelled' | 'ended' | 'closed' | null {
  if (!event || event.status === 'switched_off' || !event.text) return 'unavailable'
  if (event.status === 'cancelled') return 'cancelled'
  if (event.day < today) return 'ended'
  if (!event.takingAdds) return 'closed'
  return null
}
