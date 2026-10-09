import { templateById } from '../data/activityTemplates'
import {
  dosesOnDate,
  medicineSystemOf,
  type DoseMark,
  type DueDose,
  type MedicineSchedule,
  type MedicineSystem,
} from './medicineSchedule'
import { clearSkip, clearSnooze, isDoseSkipped } from './medicineReminderState'
import {
  REMINDER_DONE_KEEP_MS,
  REMINDER_OPEN_MAX,
  announceRemindersChanged,
  cleanReminderText,
  isDay,
  isNextYearCopyOf,
  nextYearCopy,
  openReminderCount,
  reminderKindOf,
  type Reminder,
  type ReminderInput,
} from './reminderSchedule'
import { getLocale, t } from './i18n'
import { canLogPastGoal, countPortion, countProgressLabel } from './dayStatus'
import { endOfWeekSunday, startOfWeekMonday } from './dates'
import { sessionProgressLabel } from './timer'
import type { HabitMeasure } from './habitKind'
import type { ActivityType, TrackingMode } from '../types/database'
import { MEDICINES_ENABLED } from '../config'

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
export const GUEST_MAX_MEDICINES = 8

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
  /** Set once welcome already asked for length and how often. */
  sized?: boolean
  /** How a typed name is measured. Catalog habits leave this empty. */
  measure?: HabitMeasure | null
  /** Common daily amount for a typed vital, such as 250 g of carbs. */
  recommended?: number | null
  /** Choices on the amount screen, such as 100, 150, 200, 250, 300. */
  goalSteps?: number[] | null
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

export type GuestMedicine = {
  name: string
  weekdays: number[]
  times: { hour: number; minute: number; meal?: 'before' | 'after' | 'with' | null }[]
  /** Homeopathic, allopathic, or Ayurvedic. */
  system?: MedicineSystem | null
  /** Compressed bottle photo, kept until sign-in. */
  photo?: string | null
}

/** A dose marked taken before an account exists. */
export type GuestDoseMark = {
  name: string
  date: string
  hour: number
  minute: number
}

export type StartPickPhase =
  | 'ask'
  | 'medicine'
  | 'medicines'
  | 'reminderAsk'
  | 'reminder'
  | 'reminders'
  | 'pranayam'
  | 'pranayams'
  | 'pranayamDetail'
  | 'workout'
  | 'workouts'
  | 'workoutDetail'
  | 'vitals'
  | 'vitalPicks'
  | 'targets'
  | 'activities'

const PICK_PHASES: readonly StartPickPhase[] = [
  'ask',
  'medicine',
  'medicines',
  'reminderAsk',
  'reminder',
  'reminders',
  'pranayam',
  'pranayams',
  'pranayamDetail',
  'workout',
  'workouts',
  'workoutDetail',
  'vitals',
  'vitalPicks',
  'targets',
  'activities',
]

/** Setup opens on the workout question. */
export const FIRST_PICK_PHASE: StartPickPhase = 'workout'

