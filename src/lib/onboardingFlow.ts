import type { GuestActivity, GuestDraft } from './guestDraft'
import { habitVideoFor } from '../data/habitVideos'
import { t } from './i18n'
import { formatReminderClock } from './checkinPrefs'
import { FASTING_HOURS_PER_TAP, PROTEIN_GRAMS_PER_PORTION } from './dayStatus'
import { MEDICINES_ENABLED } from '../config'

export const GAP_OPTIONS = [
  { id: 'few_days', label: 'A few days', reassurance: 'Easy to pick back up.' },
  { id: 'couple_weeks', label: 'A couple of weeks', reassurance: "That's a normal gap. Restarting is the skill." },
  { id: 'month_or_more', label: 'A month or more', reassurance: "Long gaps are normal. We'll start small." },
  { id: 'ages', label: 'Honestly, ages', reassurance: 'Then today is day one. Two minutes is enough.' },
  { id: 'never', label: 'Never started', reassurance: 'Then today is day one. Two minutes is enough.' },
] as const

export type GapId = (typeof GAP_OPTIONS)[number]['id']

export function isWaterHabit(activity: { templateId?: string | null }): boolean {
  return activity.templateId === 'water'
}

export function isProteinHabit(activity: { templateId?: string | null }): boolean {
  return activity.templateId === 'protein'
}

export function isFastingHabit(activity: { templateId?: string | null }): boolean {
  return activity.templateId === 'fasting'
}

export function isSleepHabit(activity: { templateId?: string | null }): boolean {
  return activity.templateId === 'sleep_hours'
}

