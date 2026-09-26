import type { GuestActivity, GuestDraft } from './guestDraft'
import { habitVideoFor } from '../data/habitVideos'
import { formatReminderClock } from './checkinPrefs'
import { FASTING_HOURS_PER_TAP, PROTEIN_GRAMS_PER_PORTION } from './dayStatus'

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

export function isProteinHabit(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return activity.templateId === 'protein'
}

export function isFastingHabit(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return activity.templateId === 'fasting'
}

export function isSleepHabit(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return activity.templateId === 'sleep_hours'
}

export function isStepsHabit(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return activity.templateId === 'steps'
}

const LOGGED_VITAL_IDS = new Set([
  'weight',
  'blood_pressure',
  'heart_rate',
  'systolic',
  'diastolic',
])

/** Weight, steps, and blood pressure are logged as numbers, so they skip the minute-size step. */
export function isLoggedVital(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return activity.templateId != null && LOGGED_VITAL_IDS.has(activity.templateId)
}

/** Blood pressure and heart rate are typed in. They do not use Start. */
export function isNumberEntryVital(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return activity.templateId === 'blood_pressure' || activity.templateId === 'heart_rate'
}

/** Water, protein, fasting, and sleep ask for a daily amount, then skip the 1× size chips. */
export function isDailyGoalHabit(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return (
    isWaterHabit(activity) ||
    isProteinHabit(activity) ||
    isFastingHabit(activity) ||
    isSleepHabit(activity) ||
    isStepsHabit(activity)
  )
}

/** Habits that pick session length + how often on start step 3. */
export function needsSizeStep(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return !isDailyGoalHabit(activity) && !isLoggedVital(activity)
}

export function sizeStepActivities<T extends Pick<GuestActivity, 'templateId'>>(activities: T[]): T[] {
  return activities.filter(needsSizeStep)
}

/** Short benefit line under the habit name on the size step. */
const HABIT_SIZE_TAGLINES: Record<string, string> = {
  walk: 'Walking clears your head and steadies your energy.',
  running: 'A short run wakes up your body and mood.',
  exercise: 'A little strength keeps you capable for everything else.',
  stretching: 'A few minutes of movement loosens what the day tightens.',
  meditate: 'A quiet pause helps you return without the spiral.',
  reading: 'A few pages keep the habit alive when life gets loud.',
  writing: 'Putting words down makes the rest of the day clearer.',
  daily_writing: 'A short page keeps the writing muscle warm.',
  journaling: 'A few lines help you notice what you are carrying.',
  study: 'Short study blocks beat waiting for a free afternoon.',
  language: 'A little practice compounds into real confidence.',
  music: 'Playing a little keeps joy from getting postponed.',
  painting: 'Making something small is still making something.',
  dancing: 'Moving to music shakes off what sitting builds up.',
  bhastrika: 'Energizing breath that wakes you without the spike.',
  kapalabhati: 'A cleansing breath that clears fog from the day.',
  anuloma_viloma: 'Balanced breathing that settles a busy mind.',
  bhramari: 'A humming breath that softens tension fast.',
  rejuvenation: 'A short reset so you can meet the day again.',
  prayer: 'A quiet moment that anchors what matters.',
  relaxation: 'A few calm minutes help your body catch up.',
}

export function habitSizeTagline(activity: Pick<GuestActivity, 'templateId' | 'name'>): string {
  if (activity.templateId && HABIT_SIZE_TAGLINES[activity.templateId]) {
    return HABIT_SIZE_TAGLINES[activity.templateId]
  }
  return `${activity.name} works best when it stays small enough to start.`
}

const PRANAYAM_IDS = new Set(['bhastrika', 'kapalabhati', 'anuloma_viloma', 'bhramari'])
/** Pranayam, Strength, and Exercises play their clip when the timer starts. */
const FOLLOW_ALONG_IDS = new Set([...PRANAYAM_IDS, 'exercise', 'stretching'])

export function isPranayamHabit(templateId: string | null | undefined): boolean {
  return templateId != null && PRANAYAM_IDS.has(templateId)
}

/** Follow-along habits play their clip (or placeholder) when the timer starts. */
export function playsVideoWithTimer(templateId: string | null | undefined): boolean {
  if (templateId == null) return false
  return FOLLOW_ALONG_IDS.has(templateId) || habitVideoFor(templateId) != null
}