/** Older drafts may sit on a removed question. Move them to the one that follows it. */
function normalizePickPhase(stored: string | undefined): StartPickPhase {
  if (stored === 'heartfulness' || stored === 'practices' || stored === 'practiceDetail') return 'vitals'
  if (stored === 'stepGoal') return 'workouts'
  const phase = PICK_PHASES.find((item) => item === stored) ?? FIRST_PICK_PHASE
  if (!MEDICINES_ENABLED && (phase === 'ask' || phase === 'medicine' || phase === 'medicines')) {
    return 'reminderAsk'
  }
  return phase
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
  /** They asked for a daily medicine reminder during setup. */
  medicineDaily: boolean
  /** Bottles collected before an account exists. Photos wait until sign-in. */
  medicines: GuestMedicine[]
  /** Doses marked taken on Today before sign-in. */
  medicineMarks: GuestDoseMark[]
  /** One-off things to do on a day. Not the daily nudge times above. */
  reminders: Reminder[]
  /** Which setup question is open: workout, pranayam, medicine, reminders, then vitals. */
  pickPhase: StartPickPhase
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
    medicineDaily: false,
    medicines: [],
    medicineMarks: [],
    reminders: [],
    pickPhase: FIRST_PICK_PHASE,
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
  if (left <= 0) return t('guest.expiresToday')
  if (left === 1) return t('guest.expiresTomorrow')
  return t('guest.expiresDays', { days: left })
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

function normalizeGuestMedicine(value: GuestMedicine | null | undefined): GuestMedicine | null {
  if (!value || typeof value.name !== 'string') return null
  const name = value.name.replace(/\s+/g, ' ').trim().slice(0, 40)
  const weekdays = [...new Set((value.weekdays ?? []).filter((day) => day >= 0 && day <= 6))].sort()
  const times = (value.times ?? []).flatMap((time) => {
    if (!time || time.hour < 0 || time.hour > 23 || time.minute < 0 || time.minute > 59) return []
    const meal = time.meal === 'before' || time.meal === 'after' || time.meal === 'with' ? time.meal : null
    return [meal ? { hour: time.hour, minute: time.minute, meal } : { hour: time.hour, minute: time.minute }]
  })
  if (!name || weekdays.length === 0 || times.length === 0) return null
  const photo =
    typeof value.photo === 'string' && value.photo.startsWith('data:image/') && value.photo.length < 1_500_000
      ? value.photo
      : null
  const system = medicineSystemOf(value.system)
  return {
    name,
    weekdays,
    times,
    ...(photo ? { photo } : {}),
    ...(system ? { system } : {}),
  }
}

function normalizeGuestMedicines(draft: GuestDraft & { medicine?: GuestMedicine | null }): GuestMedicine[] {
  const listed = Array.isArray(draft.medicines) ? draft.medicines : []
  const raw = listed.length > 0 ? listed : draft.medicine ? [draft.medicine] : []
  const medicines: GuestMedicine[] = []
  for (const item of raw) {
    const next = normalizeGuestMedicine(item)
    if (!next) continue
    medicines.push(next)
    if (medicines.length >= GUEST_MAX_MEDICINES) break
  }
  return medicines
}

function normalizeMedicineMarks(draft: GuestDraft, medicines: readonly GuestMedicine[]): GuestDoseMark[] {
  const names = new Set(medicines.map((item) => item.name))
  const marks: GuestDoseMark[] = []
  for (const mark of draft.medicineMarks ?? []) {
    if (!mark || typeof mark.name !== 'string' || !names.has(mark.name)) continue
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mark.date)) continue
    if (!Number.isInteger(mark.hour) || mark.hour < 0 || mark.hour > 23) continue
    if (!Number.isInteger(mark.minute) || mark.minute < 0 || mark.minute > 59) continue
    marks.push({ name: mark.name, date: mark.date, hour: mark.hour, minute: mark.minute })
    if (marks.length >= 64) break
  }
  return marks
}

/** Drops one bottle and the doses marked for it. */
export function removeGuestMedicine(draft: GuestDraft, index: number): GuestDraft {
  const medicine = draft.medicines[index]
  if (!medicine) return draft
  return {
    ...draft,
    medicines: draft.medicines.filter((_, i) => i !== index),
    medicineMarks: (draft.medicineMarks ?? []).filter((mark) => mark.name !== medicine.name),
  }
}

export function guestMedicineKey(name: string): string {
  return `guest:${name}`
}

export function guestMedicineSchedules(draft: GuestDraft): MedicineSchedule[] {
  return draft.medicines.map((medicine) => ({
    id: guestMedicineKey(medicine.name),
    name: medicine.name,
    photoUrl: medicine.photo ?? null,
    weekdays: medicine.weekdays,
    times: medicine.times,
    system: medicine.system ?? null,
  }))
}

export function guestTakenMarks(draft: GuestDraft): DoseMark[] {
  return (draft.medicineMarks ?? []).flatMap((mark) => {
    if (!draft.medicines.some((item) => item.name === mark.name)) return []
    return [
      {
        medicineId: guestMedicineKey(mark.name),
        date: mark.date,
        hour: mark.hour,
        minute: mark.minute,
      },
    ]
  })
}

function medicineIndexForDose(draft: GuestDraft, dose: DueDose): number {
  if (dose.medicineId.startsWith('guest:')) {
    const name = dose.medicineId.slice('guest:'.length)
    return draft.medicines.findIndex((item) => item.name === name)
  }
  if (dose.medicineId.startsWith('guest-')) {
    const index = Number(dose.medicineId.slice('guest-'.length))
    return Number.isInteger(index) ? index : -1
  }
  return -1
}

/** Today's bottles from the welcome draft, in the same shape as a signed-in Today list. */
export function guestDosesOnDate(draft: GuestDraft, date: string): DueDose[] {
  return dosesOnDate(guestMedicineSchedules(draft), date, guestTakenMarks(draft).filter((mark) => mark.date === date)).map(
    (dose) => ({
      ...dose,
      skipped: !dose.taken && isDoseSkipped({ medicineId: dose.medicineId, date, hour: dose.hour, minute: dose.minute }),
    }),
  )
}

