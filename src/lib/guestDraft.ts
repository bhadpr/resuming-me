import { templateById } from '../data/activityTemplates'
import { canLogPastGoal, countPortion } from './dayStatus'
import { endOfWeekSunday, startOfWeekMonday } from './dates'
import { formatSecondsAsTargetUnit } from './timer'
import type { ActivityType, TrackingMode } from '../types/database'

export const GUEST_DRAFT_KEY = 'resuming-guest-draft'
/** How many habits a guest draft can hold. The first screen still starts with three. */
export const GUEST_MAX_ACTIVITIES = 20
export const GUEST_NAME_MAX = 40
export const GUEST_WHY_MAX = 80
export const GUEST_WHEN_MAX = 40
export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const GUEST_STEP_MIN = 1
export const GUEST_STEP_MAX = 8
export const GUEST_SAVE_WARN_DAY = 5
export const GUEST_MAX_REMINDERS = 5

export type GuestActivity = {
  localId: string
  name: string
  emoji: string
  type: ActivityType
  trackingMode: TrackingMode
  targetValue: number | null
  targetUnit: string | null
  weeklyTarget: number | null
  deadline: string | null
  templateId: string | null
  why: string | null
  usuallyWhen: string | null
}

export type GuestLog = {
  localActivityId: string
  startedAt: string
  durationSeconds: number
  date: string
  /** Count taps, such as protein portions. Sessions omit this. */
  kind?: 'session' | 'count'
}

export type GuestReading = {
  localActivityId: string
  date: string
  value: number
  secondaryValue: number | null
}

