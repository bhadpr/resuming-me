import { addDays, endOfWeekSunday, todayLocalDate } from './dates'
import type { ActivityInput } from './activities'

export const ONBOARDING_DISMISS_KEY = 'resuming-onboarding-dismissed'
export const INSTALL_DISMISS_KEY = 'resuming-install-dismissed'
export const DEADLINE_REMINDER_KEY = 'resuming-deadline-reminders'

export type StarterChipId =
  | 'read'
  | 'walk'
  | 'meditation'
  | 'yoga'
  | 'run'
  | 'learn_ai'
  | 'kids'
  | 'subscriptions'
  | 'deadline'
  | 'else'

export type DeadlineCadence = 'few_days' | 'daily' | 'weekly' | 'off'

export type ElseKind = 'repeating' | 'deadline'

export type RepeatingElseMode = 'timer' | 'checkbox' | 'weekly'

export interface StarterChip {
  id: StarterChipId
  label: string
}

export interface SessionSizeOption {
  minutes: number
  title: string
  meta: string
}

export interface OnboardingDraft {
  chipId: StarterChipId
  fromElse: boolean
  name: string
  emoji: string
  input: ActivityInput
  deadlineCadence: DeadlineCadence | null
}

export interface OnboardingCompletePayload {
  activities: Array<{
    input: ActivityInput
    deadlineCadence: DeadlineCadence | null
  }>
  digest: { enabled: boolean; hour: number; minute: number }
}

export const STARTER_CHIPS: StarterChip[] = [
  { id: 'read', label: 'Read' },
  { id: 'walk', label: 'Walk' },
  { id: 'meditation', label: 'Meditation' },
  { id: 'yoga', label: 'Yoga' },
  { id: 'run', label: 'Run' },
  { id: 'learn_ai', label: 'Learn AI' },
  { id: 'kids', label: 'Play a game with kids' },
  { id: 'subscriptions', label: 'Review subscriptions' },
  { id: 'deadline', label: 'A task with a due date' },
  { id: 'else', label: 'Something else' },
]

export const DEADLINE_CADENCE_OPTIONS: Array<{
  id: DeadlineCadence
  title: string
  meta?: string
}> = [
  { id: 'few_days', title: 'Every few days', meta: 'A nudge, not a daily nag' },
  { id: 'daily', title: 'Every day' },
  { id: 'weekly', title: 'Once a week' },
  { id: 'off', title: 'Not now' },
]

export function needsOnboarding(
  activeActivityCount: number,
  dismissed: boolean,
): boolean {
  return activeActivityCount === 0 && !dismissed
}

export function readDismissedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeDismissedFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** True when running as installed PWA / home-screen app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return Boolean(mq || iosStandalone)
}

/** Rough iOS Safari detection for Add to Home Screen tip. */
export function isLikelyIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chromeLike = /CriOS|FxiOS|EdgiOS/.test(ua)
  return iOS && webkit && !chromeLike
}

export function shouldShowInstallTip(params: {
  dismissed: boolean
  standalone: boolean
  iosSafari: boolean
}): boolean {
  return !params.dismissed && !params.standalone && params.iosSafari
}

function timerInput(
  name: string,
  emoji: string,
  minutes: number,
): ActivityInput {
  return {
    name,
    emoji,
    type: 'daily',
    trackingMode: 'timer',
    targetValue: minutes,
    targetUnit: 'minutes',
    weeklyTarget: null,
    deadline: null,
  }
}

function timerDraft(
  chipId: StarterChipId,
  name: string,
  emoji: string,
  minutes: number,
): OnboardingDraft {
  return {
    chipId,
    fromElse: false,
    name,
    emoji,
    input: timerInput(name, emoji, minutes),
    deadlineCadence: null,
  }
}

function monthlyDraft(
  chipId: StarterChipId,
  name: string,
  emoji: string,
): OnboardingDraft {
  return {
    chipId,
    fromElse: false,
    name,
    emoji,
    input: {
      name,
      emoji,
      type: 'monthly',
      trackingMode: 'checkbox',
      targetValue: null,
      targetUnit: null,
      weeklyTarget: null,
      deadline: null,
    },
    deadlineCadence: null,
  }
}

const TIMER_STARTERS: Partial<
  Record<StarterChipId, { name: string; emoji: string; minutes: number }>