export function toggleGuestDose(draft: GuestDraft, dose: DueDose, date: string): GuestDraft {
  const index = medicineIndexForDose(draft, dose)
  const medicine = draft.medicines[index]
  if (!medicine) return draft
  const marks = draft.medicineMarks ?? []
  const same = (mark: GuestDoseMark) =>
    mark.name === medicine.name && mark.date === date && mark.hour === dose.hour && mark.minute === dose.minute
  const medicineMarks = marks.some(same)
    ? marks.filter((mark) => !same(mark))
    : [...marks, { name: medicine.name, date, hour: dose.hour, minute: dose.minute }]
  const next = saveGuestDraft({ ...draft, medicineMarks })
  if (!dose.taken) {
    const ref = { medicineId: guestMedicineKey(medicine.name), date, hour: dose.hour, minute: dose.minute }
    clearSnooze(ref)
    clearSkip(ref)
  }
  return next
}

function normalizeGuestReminders(list: unknown, now = Date.now()): Reminder[] {
  if (!Array.isArray(list)) return []
  const reminders: Reminder[] = []
  let open = 0
  for (const item of list as Partial<Reminder>[]) {
    if (!item || typeof item.id !== 'string' || typeof item.text !== 'string') continue
    const text = cleanReminderText(item.text)
    if (!text || !isDay(item.day)) continue
    const timed =
      Number.isInteger(item.hour) &&
      Number.isInteger(item.minute) &&
      item.hour! >= 0 &&
      item.hour! <= 23 &&
      item.minute! >= 0 &&
      item.minute! <= 59
    const doneAt = typeof item.doneAt === 'string' && Number.isFinite(Date.parse(item.doneAt)) ? item.doneAt : null
    if (doneAt && now - Date.parse(doneAt) > REMINDER_DONE_KEEP_MS) continue
    if (!doneAt) {
      if (open >= REMINDER_OPEN_MAX) continue
      open += 1
    }
    reminders.push({
      id: item.id,
      text,
      day: item.day,
      hour: timed ? item.hour! : null,
      minute: timed ? item.minute! : null,
      remindBefore: item.remindBefore === true,
      kind: reminderKindOf(item.kind),
      everyYear: item.everyYear === true,
      doneAt,
      sharedEventId: typeof item.sharedEventId === 'string' ? item.sharedEventId : null,
      ...(item.alertOff === true ? { alertOff: true } : {}),
      ...(item.sharedStatus === 'active' || item.sharedStatus === 'cancelled' || item.sharedStatus === 'switched_off'
        ? { sharedStatus: item.sharedStatus }
        : {}),
    })
  }
  return reminders
}

function newGuestReminder(input: ReminderInput): Reminder {
  return {
    id: `guest-${newId()}`,
    text: cleanReminderText(input.text),
    day: input.day,
    hour: input.hour,
    minute: input.hour == null ? null : input.minute,
    remindBefore: input.remindBefore === true,
    kind: reminderKindOf(input.kind),
    everyYear: input.everyYear === true,
    doneAt: null,
    sharedEventId: input.sharedEventId ?? null,
  }
}

/** Null when the guest already has the most open reminders allowed. */
export function addGuestReminder(draft: GuestDraft, input: ReminderInput): GuestDraft | null {
  if (openReminderCount(draft.reminders) >= REMINDER_OPEN_MAX) return null
  const next = saveGuestDraft({ ...draft, reminders: [...draft.reminders, newGuestReminder(input)] })
  announceRemindersChanged()
  return next
}

/** Marks done. An every-year reminder also gets next year's copy, unless the list is full. */
export function completeGuestReminder(draft: GuestDraft, id: string, doneAt: string): GuestDraft {
  const reminder = draft.reminders.find((item) => item.id === id)
  if (!reminder) return draft
  let reminders = draft.reminders.map((item) => (item.id === id ? { ...item, doneAt } : item))
  if (reminder.everyYear && openReminderCount(reminders) < REMINDER_OPEN_MAX) {
    reminders = [...reminders, newGuestReminder(nextYearCopy(reminder))]
  }
  const next = saveGuestDraft({ ...draft, reminders })
  announceRemindersChanged()
  return next
}

/** Puts a done reminder back, and removes the next-year copy that Done made. */
export function reopenGuestReminder(draft: GuestDraft, id: string): GuestDraft {
  const reminder = draft.reminders.find((item) => item.id === id)
  if (!reminder) return draft
  const reminders = draft.reminders
    .filter((item) => !(reminder.everyYear && isNextYearCopyOf(item, reminder)))
    .map((item) => (item.id === id ? { ...item, doneAt: null } : item))
  const next = saveGuestDraft({ ...draft, reminders })
  announceRemindersChanged()
  return next
}

export function updateGuestReminder(draft: GuestDraft, id: string, patch: Partial<Reminder>): GuestDraft {
  const next = saveGuestDraft({
    ...draft,
    reminders: draft.reminders.map((item) => (item.id === id ? { ...item, ...patch } : item)),
  })
  announceRemindersChanged()
  return next
}

