export const DAILY_DIGEST_STORAGE_KEY = 'resuming-daily-digest'
export const DAILY_DIGEST_CHANGED = 'resuming-daily-digest-changed'
export const DIGEST_TITLE = 'Resuming'
export const DIGEST_FALLBACK_BODY = 'Today is waiting whenever you are ready.'
export const DIGEST_LOOKAHEAD_DAYS = 3
export const DIGEST_NOTIFICATION_ID_BASE = 7100
export const DEFAULT_DIGEST_HOUR = 19
export const DEFAULT_DIGEST_MINUTE = 0
/** How many nudges someone can set in one day. */
export const MAX_DAILY_REMINDERS = 5

export type DigestTime = { hour: number; minute: number }

export interface DailyDigestPrefs {
  enabled: boolean
  /** First nudge — kept for older callers and storage. */
  hour: number
  minute: number
  /** All daily nudge times, 1–5, sorted. */
  times: DigestTime[]
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
  times: [{ hour: DEFAULT_DIGEST_HOUR, minute: DEFAULT_DIGEST_MINUTE }],
}

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(n) || n < min || n > max) return fallback
  return n
}

function timeKey(time: DigestTime): string {
  return `${time.hour}:${time.minute}`
}

/** Dedupe, sort, and cap nudge times. Always returns at least one. */
export function normalizeDigestTimes(times: readonly DigestTime[]): DigestTime[] {
  const cleaned = times
    .map((time) => ({
      hour: clampInt(time.hour, 0, 23, DEFAULT_DIGEST_HOUR),
      minute: clampInt(time.minute, 0, 59, DEFAULT_DIGEST_MINUTE),
    }))
    .sort((a, b) => a.hour - b.hour || a.minute - b.minute)

  const unique: DigestTime[] = []
  for (const time of cleaned) {
    if (unique.some((item) => timeKey(item) === timeKey(time))) continue
    unique.push(time)
    if (unique.length >= MAX_DAILY_REMINDERS) break
  }

  return unique.length > 0
    ? unique
    : [{ hour: DEFAULT_DIGEST_HOUR, minute: DEFAULT_DIGEST_MINUTE }]
}

export function withDigestTimes(
  prefs: Pick<DailyDigestPrefs, 'enabled'> & Partial<DailyDigestPrefs>,
  times: readonly DigestTime[],
): DailyDigestPrefs {
  const normalized = normalizeDigestTimes(times)
  return {
    enabled: prefs.enabled === true,
    hour: normalized[0].hour,
    minute: normalized[0].minute,
    times: normalized,
  }
}

export function parseDailyDigestPrefs(raw: string | null): DailyDigestPrefs {
  if (!raw) return { ...DEFAULT_DAILY_DIGEST_PREFS, times: [...DEFAULT_DAILY_DIGEST_PREFS.times] }
  try {
    const parsed = JSON.parse(raw) as Partial<DailyDigestPrefs> & {
      times?: Array<Partial<DigestTime>>
    }
    const hour = clampInt(parsed.hour, 0, 23, DEFAULT_DIGEST_HOUR)
    const minute = clampInt(parsed.minute, 0, 59, DEFAULT_DIGEST_MINUTE)
    const rawTimes =
      Array.isArray(parsed.times) && parsed.times.length > 0
        ? parsed.times.map((time) => ({
            hour: clampInt(time?.hour, 0, 23, hour),
            minute: clampInt(time?.minute, 0, 59, minute),
          }))
        : [{ hour, minute }]
    return withDigestTimes({ enabled: parsed.enabled === true }, rawTimes)
  } catch {
    return { ...DEFAULT_DAILY_DIGEST_PREFS, times: [...DEFAULT_DAILY_DIGEST_PREFS.times] }
  }
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

export function loadDailyDigestPrefs(): DailyDigestPrefs {
  if (!canUseStorage()) {
    return { ...DEFAULT_DAILY_DIGEST_PREFS, times: [...DEFAULT_DAILY_DIGEST_PREFS.times] }
  }
  try {
    return parseDailyDigestPrefs(window.localStorage.getItem(DAILY_DIGEST_STORAGE_KEY))
  } catch {
    return { ...DEFAULT_DAILY_DIGEST_PREFS, times: [...DEFAULT_DAILY_DIGEST_PREFS.times] }
  }
}

export function saveDailyDigestPrefs(prefs: DailyDigestPrefs): void {
  if (!canUseStorage()) return
  const next = withDigestTimes(prefs, prefs.times?.length ? prefs.times : [{ hour: prefs.hour, minute: prefs.minute }])
  window.localStorage.setItem(
    DAILY_DIGEST_STORAGE_KEY,
    JSON.stringify({
      enabled: next.enabled,
      hour: next.hour,
      minute: next.minute,
      times: next.times,
    }),
  )
  window.dispatchEvent(new Event(DAILY_DIGEST_CHANGED))
}

export function formatTimeInput(hour: number, minute: number): string {
  return `${String(clampInt(hour, 0, 23, DEFAULT_DIGEST_HOUR)).padStart(2, '0')}:${String(
    clampInt(minute, 0, 59, DEFAULT_DIGEST_MINUTE),
  ).padStart(2, '0')}`
}

export function parseTimeInput(value: string): DigestTime | null {
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
  reminderCount = MAX_DAILY_REMINDERS,
): number[] {
  return Array.from(
    { length: lookaheadDays * reminderCount },
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

function digestTimesOf(prefs: DailyDigestPrefs): DigestTime[] {
  if (prefs.times?.length) return normalizeDigestTimes(prefs.times)
  return [{ hour: prefs.hour, minute: prefs.minute }]
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

  const fires = nextDigestFires(prefs, now, {
    skipToday: rows.every((row) => row.done),
  })
  if (fires.length === 0) {
    return "You're done today, so no more pings. Next try is tomorrow."
  }

  const next = fires[0]
  const clock = formatClock(next.at)
  if (next.kind === 'later') {
    return `Next ping is tomorrow at ${clock}.`
  }
  const count = digestTimesOf(prefs).length
  if (count > 1) {
    return `Next ping today at ${clock} (${count} nudges set). Silent once you're done.`
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
  const times = digestTimesOf(prefs)
  const fires: DigestFire[] = []

  for (let offset = 0; offset < lookahead; offset += 1) {
    for (const time of times) {
      const at = new Date(now)
      at.setDate(at.getDate() + offset)
      at.setHours(time.hour, time.minute, 0, 0)

      const kind: DigestFire['kind'] = offset === 0 ? 'today' : 'later'
      if (kind === 'today') {
        if (options.skipToday) continue
        if (at.getTime() <= now.getTime()) continue
      }

      fires.push({ at, kind })
    }
  }

  return fires.sort((a, b) => a.at.getTime() - b.at.getTime())
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