> = {
  read: { name: 'Reading', emoji: '📖', minutes: 2 },
  walk: { name: 'Walk', emoji: '🚶', minutes: 5 },
  meditation: { name: 'Meditation', emoji: '🧘', minutes: 1 },
  yoga: { name: 'Yoga', emoji: '🤸', minutes: 5 },
  run: { name: 'Run', emoji: '🏃', minutes: 5 },
  learn_ai: { name: 'Learn AI', emoji: '🤖', minutes: 10 },
}

const SESSION_SIZES: Partial<Record<StarterChipId, [number, number]>> = {
  read: [2, 10],
  walk: [5, 20],
  meditation: [1, 5],
  yoga: [5, 20],
  run: [5, 20],
  learn_ai: [10, 20],
  else: [5, 10],
}

/** Monthly chips already know their cadence. */
export function chipAddsImmediately(chipId: StarterChipId): boolean {
  return chipId === 'subscriptions'
}

/** Play with kids is counted sessions, not minutes. */
export function chipAsksCountTimes(chipId: StarterChipId): boolean {
  return chipId === 'kids'
}

export function draftFromChip(chipId: StarterChipId): OnboardingDraft | null {
  if (chipId === 'else' || chipId === 'deadline') return null

  const timer = TIMER_STARTERS[chipId]
  if (timer) return timerDraft(chipId, timer.name, timer.emoji, timer.minutes)

  if (chipId === 'subscriptions') {
    return monthlyDraft(chipId, 'Review subscriptions', '💳')
  }
  return {
    chipId: 'kids',
    fromElse: false,
    name: 'Play a game with kids',
    emoji: '🎲',
    input: {
      name: 'Play a game with kids',
      emoji: '🎲',
      type: 'daily',
      trackingMode: 'count',
      targetValue: 2,
      targetUnit: null,
      weeklyTarget: null,
      deadline: null,
    },
    deadlineCadence: null,
  }
}

export function emptyNamedDraft(
  chipId: 'deadline' | 'else',
  name = '',
): OnboardingDraft {
  const trimmed = name.trim()
  return {
    chipId,
    fromElse: chipId === 'else',
    name: trimmed,
    emoji: '📌',
    input: {
      name: trimmed || 'Untitled',
      emoji: '📌',
      type: chipId === 'deadline' ? 'deadline' : 'daily',
      trackingMode: chipId === 'deadline' ? 'checkbox' : 'timer',
      targetValue: chipId === 'deadline' ? null : 5,
      targetUnit: chipId === 'deadline' ? null : 'minutes',
      weeklyTarget: null,
      deadline: null,
    },
    deadlineCadence: chipId === 'deadline' ? 'few_days' : null,
  }
}

export function applyDraftName(draft: OnboardingDraft, name: string): OnboardingDraft {
  const trimmed = name.trim()
  return {
    ...draft,
    name: trimmed,
    input: { ...draft.input, name: trimmed },
  }
}

export function sessionSizeOptions(chipId: StarterChipId): SessionSizeOption[] {
  const pair = SESSION_SIZES[chipId]
  if (!pair) return []
  const [first, usual] = pair
  const usualMeta = chipId === 'else' ? 'A bit longer' : 'Usual session'
  const firstMeta = chipId === 'else' ? 'Easy to start' : 'First session — easy to start'
  return [
    { minutes: first, title: `${first} minute${first === 1 ? '' : 's'}`, meta: firstMeta },
    { minutes: usual, title: `${usual} minutes`, meta: usualMeta },
  ]
}

export function applyDailyCadence(draft: OnboardingDraft): OnboardingDraft {
  return {
    ...draft,
    deadlineCadence: null,
    input: {
      ...draft.input,
      type: 'daily',
      weeklyTarget: null,
      deadline: null,
    },
  }
}

export function applyDailyCount(
  draft: OnboardingDraft,
  times = 1,
): OnboardingDraft {
  const count = Math.min(12, Math.max(1, Math.floor(times)))
  return {
    ...draft,
    deadlineCadence: null,
    input: {
      ...draft.input,
      type: 'daily',
      trackingMode: 'count',
      targetValue: count,
      targetUnit: null,
      weeklyTarget: null,
      deadline: null,
    },
  }
}

export function applyWeeklyCount(
  draft: OnboardingDraft,
  weeklyTarget = 1,
): OnboardingDraft {
  const times = Math.min(7, Math.max(1, Math.floor(weeklyTarget)))
  return {
    ...draft,
    deadlineCadence: null,
    input: {
      ...draft.input,
      type: 'weekly_n',
      trackingMode: 'count',
      targetValue: 1,
      targetUnit: null,
      weeklyTarget: times,
      deadline: null,
    },
  }
}