/** Keeps what the server said about shared events, so a cancelled copy stays quiet offline. */
export function saveGuestSharedStatuses(draft: GuestDraft, updated: readonly Reminder[]): GuestDraft {
  const status = new Map(updated.map((item) => [item.id, item.sharedStatus]))
  let changed = false
  const reminders = draft.reminders.map((item) => {
    const next = status.get(item.id)
    if (!item.sharedEventId || next === undefined || next === item.sharedStatus) return item
    changed = true
    return { ...item, sharedStatus: next }
  })
  if (!changed) return draft
  const next = saveGuestDraft({ ...draft, reminders })
  announceRemindersChanged()
  return next
}

export function removeGuestReminder(draft: GuestDraft, id: string): GuestDraft {
  const next = saveGuestDraft({ ...draft, reminders: draft.reminders.filter((item) => item.id !== id) })
  announceRemindersChanged()
  return next
}

function normalizeDraft(draft: GuestDraft): GuestDraft {
  const stored = draft as GuestDraft & { medicine?: GuestMedicine | null }
  const medicines = normalizeGuestMedicines(stored)
  const { medicine: _legacyMedicine, ...withoutLegacyMedicine } = stored
  void _legacyMedicine
  const activities = keepCurrentHabits(
    (draft.activities ?? []).slice(0, GUEST_MAX_ACTIVITIES).map(normalizeActivity).filter((a) => a.name),
  )
  const ids = new Set(activities.map((activity) => activity.localId))
  return {
    ...withoutLegacyMedicine,
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
    medicines,
    medicineMarks: normalizeMedicineMarks(draft, medicines),
    medicineDaily: medicines.length > 0,
    reminders: normalizeGuestReminders(draft.reminders),
    pickPhase: normalizePickPhase(draft.pickPhase),
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

/** Drop the latest session or count tap so Undo can take it back. */
export function removeLastGuestLog(
  draft: GuestDraft,
  localActivityId: string,
  kind: 'session' | 'count',
): GuestDraft {
  let index = -1
  for (let i = draft.logs.length - 1; i >= 0; i--) {
    const log = draft.logs[i]
    if (log.localActivityId !== localActivityId) continue
    const isCount = log.kind === 'count'
    if (kind === 'count' ? isCount : !isCount) {
      index = i
      break
    }
  }
  if (index < 0) return draft
  return saveGuestDraft({
    ...draft,
    logs: draft.logs.filter((_, i) => i !== index),
  })
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
  return {
    done: targetSeconds > 0 && seconds >= targetSeconds,
    targetSeconds,
    label: sessionProgressLabel(seconds, targetSeconds, activity.targetUnit),
  }
}

/** How far a guest count habit is today. Each protein tap is 5 g. */
export function guestCountProgress(
  activity: Pick<GuestActivity, 'targetValue' | 'targetUnit'>,
  completions: number,
): { value: number; target: number; done: boolean; label: string } {
  if (activity.targetUnit === 'g' || activity.targetUnit === 'hours' || activity.targetUnit === 'hr') {
    const portion = countPortion(activity.targetUnit, activity.targetValue)
    const value = completions * portion
    const target = activity.targetValue ?? portion
    return { value, target, done: value >= target, label: countProgressLabel(value, target, activity.targetUnit) }
  }
  const target = activity.targetValue ?? 1
  const value = completions
  return { value, target, done: value >= target, label: countProgressLabel(value, target, activity.targetUnit) }
}

/** A typed tick habit is done with one tap. Catalog Relaxation keeps its timer and video. */
export function guestTapsDone(activity: Pick<GuestActivity, 'trackingMode' | 'templateId'>): boolean {
  return activity.trackingMode === 'checkbox' && activity.templateId == null
}

/** One tap toward today's count. Protein and fasting can go past the goal. */
export function appendGuestCount(
  draft: GuestDraft,
  localId: string,
  date: string,
  now = new Date(),
): GuestDraft {
  const activity = draft.activities.find((item) => item.localId === localId)
  if (!activity || (activity.trackingMode !== 'count' && !guestTapsDone(activity))) return draft
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
    locale: getLocale(),
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
      templateId: a.templateId,
      nameOverridden: false,
    })),
    logs: normalized.logs.map((log) => ({
      localActivityId: log.localActivityId,
      startedAt: log.startedAt,
      durationSeconds: log.durationSeconds,
      date: log.date,
      kind: log.kind ?? 'session',
    })),
    readings: normalized.readings.map((reading) => ({
      localActivityId: reading.localActivityId,
      date: reading.date,
      value: reading.value,
      secondaryValue: reading.secondaryValue,
    })),
  }
}