export function isStepsHabit(activity: { templateId?: string | null }): boolean {
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
export function isLoggedVital(activity: {
  templateId?: string | null
  measure?: string | null
}): boolean {
  if (activity.measure === 'log') return true
  return activity.templateId != null && LOGGED_VITAL_IDS.has(activity.templateId)
}

/** Weight, blood pressure, and heart rate are typed in. They do not use Start. */
export function isNumberEntryVital(activity: Pick<GuestActivity, 'templateId'>): boolean {
  return (
    activity.templateId === 'weight' ||
    activity.templateId === 'blood_pressure' ||
    activity.templateId === 'heart_rate'
  )
}

/** Typed goal amount: whole steps, everything else to one decimal. */
export function parseGoalText(templateId: string | null | undefined, raw: string): number | null {
  const value = Number(raw.replace(/,/g, '').trim())
  if (!Number.isFinite(value) || value <= 0) return null
  if (templateId === 'steps') return Math.round(value)
  return Math.round(value * 10) / 10
}

export const WEIGHT_UNITS = ['kg', 'lb'] as const
export type WeightUnit = (typeof WEIGHT_UNITS)[number]
const LB_PER_KG = 2.20462

/** Older vitals were saved as "lbs". */
export function weightUnitOf(unit: string | null | undefined): WeightUnit {
  const value = unit?.trim().toLowerCase()
  return value === 'lb' || value === 'lbs' ? 'lb' : 'kg'
}

export function convertWeight(value: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return value
  const converted = from === 'kg' ? value * LB_PER_KG : value / LB_PER_KG
  return Math.round(converted * 10) / 10
}

/** Daily-goal habits that are also listed on the Vitals tab. */
export const VITAL_GOAL_IDS: ReadonlySet<string> = new Set(['water', 'protein', 'fasting', 'steps'])

/** Lives on the Vitals tab rather than Activity. */
export function isGuestVital(activity: { templateId?: string | null; measure?: string | null }): boolean {
  return (
    isNumberEntryVital({ templateId: activity.templateId ?? null }) ||
    isLoggedVital(activity) ||
    isStepsHabit(activity)
  )
}

/** Water, protein, fasting, sleep, and a typed gram goal ask for a daily amount. */
export function isDailyGoalHabit(activity: {
  templateId?: string | null
  measure?: string | null
}): boolean {
  if (
    activity.measure === 'grams' ||
    activity.measure === 'glasses' ||
    activity.measure === 'hours' ||
    activity.measure === 'sleep' ||
    activity.measure === 'steps'
  ) {
    return true
  }
  return (
    isWaterHabit(activity) ||
    isProteinHabit(activity) ||
    isFastingHabit(activity) ||
    isSleepHabit(activity) ||
    isStepsHabit(activity)
  )
}

/** Habits that pick session length + how often on start step 3. */
export function needsSizeStep(activity: {
  templateId?: string | null
  measure?: string | null
}): boolean {
  return !isDailyGoalHabit(activity) && !isLoggedVital(activity)
}

export function sizeStepActivities<
  T extends { templateId?: string | null; measure?: string | null },
>(activities: T[]): T[] {
  return activities.filter(needsSizeStep)
}

/** Short benefit line under the habit name on the size step. */
export function habitSizeTagline(activity: Pick<GuestActivity, 'templateId' | 'name'>): string {
  if (activity.templateId) {
    const key = `tagline.${activity.templateId}`
    const hit = t(key)
    if (hit !== key) return hit
  }
  return t('tagline.custom', { name: activity.name })
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

/** Only habits with a real clip offer Watch on Today. */
export function showsHabitVideo(templateId: string | null | undefined): boolean {
  return habitVideoFor(templateId) != null
}

/** Caption under the habit video (real clip or placeholder). */
export function habitVideoCaption(
  templateId: string | null,
  name: string,
  measure?: string | null,
): string {
  const measured =
    measure === 'grams' ||
    measure === 'glasses' ||
    measure === 'hours' ||
    measure === 'sleep' ||
    measure === 'steps' ||
    measure === 'log'
  if (
    measured ||
    templateId === 'water' ||
    templateId === 'protein' ||
    templateId === 'fasting' ||
    templateId === 'sleep_hours'
  ) {
    return t('video.why', { name: name.toLowerCase() })
  }
  if (templateId && habitVideoFor(templateId)) {
    return t('video.follow', { name })
  }
  return t('video.how', { name })
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
  if (minutes === 60) return { primary: '1', secondary: t('unit.hour') }
  if (minutes === 120) return { primary: '2', secondary: t('unit.hours') }
  return { primary: String(minutes), secondary: t('unit.mins') }
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
export const FASTING_HOUR_STEPS = [8, 12, 16, 20] as const
export const FASTING_HOURS_NOTE = `Each tap adds ${FASTING_HOURS_PER_TAP} hours.`
export const FASTING_GOAL_HEADING = 'How many hours is your fast?'
export const SLEEP_HOUR_STEPS = [6, 7, 8, 9] as const
export const SLEEP_HOURS_NOTE = 'A common night is about 8 hours.'
export const SLEEP_GOAL_HEADING = 'How many hours of sleep?'
export const STEP_COUNT_TARGETS = [6000, 8000, 10000, 12000, 15000] as const
export const STEPS_GOAL_HEADING = 'How many steps is your goal?'
export const STEPS_GOAL_NOTE = 'A common day is about 10,000 steps.'

/**
 * Vitals with a fixed healthy range: we show it instead of asking.
 * Blood pressure: below 120/80 mmHg. Resting heart rate: 60–100 bpm.
 */
export function standardVitalTarget(templateId: string | null | undefined): string | null {
  if (templateId === 'blood_pressure') return 'start.bpTarget'
  if (templateId === 'heart_rate') return 'start.hrTarget'
  return null
}

/** Vitals whose edit screen only changes the target, never the name. */
export function isFixedVital(templateId: string | null | undefined): boolean {
  if (!templateId) return false
  return templateId === 'weight' || standardVitalTarget(templateId) != null || isDailyGoalHabit({ templateId })
}

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

type GoalAsk = {
  templateId?: string | null
  measure?: string | null
  recommended?: number | null
  goalSteps?: number[] | null
}

function stepsOr(activity: GoalAsk, fallback: readonly number[]): number[] {
  const custom = activity.goalSteps?.filter((step) => typeof step === 'number' && step > 0)
  return custom && custom.length > 0 ? custom : [...fallback]
}

export function gapHeading(activity: GoalAsk): string {
  if (isWaterHabit(activity) || activity.measure === 'glasses') return t('gap.water')
  if (isProteinHabit(activity)) return t('gap.protein')
  if (activity.measure === 'grams') return t('gap.grams')
  if (isFastingHabit(activity) || activity.measure === 'hours') return t('gap.fasting')
  if (isSleepHabit(activity) || activity.measure === 'sleep') return t('gap.sleep')
  if (isStepsHabit(activity) || activity.measure === 'steps') return t('gap.steps')
  return t('gap.when')
}

export function gapNote(activity: GoalAsk): string | null {
  if (isWaterHabit(activity) || activity.measure === 'glasses') return t('notes.waterGoal')
  if (isProteinHabit(activity)) return t('notes.protein')
  if (activity.measure === 'grams' && activity.recommended) {
    return t('notes.grams', { amount: String(activity.recommended) })
  }
  if (isFastingHabit(activity) || activity.measure === 'hours') return t('notes.fastingGoal')
  if (isSleepHabit(activity) || activity.measure === 'sleep') return t('notes.sleep')
  if (isStepsHabit(activity) || activity.measure === 'steps') return t('notes.steps')
  return null
}

export function gapOptionsFor(activity: GoalAsk) {
  if (isWaterHabit(activity)) return WATER_GAP_OPTIONS
  if (isProteinHabit(activity)) return PROTEIN_GAP_OPTIONS
  if (isFastingHabit(activity)) return FASTING_GAP_OPTIONS
  if (isSleepHabit(activity)) return SLEEP_GAP_OPTIONS
  if (isStepsHabit(activity)) return STEP_GAP_OPTIONS
  if (activity.measure === 'grams') {
    return stepsOr(activity, PROTEIN_GRAM_STEPS).map((grams) => ({
      id: `grams_${grams}`,
      label: proteinLabel(grams),
      grams,
      reassurance: '',
    }))
  }
  if (activity.measure === 'glasses') {
    return stepsOr(activity, WATER_GLASS_STEPS).map((glasses) => ({
      id: `glasses_${glasses}`,
      label: glassLabel(glasses),
      glasses,
      reassurance: '',
    }))
  }
  if (activity.measure === 'hours') {
    return stepsOr(activity, FASTING_HOUR_STEPS).map((hours) => ({
      id: `fasting_${hours}`,
      label: hourLabel(hours),
      hours,
      reassurance: '',
    }))
  }
  if (activity.measure === 'sleep') {
    return stepsOr(activity, SLEEP_HOUR_STEPS).map((hours) => ({
      id: `sleep_${hours}`,
      label: hourLabel(hours),
      hours,
      reassurance: '',
    }))
  }
  if (activity.measure === 'steps') {
    return stepsOr(activity, STEP_COUNT_TARGETS).map((count) => ({
      id: `steps_${count}`,
      label: stepCountLabel(count),
      count,
      reassurance: '',
    }))
  }
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
      secondary: option.glasses === 1 ? t('unit.glass') : t('unit.glasses'),
    }
  }
  if (option.grams != null) {
    return { primary: String(option.grams), secondary: t('unit.g') }
  }
  if (option.hours != null) {
    return {
      primary: String(option.hours),
      secondary: option.hours === 1 ? t('unit.hour') : t('unit.hours'),
    }
  }
  if (option.count != null) {
    const n = option.count
    const primary = n >= 1000 && n % 1000 === 0 ? `${n / 1000}k` : stepCountLabel(n)
    return { primary, secondary: t('unit.steps') }
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
  if (unit === 'g') return t('count.grams')
  if (unit === 'hours') return t('count.hours')
  if (unit === 'hr') return t('count.hour')
  if (done) return t('today.done')
  if (unit === 'glasses') return t('count.glass')
  return t('count.plus')
}

export function gapReassurance(id: string): string {
  const option = [...GAP_OPTIONS, ...WATER_GAP_OPTIONS, ...PROTEIN_GAP_OPTIONS, ...FASTING_GAP_OPTIONS, ...SLEEP_GAP_OPTIONS, ...STEP_GAP_OPTIONS].find(
    (item) => item.id === id,
  )
  if (!option) {
    if (id.startsWith('grams_')) {
      const grams = Number(id.slice('grams_'.length))
      if (grams > 0) return t('reassure.dailyGoal', { label: `${grams} ${t('unit.g')}` })
    }
    return ''
  }
  const key = `reassure.${id}`
  const hit = t(key)
  if (hit !== key) return hit
  const label =
    'glasses' in option && option.glasses != null
      ? `${option.glasses} ${t('unit.glasses')}`
      : 'grams' in option && option.grams != null
        ? `${option.grams} ${t('unit.g')}`
        : 'hours' in option && option.hours != null
          ? `${option.hours} ${t('unit.hours')}`
          : 'count' in option && option.count != null
            ? stepCountLabel(option.count)
            : option.label
  if (id.startsWith('sleep_')) return t('reassure.nightlyGoal', { label })
  if (id.startsWith('steps_')) return t('reassure.stepsGoal', { label })
  if (
    id.startsWith('glasses_') ||
    id.startsWith('protein_') ||
    id.startsWith('grams_') ||
    id.startsWith('fasting_')
  ) {
    return t('reassure.dailyGoal', { label })
  }
  return option.reassurance
}

/** Mornings 08:00, evenings 19:00, weekends 10:00, otherwise 19:00. */
export function defaultReminderTime(slip: readonly string[]): string {
  if (slip.includes('Mornings')) return '08:00'
  if (slip.includes('Evenings')) return '19:00'
  if (slip.includes('Weekends')) return '10:00'
  return '19:00'
}

export function continueLabel(count: number): string {
  return t('start.continueWith', { count })
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
  if (activity.templateId === 'relaxation') return null
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
  draft: Pick<GuestDraft, 'activities' | 'logs' | 'reminderTime' | 'reminderTimes' | 'reminderDeclined'> & {
    medicineDaily?: boolean
    medicines?: GuestDraft['medicines']
    reminders?: GuestDraft['reminders']
  },
): string {
  const count = draft.activities.length
  const medicineCount = MEDICINES_ENABLED
    ? (draft.medicines?.length ?? (draft.medicineDaily ? 1 : 0))
    : 0
  const reminderCount = draft.reminders?.filter((reminder) => reminder.doneAt == null).length ?? 0
  const parts = [
    ...(count === 0 ? [] : [count === 1 ? t('summary.habitOne') : t('summary.habitMany', { count })]),
    ...(medicineCount === 1
      ? [t('summary.medicine')]
      : medicineCount > 1
        ? [t('summary.medicineMany', { count: medicineCount })]
        : []),
    ...(reminderCount === 1
      ? [t('summary.reminderOne')]
      : reminderCount > 1
        ? [t('summary.reminderMany', { count: reminderCount })]
        : []),
  ]
  if (draft.logs.length > 0) parts.push(t('summary.resumed'))
  const times = draft.reminderTimes?.length
    ? draft.reminderTimes
    : draft.reminderTime
      ? [draft.reminderTime]
      : []
  if (times.length === 1) parts.push(t('summary.nudge', { time: formatReminderClock(times[0]) }))
  else if (times.length > 1) parts.push(t('summary.nudges', { count: times.length }))
  else if (draft.reminderDeclined) parts.push(t('summary.noNudges'))
  return parts.join(' · ')
}

/** Toggle a slip chip, never more than two. */
export function toggleSlip(current: readonly string[], chip: string): string[] {
  if (current.includes(chip)) return current.filter((item) => item !== chip)
  if (current.length >= 2) return [...current]
  return [...current, chip]
}