export type GuestDraft = {
  guestId: string
  createdAt: string
  updatedAt: string
  timezone: string
  step: number
  activities: GuestActivity[]
  /** Per-activity gap chip, keyed by localId. */
  gapAnswer: Record<string, string>
  /** When it usually slips (max 2 chips). */
  slipAnswer: string[]
  /** HH:MM times for local nudges (1–5). reminderTime mirrors the first. */
  reminderTimes: string[]
  /** HH:MM, or null when unset or declined. Kept for merge/email. */
  reminderTime: string | null
  reminderDeclined: boolean
  timerSkipped: boolean
  logs: GuestLog[]
  /** Typed vitals, such as blood pressure and heart rate. */
  readings: GuestReading[]
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `g-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function sanitizeActivityName(name: string): string {
  return name.replace(/\s+/g, ' ').trim().slice(0, GUEST_NAME_MAX)
}

export function clampStep(step: number): number {
  if (!Number.isFinite(step)) return GUEST_STEP_MIN
  return Math.min(GUEST_STEP_MAX, Math.max(GUEST_STEP_MIN, Math.round(step)))
}

export function createGuestDraft(now = new Date(), timezone = 'UTC'): GuestDraft {
  const iso = now.toISOString()
  return {
    guestId: newId(),
    createdAt: iso,
    updatedAt: iso,
    timezone,
    step: 1,
    activities: [],
    gapAnswer: {},
    slipAnswer: [],
    reminderTimes: [],
    reminderTime: null,
    reminderDeclined: false,
    timerSkipped: false,
    logs: [],
    readings: [],
  }
}

export function isGuestDraftFresh(draft: GuestDraft, now = Date.now()): boolean {
  const created = Date.parse(draft.createdAt)
  if (!Number.isFinite(created)) return false
  return now - created <= GUEST_DRAFT_TTL_MS
}

/** Whole days since the draft was created. */
export function guestDraftAgeDays(draft: GuestDraft, now = Date.now()): number {
  const created = Date.parse(draft.createdAt)
  if (!Number.isFinite(created)) return GUEST_SAVE_WARN_DAY
  return Math.floor((now - created) / (24 * 60 * 60 * 1000))
}

/**
 * From day 5, tell the guest the local draft is about to expire.
 * Returns null before that.
 */
export function guestSaveWarning(draft: GuestDraft, now = Date.now()): string | null {
  const age = guestDraftAgeDays(draft, now)
  if (age < GUEST_SAVE_WARN_DAY) return null
  const left = Math.max(0, 7 - age)
  if (left <= 0) return 'This setup expires today. Save it to keep it.'
  if (left === 1) return 'Save your progress — it expires tomorrow.'
  return `Save your progress — it expires in ${left} days.`
}

function isDraft(value: unknown): value is GuestDraft {
  if (!value || typeof value !== 'object') return false
  const d = value as GuestDraft
  return typeof d.guestId === 'string' && typeof d.createdAt === 'string' && Array.isArray(d.activities)
}

export function loadGuestDraft(): GuestDraft | null {
  const store = storage()
  if (!store) return null
  try {
    const raw = store.getItem(GUEST_DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!isDraft(parsed)) return null
    if (!isGuestDraftFresh(parsed)) {
      store.removeItem(GUEST_DRAFT_KEY)
      return null
    }
    const normalized = normalizeDraft(parsed)
    const before = parsed.activities.map((activity) => activity.templateId).join(',')
    const after = normalized.activities.map((activity) => activity.templateId).join(',')
    if (before !== after) {
      store.setItem(GUEST_DRAFT_KEY, JSON.stringify(normalized))
    }
    return normalized
  } catch {
    return null
  }
}

function clip(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  const next = value.replace(/\s+/g, ' ').trim().slice(0, max)
  return next || null
}

const TEMPLATE_ALIASES: Record<string, string> = {
  guitar: 'music',
  cleaning: 'rejuvenation',
  box_breathing: 'rejuvenation',
  diary: 'relaxation',
}

function normalizeActivity(activity: GuestActivity): GuestActivity {
  const rawId = activity.templateId ?? null
  const templateId = rawId ? (TEMPLATE_ALIASES[rawId] ?? rawId) : null
  const template = templateId ? templateById(templateId) : undefined
  const renamed = rawId != null && rawId !== templateId && template
  const labelRefresh =
    !renamed &&
    template != null &&
    templateId === 'stretching' &&
    activity.name.trim().toLowerCase() === 'stretching'
  return {
    ...activity,
    name: renamed || labelRefresh ? template!.label : sanitizeActivityName(activity.name),
    emoji: renamed ? template!.emoji : activity.emoji,
    deadline: activity.deadline ?? null,
    templateId,
    why: clip(activity.why, GUEST_WHY_MAX),
    usuallyWhen: clip(activity.usuallyWhen, GUEST_WHEN_MAX),
  }
}

/** Drop habits that left the catalog, such as an old Sleep selection. Custom names stay. */
function keepCurrentHabits(activities: GuestActivity[]): GuestActivity[] {
  return activities.filter((activity) => activity.templateId == null || templateById(activity.templateId))
}

function normalizeReminderTimes(times: unknown, fallback: string | null): string[] {
  const fromList = Array.isArray(times)
    ? times.filter((item): item is string => typeof item === 'string' && /^\d{1,2}:\d{2}$/.test(item))
    : []
  const seed = fromList.length > 0 ? fromList : fallback ? [fallback] : []
  const unique: string[] = []
  for (const raw of seed) {
    const match = /^(\d{1,2}):(\d{2})$/.exec(raw.trim())
    if (!match) continue
    const hour = Number(match[1])
    const minute = Number(match[2])
    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) continue
    const next = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
    if (unique.includes(next)) continue
    unique.push(next)
    if (unique.length >= GUEST_MAX_REMINDERS) break
  }
  return unique.sort()
}

function normalizeDraft(draft: GuestDraft): GuestDraft {
  const activities = keepCurrentHabits(
    (draft.activities ?? []).slice(0, GUEST_MAX_ACTIVITIES).map(normalizeActivity).filter((a) => a.name),
  )
  const ids = new Set(activities.map((activity) => activity.localId))
  return {
    ...draft,
    step: clampStep(draft.step ?? 1),
    activities,
    gapAnswer: Object.fromEntries(
      Object.entries(draft.gapAnswer ?? {}).filter(([id]) => ids.has(id)),
    ),
    slipAnswer: (draft.slipAnswer ?? []).slice(0, 2),
    reminderTimes: (() => {
      const times = normalizeReminderTimes(
        (draft as GuestDraft).reminderTimes,
        draft.reminderTime ?? null,
      )
      return draft.reminderDeclined ? [] : times
    })(),
    reminderTime: (() => {
      if (draft.reminderDeclined) return null
      const times = normalizeReminderTimes(
        (draft as GuestDraft).reminderTimes,
        draft.reminderTime ?? null,
      )
      return times[0] ?? null
    })(),
    reminderDeclined: draft.reminderDeclined ?? false,
    timerSkipped: draft.timerSkipped ?? false,
    readings: (draft.readings ?? []).filter(
      (reading) =>
        ids.has(reading.localActivityId) &&
        typeof reading.date === 'string' &&
        Number.isFinite(reading.value),
    ),
    logs: (draft.logs ?? []).filter((log) => {
      if (!ids.has(log.localActivityId)) return false
      if (log.kind === 'count') return Boolean(log.date)
      return log.durationSeconds >= 1
    }),
    timezone: draft.timezone || 'UTC',
  }
}

export function saveGuestDraft(draft: GuestDraft): GuestDraft {
  const next = normalizeDraft({ ...draft, updatedAt: new Date().toISOString() })
  const store = storage()
  if (store) store.setItem(GUEST_DRAFT_KEY, JSON.stringify(next))
  return next
}

export function clearGuestDraft(): void {
  storage()?.removeItem(GUEST_DRAFT_KEY)
}

/** Create a draft on first visit, or return the fresh one. */
export function ensureGuestDraft(timezone?: string): GuestDraft {
  const existing = loadGuestDraft()
  if (existing) return existing
  const tz =
    timezone ??
    (typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'UTC')
  return saveGuestDraft(createGuestDraft(new Date(), tz))
}

export function setGuestStep(draft: GuestDraft, step: number): GuestDraft {
  return saveGuestDraft({ ...draft, step: clampStep(step) })
}

export function upsertGuestActivity(draft: GuestDraft, activity: GuestActivity): GuestDraft {
  const name = sanitizeActivityName(activity.name)
  if (!name) return draft
  const nextActivity = normalizeActivity({ ...activity, name })
  const existing = draft.activities.findIndex((a) => a.localId === activity.localId)
  let activities = [...draft.activities]
  if (existing >= 0) activities[existing] = nextActivity
  else if (activities.length >= GUEST_MAX_ACTIVITIES) return draft
  else activities = [...activities, nextActivity]
  return saveGuestDraft({ ...draft, activities })
}

export function removeGuestActivity(draft: GuestDraft, localId: string): GuestDraft {
  return saveGuestDraft({
    ...draft,
    activities: draft.activities.filter((a) => a.localId !== localId),
    gapAnswer: Object.fromEntries(
      Object.entries(draft.gapAnswer).filter(([id]) => id !== localId),
    ),
  })
}

export function appendGuestLog(draft: GuestDraft, log: GuestLog): GuestDraft {
  const activity = draft.activities.find((item) => item.localId === log.localActivityId)
  if (!activity) return draft
  // Match signed-in timer stops: keep any bout of at least one second.
  const minimum = log.kind === 'count' ? 0 : 1
  if (log.kind !== 'count' && log.durationSeconds < minimum) return draft
  return saveGuestDraft({ ...draft, logs: [...draft.logs, log] })
}

export function guestCountsOnDate(draft: GuestDraft, localId: string, date: string): number {
  return draft.logs.filter(
    (log) => log.kind === 'count' && log.localActivityId === localId && log.date === date,
  ).length
}

/** Seconds logged for a guest timer habit. Walking bouts in one week add together. */
export function guestSessionSeconds(
  draft: GuestDraft,
  localId: string,
  date: string,
  activity?: Pick<GuestActivity, 'type'>,
): number {
  const from = activity?.type === 'weekly_n' ? startOfWeekMonday(date) : date
  const to = activity?.type === 'weekly_n' ? endOfWeekSunday(date) : date
  return draft.logs.reduce((sum, log) => {
    if (log.kind === 'count' || log.localActivityId !== localId) return sum
    if (log.date < from || log.date > to) return sum
    return sum + log.durationSeconds
  }, 0)
}

/** Minutes done against the session length. Short bouts add up. */
export function guestTimerProgress(
  activity: Pick<GuestActivity, 'targetValue' | 'targetUnit'> & {
    type?: GuestActivity['type']
    weeklyTarget?: number | null
  },
  seconds: number,
): { done: boolean; label: string; targetSeconds: number } {
  const repeats = activity.type === 'weekly_n' ? Math.max(1, activity.weeklyTarget ?? 1) : 1
  const amount = (activity.targetValue ?? 2) * repeats
  const targetSeconds = activity.targetUnit === 'seconds' ? amount : amount * 60
  const unitLabel = activity.targetUnit === 'seconds' ? 'sec' : 'min'
  return {
    done: targetSeconds > 0 && seconds >= targetSeconds,
    targetSeconds,
    label: `${formatSecondsAsTargetUnit(seconds, activity.targetUnit)} / ${amount} ${unitLabel}`,
  }
}

/** How far a guest count habit is today. Each protein tap is 5 g. */
export function guestCountProgress(
  activity: Pick<GuestActivity, 'targetValue' | 'targetUnit'>,
  completions: number,
): { value: number; target: number; done: boolean; label: string } {
  if (activity.targetUnit === 'g' || activity.targetUnit === 'hours' || activity.targetUnit === 'hr') {
    const portion = countPortion(activity.targetUnit)
    const value = completions * portion
    const target = activity.targetValue ?? portion
    const unit = activity.targetUnit === 'g' ? 'g' : 'hours'
    return { value, target, done: value >= target, label: `${value} ${unit} / ${target} ${unit}` }
  }
  const target = activity.targetValue ?? 1
  const value = completions
  return { value, target, done: value >= target, label: `${value}/${target}` }
}

/** One tap toward today's count. Protein and fasting can go past the goal. */
export function appendGuestCount(
  draft: GuestDraft,
  localId: string,
  date: string,
  now = new Date(),
): GuestDraft {
  const activity = draft.activities.find((item) => item.localId === localId)
  if (!activity || activity.trackingMode !== 'count') return draft
  const soFar = guestCountProgress(activity, guestCountsOnDate(draft, localId, date))
  if (soFar.done && !canLogPastGoal(activity.targetUnit)) return draft
  return appendGuestLog(draft, {
    localActivityId: localId,
    startedAt: now.toISOString(),
    durationSeconds: 0,
    date,
    kind: 'count',
  })
}

export function guestReadingOnDate(
  draft: GuestDraft,
  localId: string,
  date: string,
): GuestReading | null {
  return (
    draft.readings.find((reading) => reading.localActivityId === localId && reading.date === date) ??
    null
  )
}

/** Save today's typed vital. A later entry for the same day replaces the earlier one. */
export function upsertGuestReading(
  draft: GuestDraft,
  reading: GuestReading,
): GuestDraft {
  const readings = draft.readings.filter(
    (item) => !(item.localActivityId === reading.localActivityId && item.date === reading.date),
  )
  return saveGuestDraft({ ...draft, readings: [...readings, reading] })
}

/** Shape sent to merge_guest_draft. No extra personal fields. */
export function guestDraftToPayload(draft: GuestDraft) {
  const normalized = normalizeDraft(draft)
  return {
    guestId: normalized.guestId,
    timezone: normalized.timezone,
    reminderTime: normalized.reminderTime,
    reminderTimes: normalized.reminderTimes,
    slipAnswer: normalized.slipAnswer,
    activities: normalized.activities.map((a) => ({
      localId: a.localId,
      name: a.name,
      emoji: a.emoji,
      type: a.type,
      trackingMode: a.trackingMode,
      targetValue: a.targetValue,
      targetUnit: a.targetUnit,
      weeklyTarget: a.weeklyTarget,
      deadline: a.deadline,
      why: a.why,
      usuallyWhen: a.usuallyWhen,
    })),
    logs: normalized.logs.map((log) => ({
      localActivityId: log.localActivityId,
      startedAt: log.startedAt,
      durationSeconds: log.durationSeconds,
      date: log.date,
      kind: log.kind ?? 'session',
    })),
  }
}