export function applyWeeklyTimes(
  draft: OnboardingDraft,
  weeklyTarget = 1,
): OnboardingDraft {
  const times = Math.min(7, Math.max(1, Math.floor(weeklyTarget)))
  const minutes =
    draft.input.trackingMode === 'timer' && draft.input.targetValue
      ? draft.input.targetValue
      : 5
  return {
    ...draft,
    deadlineCadence: null,
    input: {
      ...draft.input,
      type: 'weekly_n',
      trackingMode: 'timer',
      targetValue: minutes,
      targetUnit: 'minutes',
      weeklyTarget: times,
      deadline: null,
    },
  }
}

export function applySessionMinutes(
  draft: OnboardingDraft,
  minutes: number,
): OnboardingDraft {
  const weekly = draft.input.type === 'weekly_n'
  return {
    ...draft,
    input: {
      ...draft.input,
      type: weekly ? 'weekly_n' : 'daily',
      trackingMode: 'timer',
      targetValue: minutes,
      targetUnit: 'minutes',
      weeklyTarget: weekly ? draft.input.weeklyTarget : null,
      deadline: null,
    },
  }
}

export function applyRepeatingElse(
  draft: OnboardingDraft,
  mode: RepeatingElseMode,
  weeklyTarget = 1,
): OnboardingDraft {
  if (mode === 'checkbox') {
    return {
      ...draft,
      chipId: 'else',
      deadlineCadence: null,
      input: {
        ...draft.input,
        type: 'daily',
        trackingMode: 'checkbox',
        targetValue: null,
        targetUnit: null,
        weeklyTarget: null,
        deadline: null,
      },
    }
  }
  if (mode === 'weekly') {
    return applyWeeklyTimes({ ...draft, chipId: 'else' }, weeklyTarget)
  }
  return applySessionMinutes(applyDailyCadence(draft), 5)
}

export function applyDeadlineDate(
  draft: OnboardingDraft,
  deadline: string,
): OnboardingDraft {
  return {
    ...draft,
    chipId: draft.fromElse ? 'else' : 'deadline',
    input: {
      ...draft.input,
      type: 'deadline',
      trackingMode: 'checkbox',
      targetValue: null,
      targetUnit: null,
      weeklyTarget: null,
      deadline,
    },
  }
}

export function thisWeekDeadline(today = todayLocalDate()): string {
  const sunday = endOfWeekSunday(today)
  return sunday > today ? sunday : addDays(today, 7)
}

export function twoWeekDeadline(today = todayLocalDate()): string {
  return addDays(today, 14)
}

export function formatShortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function draftSummary(draft: OnboardingDraft): string {
  const { input } = draft
  if (input.type === 'deadline' && input.deadline) {
    const cadence =
      draft.deadlineCadence && draft.deadlineCadence !== 'off'
        ? draft.deadlineCadence === 'few_days'
          ? ' · remind every few days'
          : draft.deadlineCadence === 'daily'
            ? ' · remind every day'
            : ' · remind weekly'
        : ''
    return `Due ${formatShortDate(input.deadline)}${cadence}`
  }
  if (input.type === 'monthly') return 'Once a month'
  if (input.type === 'weekly_n' && input.trackingMode === 'timer') {
    return `Weekly · ${input.weeklyTarget ?? 1}× · ${input.targetValue ?? 0} min`
  }
  if (input.trackingMode === 'timer') {
    return `Daily · ${input.targetValue ?? 0} min`
  }
  if (input.type === 'weekly_n') {
    return `Weekly · ${input.weeklyTarget ?? 1}× per week`
  }
  if (input.trackingMode === 'count') {
    return `Daily · ${input.targetValue ?? 1}×`
  }
  return 'Daily · check off'
}

export function uniqueChipAlreadyAdded(
  chipId: StarterChipId,
  added: OnboardingDraft[],
): boolean {
  if (chipId === 'else' || chipId === 'deadline') return false
  return added.some((d) => d.chipId === chipId && !d.fromElse)
}

export function saveDeadlineReminder(
  activityId: string,
  cadence: DeadlineCadence,
): void {
  if (cadence === 'off') return
  try {
    const raw = localStorage.getItem(DEADLINE_REMINDER_KEY)
    const parsed = raw ? (JSON.parse(raw) as Record<string, DeadlineCadence>) : {}
    parsed[activityId] = cadence
    localStorage.setItem(DEADLINE_REMINDER_KEY, JSON.stringify(parsed))
  } catch {
    /* ignore */
  }
}
