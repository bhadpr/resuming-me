import { templateById } from '../data/activityTemplates'
import type { ActivityType, TrackingMode } from '../types/database'

export const GUEST_DRAFT_KEY = 'resuming-guest-draft'
export const GUEST_MAX_ACTIVITIES = 3
export const GUEST_NAME_MAX = 40
export const GUEST_WHY_MAX = 80
export const GUEST_WHEN_MAX = 40
export const GUEST_DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000
export const GUEST_STEP_MIN = 1
export const GUEST_STEP_MAX = 8
export const GUEST_SAVE_WARN_DAY = 5

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
  /** HH:MM, or null when unset or declined. */
  reminderTime: string | null
  reminderDeclined: boolean
  timerSkipped: boolean
  logs: GuestLog[]
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
    reminderTime: null,
    reminderDeclined: false,
    timerSkipped: false,
    logs: [],
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

const TEMPLATE_ALIASES: Record<string, string> = { guitar: 'music' }

function normalizeActivity(activity: GuestActivity): GuestActivity {
  const rawId = activity.templateId ?? null
  const templateId = rawId ? (TEMPLATE_ALIASES[rawId] ?? rawId) : null
  const template = templateId ? templateById(templateId) : undefined
  const renamed = rawId != null && rawId !== templateId && template
  return {
    ...activity,
    name: renamed ? template.label : sanitizeActivityName(activity.name),
    emoji: renamed ? template.emoji : activity.emoji,
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
    reminderTime: draft.reminderTime ?? null,
    reminderDeclined: draft.reminderDeclined ?? false,
    timerSkipped: draft.timerSkipped ?? false,
    logs: (draft.logs ?? []).filter((log) => log.durationSeconds >= 30 && ids.has(log.localActivityId)),
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
  if (log.durationSeconds < 30) return draft
  if (!draft.activities.some((a) => a.localId === log.localActivityId)) return draft
  return saveGuestDraft({ ...draft, logs: [...draft.logs, log] })
}

/** Shape sent to merge_guest_draft. No extra personal fields. */
export function guestDraftToPayload(draft: GuestDraft) {
  const normalized = normalizeDraft(draft)
  return {
    guestId: normalized.guestId,
    timezone: normalized.timezone,
    reminderTime: normalized.reminderTime,
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
    })),
  }
}
