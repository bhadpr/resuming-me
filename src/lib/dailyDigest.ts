export const DAILY_DIGEST_STORAGE_KEY = 'resuming-daily-digest'
export const DAILY_DIGEST_CHANGED = 'resuming-daily-digest-changed'
export const DIGEST_TITLE = 'Resuming'
export const DIGEST_FALLBACK_BODY = 'Today is waiting whenever you are ready.'
export const DIGEST_LOOKAHEAD_DAYS = 3
export const DIGEST_NOTIFICATION_ID_BASE = 7100
export const DEFAULT_DIGEST_HOUR = 19
export const DEFAULT_DIGEST_MINUTE = 0

export interface DailyDigestPrefs {
  enabled: boolean
  hour: number
  minute: number
}

export interface DigestItem {
  name: string
  done: boolean
}

export interface DigestFire {
  at: Date
  kind: 'today' | 'later'
}

export interface DigestNotification {
  id: number
  title: string
  body: string
  at: Date
}

export const DEFAULT_DAILY_DIGEST_PREFS: DailyDigestPrefs = {
  enabled: false,
  hour: DEFAULT_DIGEST_HOUR,
  minute: DEFAULT_DIGEST_MINUTE,
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return fallback
  return n
}

export function parseDailyDigestPrefs(raw: string | null): DailyDigestPrefs {
  if (!raw) return { ...DEFAULT_DAILY_DIGEST_PREFS }
  try {
    const parsed = JSON.parse(raw) as Partial<DailyDigestPrefs>
    return {
      enabled: parsed.enabled === true,
      hour: clampInt(parsed.hour, 0, 23, DEFAULT_DIGEST_HOUR),
      minute: clampInt(parsed.minute, 0, 59, DEFAULT_DIGEST_MINUTE),
    }
  } catch {
    return { ...DEFAULT_DAILY_DIGEST_PREFS }
  }
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadDailyDigestPrefs(): DailyDigestPrefs {
  if (!canUseStorage()) return { ...DEFAULT_DAILY_DIGEST_PREFS }
  try {
    return parseDailyDigestPrefs(window.localStorage.getItem(DAILY_DIGEST_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_DAILY_DIGEST_PREFS }
  }
}

export function saveDailyDigestPrefs(prefs: DailyDigestPrefs): void {
  if (!canUseStorage()) return
  window.localStorage.setItem(
    DAILY_DIGEST_STORAGE_KEY,
    JSON.stringify({
      enabled: prefs.enabled === true,
      hour: clampInt(prefs.hour, 0, 23, DEFAULT_DIGEST_HOUR),
      minute: clampInt(prefs.minute, 0, 59, DEFAULT_DIGEST_MINUTE),
    }),
  )
  window.dispatchEvent(new Event(DAILY_DIGEST_CHANGED))
}

export function formatTimeInput(hour: number, minute: number): string {
  return `${String(clampInt(hour, 0, 23, DEFAULT_DIGEST_HOUR)).padStart(2, '0')}:${String(
    clampInt(minute, 0, 59, DEFAULT_DIGEST_MINUTE),
  ).padStart(2, '0')}`
}

export function parseTimeInput(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return { hour, minute }
}

export function digestNotificationIds(
  lookaheadDays = DIGEST_LOOKAHEAD_DAYS,
): number[] {
  return Array.from(
    { length: lookaheadDays },
    (_, i) => DIGEST_NOTIFICATION_ID_BASE + i,
  )
}

/** No-shame copy. Returns null when everything due today is done (or nothing is due). */
export function formatDailyDigest(rows: DigestItem[]): string | null {
  const open = rows.filter((row) => !row.done)
  if (open.length === 0) return null
  if (open.length === 1) return `${open[0].name} is the last one left.`
  if (open.length === 2) return `${open[0].name} and ${open[1].name} are still open.`
  return `${open.length} still open today · ${open[0].name} first.`
}

export function formatClock(at: Date): string {
  const hour = at.getHours()
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h}:${String(at.getMinutes()).padStart(2, '0')} ${suffix}`
}

/** Explains what the local scheduler will actually do right now. */
export function digestScheduleHint(
  rows: DigestItem[],
  prefs: DailyDigestPrefs,
  now = new Date(),
): string | null {
  if (!prefs.enabled) return null
  if (rows.length === 0) {
    return 'Nothing to remind you about yet. Add something on Today first.'
  }

  const todayAt = new Date(now)
  todayAt.setHours(prefs.hour, prefs.minute, 0, 0)
  const clock = formatClock(todayAt)
  const doneToday = rows.every((row) => row.done)

  if (doneToday) {
    return `You're done today, so no ping at ${clock}. Next try is tomorrow.`
  }
  if (todayAt.getTime() <= now.getTime()) {
    return `That time already passed today. Next ping is tomorrow at ${clock}.`
  }
  return `Next ping today at ${clock} if something is still open.`
}

export function nextDigestFires(
  prefs: DailyDigestPrefs,
  now: Date,
  options: { skipToday: boolean; lookaheadDays?: number },
): DigestFire[] {
  if (!prefs.enabled) return []

  const lookahead = options.lookaheadDays ?? DIGEST_LOOKAHEAD_DAYS
  const fires: DigestFire[] = []

  for (let offset = 0; offset < lookahead; offset += 1) {
    const at = new Date(now)
    at.setDate(at.getDate() + offset)
    at.setHours(prefs.hour, prefs.minute, 0, 0)

    const kind: DigestFire['kind'] = offset === 0 ? 'today' : 'later'
    if (kind === 'today') {
      if (options.skipToday) continue
      if (at.getTime() <= now.getTime()) continue
    }

    fires.push({ at, kind })
  }

  return fires
}

/**
 * Local-only schedule: skip today's fire when everything is done, still arm
 * the next couple of days so a missed open still pings (copy may be slightly stale).
 */
export function buildDigestNotifications(
  rows: DigestItem[],
  prefs: DailyDigestPrefs,
  now: Date,
): DigestNotification[] {
  if (!prefs.enabled || rows.length === 0) return []

  const skipToday = rows.every((row) => row.done)
  const todayBody = formatDailyDigest(rows)
  const laterBody = todayBody ?? DIGEST_FALLBACK_BODY

  return nextDigestFires(prefs, now, { skipToday }).map((fire, index) => ({
    id: DIGEST_NOTIFICATION_ID_BASE + index,
    title: DIGEST_TITLE,
    body: fire.kind === 'today' ? (todayBody ?? laterBody) : laterBody,
    at: fire.at,
  }))
}
