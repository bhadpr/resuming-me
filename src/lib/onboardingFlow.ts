import type { GuestActivity, GuestDraft } from './guestDraft'

export const ONBOARDING_TIMER_SECONDS = 120

export const GAP_OPTIONS = [
  { id: 'few_days', label: 'A few days', reassurance: 'Easy to pick back up.' },
  { id: 'couple_weeks', label: 'A couple of weeks', reassurance: "That's a normal gap. Restarting is the skill." },
  { id: 'month_or_more', label: 'A month or more', reassurance: "Long gaps are normal. We'll start small." },
  { id: 'ages', label: 'Honestly, ages', reassurance: 'Then today is day one. Two minutes is enough.' },
  { id: 'never', label: 'Never started', reassurance: 'Then today is day one. Two minutes is enough.' },
] as const

export type GapId = (typeof GAP_OPTIONS)[number]['id']

export function isWaterHabit(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return activity.templateId === 'water'
}

export const SLIP_OPTIONS = [
  'Mornings',
  'Afternoons',
  'Evenings',
  'Weekends',
  'Busy workdays',
  'Not sure',
] as const

export const TIMER_MINUTE_STEPS = [1, 2, 5, 10, 15, 20, 30] as const
export const COUNT_STEPS = [1, 2, 3, 4, 5] as const
/** 250 ml each, so 8 glasses is the common 2,000 ml day. */
export const WATER_ML_PER_GLASS = 250
export const WATER_DAILY_ML = 2000
export const WATER_GLASS_STEPS = [2, 4, 6, 8, 10] as const
export const WATER_GOAL_HEADING = 'How many glasses is your goal?'
export const WATER_GOAL_NOTE =
  'A common daily amount is 2,000 ml. One glass is 250 ml, so 8 glasses.'

export function glassLabel(count: number): string {
  return count === 1 ? '1 glass' : `${count} glasses`
}

/** Water's first question is the glass goal. Frequency chips do not set a count. */
export const WATER_GAP_OPTIONS = WATER_GLASS_STEPS.map((glasses) => ({
  id: `glasses_${glasses}`,
  label: glassLabel(glasses),
  glasses,
  reassurance:
    glasses === 8
      ? "That's about 2,000 ml."
      : `${glassLabel(glasses)} is your daily goal. You can change it any time.`,
}))

export function gapHeading(activity: Pick<GuestActivity, 'templateId'>): string {
  return isWaterHabit(activity) ? WATER_GOAL_HEADING : 'When did you last do this?'
}

export function gapNote(activity: Pick<GuestActivity, 'templateId'>): string | null {
  return isWaterHabit(activity) ? WATER_GOAL_NOTE : null
}

export function gapOptionsFor(activity: Pick<GuestActivity, 'templateId'>) {
  return isWaterHabit(activity) ? WATER_GAP_OPTIONS : GAP_OPTIONS
}

export function glassesInGap(id: string): number | null {
  const option = WATER_GAP_OPTIONS.find((item) => item.id === id)
  return option?.glasses ?? null
}

export function gapReassurance(id: string): string {
  const option = [...GAP_OPTIONS, ...WATER_GAP_OPTIONS].find((item) => item.id === id)
  return option?.reassurance ?? ''
}

/** Mornings 08:00, evenings 19:00, weekends 10:00, otherwise 19:00. */
export function defaultReminderTime(slip: readonly string[]): string {
  if (slip.includes('Mornings')) return '08:00'
  if (slip.includes('Evenings')) return '19:00'
  if (slip.includes('Weekends')) return '10:00'
  return '19:00'
}

export function continueLabel(count: number): string {
  return `Continue with ${count}`
}

export type SizeControl = {
  steps: readonly number[]
  /** Shown after the number, such as " min" or "×". */
  suffix: string
}

/**
 * What step 3 can shrink. A daily checkbox has no size.
 * Water's glass goal is chosen on the previous screen.
 * Weekly checkboxes are times per week. Timers and minute-blocks are minutes.
 */
export function activitySizeControl(
  activity: Pick<GuestActivity, 'trackingMode' | 'type' | 'targetUnit'> & {
    templateId?: string | null
  },
): SizeControl | null {
  if (activity.templateId === 'water' || activity.targetUnit === 'glasses') return null
  if (activity.type === 'daily' && activity.trackingMode === 'checkbox') return null
  if (activity.trackingMode === 'timer' || activity.targetUnit === 'minutes') {
    return { steps: TIMER_MINUTE_STEPS, suffix: ' min' }
  }
  if (activity.trackingMode === 'count' || activity.type === 'weekly_n') {
    return { steps: COUNT_STEPS, suffix: '×' }
  }
  return null
}

export function smallestStep(steps: readonly number[]): number {
  return steps[0] ?? 1
}

export function onboardingSummary(draft: Pick<GuestDraft, 'activities' | 'logs' | 'reminderTime' | 'reminderDeclined'>): string {
  const count = draft.activities.length
  const activityWord = count === 1 ? 'activity' : 'activities'
  const parts = [`${count} ${activityWord}`]
  parts.push(draft.logs.length > 0 ? '1 resumed today' : 'ready when you are')
  if (draft.reminderTime) parts.push(`nudge at ${draft.reminderTime}`)
  else if (draft.reminderDeclined) parts.push('no nudge')
  return parts.join(' · ')
}

export function celebrationCopy(draft: GuestDraft): { title: string; body: string } {
  const resumed = draft.logs[draft.logs.length - 1]
  const activity = resumed
    ? draft.activities.find((a) => a.localId === resumed.localActivityId)
    : null
  if (activity) {
    return {
      title: `You resumed ${activity.name}.`,
      body: "That's the hard part. The rest is just repeating it.",
    }
  }
  if (draft.timerSkipped) {
    return {
      title: 'Ready when you are.',
      body: "No rush. It'll be waiting on Today.",
    }
  }
  return {
    title: 'Ready when you are.',
    body: 'Two minutes is enough whenever you start.',
  }
}

export const INSIGHTS_PREVIEW =
  "In a week, this shows where your skips pile up — and what's easiest to pick back up."

/** Toggle a slip chip, never more than two. */
export function toggleSlip(current: readonly string[], chip: string): string[] {
  if (current.includes(chip)) return current.filter((item) => item !== chip)
  if (current.length >= 2) return [...current]
  return [...current, chip]
}