/** Walking and Running skip the video UI — no instructional clip. */
export function showsHabitVideo(templateId: string | null | undefined): boolean {
  return templateId !== 'walk' && templateId !== 'running'
}

/** Caption under the habit video (real clip or placeholder). */
export function habitVideoCaption(templateId: string | null, name: string): string {
  if (templateId === 'water' || templateId === 'protein' || templateId === 'fasting' || templateId === 'sleep_hours') {
    return `A short video will show why ${name.toLowerCase()} is important.`
  }
  if (templateId && habitVideoFor(templateId)) {
    return `Follow along with this ${name} video.`
  }
  if (templateId && PRANAYAM_IDS.has(templateId)) {
    return `A short video will show how to do ${name}.`
  }
  return `A short video will show how to do ${name}.`
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
export const WALKING_MINUTE_STEPS = [5, 10, 20, 30, 40, 60, 120] as const
export const EXERCISE_MINUTE_STEPS = [2, 5, 10, 15, 20, 40, 60] as const

/** Chip text for a session length. 60 minutes is "1 hour". */
export function durationChipLabel(minutes: number): string {
  const { primary, secondary } = durationChipParts(minutes)
  return `${primary} ${secondary}`
}

/** Two-line tile parts: large number / unit. */
export function durationChipParts(minutes: number): { primary: string; secondary: string } {
  if (minutes === 60) return { primary: '1', secondary: 'hour' }
  if (minutes === 120) return { primary: '2', secondary: 'hours' }
  return { primary: String(minutes), secondary: 'mins' }
}
export const COUNT_STEPS = [1, 2, 3, 4, 5] as const
/** 250 ml each, so 8 glasses is the common 2,000 ml day. */
export const WATER_ML_PER_GLASS = 250
export const WATER_GLASS_NOTE = `One glass is ${WATER_ML_PER_GLASS} ml.`
export const WATER_DAILY_ML = 2000
export const WATER_GLASS_STEPS = [2, 4, 6, 8, 10] as const
export const WATER_GOAL_HEADING = 'How many glasses is your goal?'
export const WATER_GOAL_NOTE =
  'A common daily amount is 2,000 ml. One glass is 250 ml, so 8 glasses.'
export const PROTEIN_GRAM_STEPS = [20, 30, 40, 50, 60, 70] as const
export const PROTEIN_GOAL_HEADING = 'How much protein is your goal?'
export const PROTEIN_GOAL_NOTE = `A common daily amount is about 50 g. One portion is ${PROTEIN_GRAMS_PER_PORTION} g.`
export const FASTING_HOUR_STEPS = [4, 8, 12, 16, 20] as const
export const FASTING_HOURS_NOTE = `Each tap adds ${FASTING_HOURS_PER_TAP} hours.`
export const FASTING_GOAL_HEADING = 'How many hours is your fast?'
export const SLEEP_HOUR_STEPS = [6, 7, 8, 9] as const
export const SLEEP_HOURS_NOTE = 'A common night is about 8 hours.'
export const SLEEP_GOAL_HEADING = 'How many hours of sleep?'
export const STEP_COUNT_TARGETS = [6000, 8000, 10000, 12000, 15000] as const
export const STEPS_GOAL_HEADING = 'How many steps is your goal?'
export const STEPS_GOAL_NOTE = 'A common day is about 10,000 steps.'

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

export function proteinLabel(grams: number): string {
  return `${grams} g`
}

/** Protein's question is the daily gram goal. 1× chips do not set it. */
export const PROTEIN_GAP_OPTIONS = PROTEIN_GRAM_STEPS.map((grams) => ({
  id: `protein_${grams}`,
  label: proteinLabel(grams),
  grams,
  reassurance:
    grams === 50
      ? "That's a common daily amount."
      : `${proteinLabel(grams)} is your daily goal. You can change it any time.`,
}))

export function hourLabel(hours: number): string {
  return hours === 1 ? '1 hour' : `${hours} hours`
}

/** Fasting's question is the daily hour goal. */
export const FASTING_GAP_OPTIONS = FASTING_HOUR_STEPS.map((hours) => ({
  id: `fasting_${hours}`,
  label: hourLabel(hours),
  hours,
  reassurance:
    hours === 16
      ? '16 hours is a common fast.'
      : `${hourLabel(hours)} is your daily goal. You can change it any time.`,
}))

export function stepCountLabel(count: number): string {
  return count.toLocaleString('en-US')
}

export const STEP_GAP_OPTIONS = STEP_COUNT_TARGETS.map((count) => ({
  id: `steps_${count}`,
  label: stepCountLabel(count),
  count,
  reassurance:
    count === 10000
      ? "That's a common daily goal."
      : `${stepCountLabel(count)} steps is your daily goal. You can change it any time.`,
}))

export const SLEEP_GAP_OPTIONS = SLEEP_HOUR_STEPS.map((hours) => ({
  id: `sleep_${hours}`,
  label: hourLabel(hours),
  hours,
  reassurance:
    hours === 8
      ? '8 hours is a common night.'
      : `${hourLabel(hours)} is your nightly goal. You can change it any time.`,
}))

export function gapHeading(activity: Pick<GuestActivity, 'templateId'>): string {
  if (isWaterHabit(activity)) return WATER_GOAL_HEADING
  if (isProteinHabit(activity)) return PROTEIN_GOAL_HEADING
  if (isFastingHabit(activity)) return FASTING_GOAL_HEADING
  if (isSleepHabit(activity)) return SLEEP_GOAL_HEADING
  if (isStepsHabit(activity)) return STEPS_GOAL_HEADING
  return 'When did you last do this?'
}

export function gapNote(activity: Pick<GuestActivity, 'templateId'>): string | null {
  if (isWaterHabit(activity)) return WATER_GOAL_NOTE
  if (isProteinHabit(activity)) return PROTEIN_GOAL_NOTE
  if (isFastingHabit(activity)) return FASTING_HOURS_NOTE
  if (isSleepHabit(activity)) return SLEEP_HOURS_NOTE
  if (isStepsHabit(activity)) return STEPS_GOAL_NOTE
  return null
}

export function gapOptionsFor(activity: Pick<GuestActivity, 'templateId'>) {
  if (isWaterHabit(activity)) return WATER_GAP_OPTIONS
  if (isProteinHabit(activity)) return PROTEIN_GAP_OPTIONS
  if (isFastingHabit(activity)) return FASTING_GAP_OPTIONS
  if (isSleepHabit(activity)) return SLEEP_GAP_OPTIONS
  if (isStepsHabit(activity)) return STEP_GAP_OPTIONS
  return GAP_OPTIONS
}

/** Two-line tile parts for goal chips: large value / small unit. */
export function gapOptionParts(option: {
  label: string
  glasses?: number
  grams?: number
  hours?: number
  count?: number
}): { primary: string; secondary: string | null } {
  if (option.glasses != null) {
    return {
      primary: String(option.glasses),
      secondary: option.glasses === 1 ? 'glass' : 'glasses',
    }
  }
  if (option.grams != null) {
    return { primary: String(option.grams), secondary: 'g' }
  }
  if (option.hours != null) {
    return {
      primary: String(option.hours),
      secondary: option.hours === 1 ? 'hour' : 'hours',
    }
  }
  if (option.count != null) {
    const n = option.count
    const primary = n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : stepCountLabel(n)
    return { primary, secondary: 'steps' }
  }
  return { primary: option.label, secondary: null }
}

export function glassesInGap(id: string): number | null {
  const option = WATER_GAP_OPTIONS.find((item) => item.id === id)
  return option?.glasses ?? null
}

export function gramsInGap(id: string): number | null {
  const option = PROTEIN_GAP_OPTIONS.find((item) => item.id === id)
  return option?.grams ?? null
}

export function hoursInGap(id: string): number | null {
  const option = FASTING_GAP_OPTIONS.find((item) => item.id === id)
  return option?.hours ?? null
}

export function stepsInGap(id: string): number | null {
  const option = STEP_GAP_OPTIONS.find((item) => item.id === id)
  return option?.count ?? null
}

export function sleepHoursInGap(id: string): number | null {
  const option = SLEEP_GAP_OPTIONS.find((item) => item.id === id)
  return option?.hours ?? null
}

export function countTapLabel(unit: string | null | undefined, done: boolean): string {
  if (unit === 'g') return '+5 g'
  if (unit === 'hours') return '+4 hours'
  if (unit === 'hr') return '+1 hour'
  if (done) return 'Done'
  if (unit === 'glasses') return '1 glass'
  return '+1'
}

export function gapReassurance(id: string): string {
  const option = [...GAP_OPTIONS, ...WATER_GAP_OPTIONS, ...PROTEIN_GAP_OPTIONS, ...FASTING_GAP_OPTIONS, ...SLEEP_GAP_OPTIONS, ...STEP_GAP_OPTIONS].find(
    (item) => item.id === id,
  )
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
  /** Shown after the number, such as " min" or "×". Unused when label is set. */
  suffix: string
  /** Full chip text, such as "20 mins" or "1 hour". */
  label?: (step: number) => string
}

/**
 * What step 3 can shrink. A checkbox has no size.
 * Water's glass goal is chosen on the previous screen.
 * How often (daily, once a week, twice a week) is a separate choice.
 * Timers and minute-blocks are minutes. Counts are a number.
 */
export function activitySizeControl(
  activity: Pick<GuestActivity, 'trackingMode' | 'type' | 'targetUnit'> & {
    templateId?: string | null
  },
): SizeControl | null {
  if (activity.templateId === 'water' || activity.targetUnit === 'glasses') return null
  if (activity.templateId === 'protein' || activity.targetUnit === 'g') return null
  if (activity.templateId === 'fasting' || activity.targetUnit === 'hours') return null
  if (activity.templateId === 'sleep_hours' || activity.targetUnit === 'hr') return null
  if (activity.templateId === 'steps' || activity.targetUnit === 'steps') return null
  if (activity.trackingMode === 'checkbox') return null
  if (activity.trackingMode === 'timer' || activity.targetUnit === 'minutes') {
    if (activity.templateId === 'walk' || activity.templateId === 'running') {
      return { steps: WALKING_MINUTE_STEPS, suffix: '', label: durationChipLabel }
    }
    if (activity.templateId === 'exercise') {
      return { steps: EXERCISE_MINUTE_STEPS, suffix: '', label: durationChipLabel }
    }
    return { steps: TIMER_MINUTE_STEPS, suffix: ' min' }
  }
  if (activity.trackingMode === 'count') {
    return { steps: COUNT_STEPS, suffix: '×' }
  }
  return null
}

export const WEEK_CADENCE = [
  { id: 'daily', label: 'Daily', primary: 'Daily', secondary: null },
  { id: 'once', label: 'Once a week', primary: 'Once', secondary: 'a week' },
  { id: 'twice', label: 'Twice a week', primary: 'Twice', secondary: 'a week' },
] as const

export type WeekCadence = (typeof WEEK_CADENCE)[number]['id']

export function weekCadenceOf(
  activity: Pick<GuestActivity, 'type' | 'weeklyTarget'>,
): WeekCadence {
  if (activity.type !== 'weekly_n') return 'daily'
  return (activity.weeklyTarget ?? 1) >= 2 ? 'twice' : 'once'
}

/** Daily clears the weekly count. Once and twice keep the session size. */
export function applyWeekCadence<T extends Pick<GuestActivity, 'type' | 'weeklyTarget'>>(
  activity: T,
  cadence: WeekCadence,
): T {
  if (cadence === 'twice') return { ...activity, type: 'weekly_n', weeklyTarget: 2 }
  if (cadence === 'once') return { ...activity, type: 'weekly_n', weeklyTarget: 1 }
  return { ...activity, type: 'daily', weeklyTarget: null }
}

export function smallestStep(steps: readonly number[]): number {
  return steps[0] ?? 1
}

export function onboardingSummary(
  draft: Pick<GuestDraft, 'activities' | 'logs' | 'reminderTime' | 'reminderTimes' | 'reminderDeclined'>,
): string {
  const count = draft.activities.length
  const activityWord = count === 1 ? 'habit' : 'habits'
  const parts = [`${count} ${activityWord}`]
  if (draft.logs.length > 0) parts.push('1 resumed today')
  const times = draft.reminderTimes?.length
    ? draft.reminderTimes
    : draft.reminderTime
      ? [draft.reminderTime]
      : []
  if (times.length === 1) parts.push(`nudge at ${formatReminderClock(times[0])}`)
  else if (times.length > 1) parts.push(`${times.length} nudges`)
  else if (draft.reminderDeclined) parts.push('no nudges')
  return parts.join(' · ')
}

/** Toggle a slip chip, never more than two. */
export function toggleSlip(current: readonly string[], chip: string): string[] {
  if (current.includes(chip)) return current.filter((item) => item !== chip)
  if (current.length >= 2) return [...current]
  return [...current, chip]
}
