import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACTIVITY_TEMPLATES, HABIT_GROUPS, activityInputFromTemplate, templateById } from '../../data/activityTemplates'
import { HABIT_ART, habitSizeArtFor } from '../../data/habitArt'
import { HabitIcon } from '../HabitIcon'
import { HabitMark } from '../HabitMark'
import { HabitVideoPlaceholder } from '../HabitVideoPlaceholder'
import { EmailSignInForm } from '../EmailSignInForm'
import { AUTH_PROVIDERS } from '../../lib/authProviders'
import { formatReminderClock } from '../../lib/checkinPrefs'
import { addDays, todayLocalDate } from '../../lib/dates'
import { parseTimeInput } from '../../lib/dailyDigest'
import { enableDailyDigestFromOnboarding } from '../../lib/localNotifications'
import {
  GUEST_MAX_ACTIVITIES,
  GUEST_MAX_MEDICINES,
  appendGuestLog,
  removeGuestActivity,
  saveGuestDraft,
  setGuestStep,
  upsertGuestActivity,
  type GuestActivity,
  type GuestDraft,
} from '../../lib/guestDraft'
import {
  WEEK_CADENCE,
  activitySizeControl,
  applyWeekCadence,
  durationChipParts,
  gapNote,
  habitSizeTagline,
  isDailyGoalHabit,
  isWaterHabit,
  needsSizeStep,
  sizeStepActivities,
  continueLabel,
  gapHeading,
  gapOptionsFor,
  gapOptionParts,
  gapReassurance,
  onboardingSummary,
  weekCadenceOf,
  type WeekCadence,
} from '../../lib/onboardingFlow'
import { catalogTrackId, groupTitle, templateLabel, visibleName } from '../../lib/catalogName'
import { applyHabitPlan, classifyHabitLocally, refineHabitKind } from '../../lib/habitKind'
import { track } from '../../lib/track'
import { useLocale } from '../../hooks/useLocale'
import { BrandTitle } from '../BrandTitle'
import { MedicineForm } from '../MedicineForm'
import { MedicineThumb } from '../MedicineThumb'
import { Icon } from '../Icon'

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `g-${Date.now()}`
}

const START_VITALS: { id: string; label: string; caption?: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'water', label: 'Water' },
  { id: 'sleep_hours', label: 'Sleep' },
  { id: 'fasting', label: 'Fasting' },
  { id: 'protein', label: 'Protein' },
  { id: 'blood_pressure', label: 'Blood Pressure' },
  { id: 'heart_rate', label: 'Heart Rate' },
]

/** Short first question. Explore more opens the rest of the catalog. */
const PRANAYAM_IDS = ['anuloma_viloma', 'kapalabhati', 'bhastrika', 'bhramari'] as const
const WORKOUT_IDS = ['walk', 'running', 'steps', 'exercise', 'stretching'] as const
const HEART_IDS = ['relaxation', 'meditate', 'rejuvenation', 'prayer'] as const
const VITAL_IDS = ['weight', 'blood_pressure', 'steps'] as const

const START_FEATURED: { id: string; labelKey: string }[] = [
  { id: 'walk', labelKey: 'start.featuredWalk' },
  { id: 'water', labelKey: 'start.featuredWater' },
  { id: 'stretching', labelKey: 'start.featuredExercise' },
  { id: 'anuloma_viloma', labelKey: 'start.featuredPranayam' },
  { id: 'reading', labelKey: 'start.featuredReading' },
]
const FEATURED_IDS = new Set(START_FEATURED.map((item) => item.id))
/** First visit asks for a few. Adding from Today can go past this. */
const START_PICK_MAX = 3
const PRACTICE_SECONDS = 120

function hasTimerHabit(draft: GuestDraft): boolean {
  return draft.activities.some((item) => item.trackingMode === 'timer')
}

function isPranayamTemplate(id: string | null | undefined): boolean {
  return id != null && (PRANAYAM_IDS as readonly string[]).includes(id)
}

function isWorkoutTemplate(id: string | null | undefined): boolean {
  return id != null && (WORKOUT_IDS as readonly string[]).includes(id)
}

function isHeartTemplate(id: string | null | undefined): boolean {
  return id != null && (HEART_IDS as readonly string[]).includes(id)
}

function isVitalTemplate(id: string | null | undefined): boolean {
  return id != null && (VITAL_IDS as readonly string[]).includes(id)
}

function selectedByIds(activities: GuestActivity[], ids: readonly string[]): GuestActivity[] {
  return ids.flatMap((id) => {
    const found = activities.find((item) => item.templateId === id)
    return found ? [found] : []
  })
}

function selectedPranayams(activities: GuestActivity[]): GuestActivity[] {
  return selectedByIds(activities, PRANAYAM_IDS)
}

function selectedWorkouts(activities: GuestActivity[]): GuestActivity[] {
  return selectedByIds(activities, WORKOUT_IDS)
}

function selectedHearts(activities: GuestActivity[]): GuestActivity[] {
  return selectedByIds(activities, HEART_IDS)
}

function selectedVitals(activities: GuestActivity[]): GuestActivity[] {
  return selectedByIds(activities, VITAL_IDS)
}

function targetActivities(activities: GuestActivity[]): GuestActivity[] {
  const list: GuestActivity[] = []
  const weight = activities.find((item) => item.templateId === 'weight')
  if (weight) list.push(weight)
  const steps = activities.find((item) => item.templateId === 'steps')
  if (steps && !(steps.targetValue != null && steps.targetValue > 0)) list.push(steps)
  return list
}

function initialTargetText(activity: GuestActivity): string {
  if (activity.targetValue != null && activity.targetValue > 0) return String(activity.targetValue)
  if (activity.templateId === 'steps') return '10000'
  return ''
}

function parseTarget(templateId: string | null, raw: string): number | null {
  const value = Number(raw.replace(/,/g, '').trim())
  if (!Number.isFinite(value) || value <= 0) return null
  if (templateId === 'steps') return Math.round(value)
  return Math.round(value * 10) / 10
}

function workoutDetailList(activities: GuestActivity[]): GuestActivity[] {
  return selectedWorkouts(activities).filter((item) => needsSizeStep(item))
}

function nonPranayamCount(activities: GuestActivity[]): number {
  return activities.filter(
    (item) =>
      !isPranayamTemplate(item.templateId) &&
      !isWorkoutTemplate(item.templateId) &&
      !isHeartTemplate(item.templateId) &&
      !isVitalTemplate(item.templateId),
  ).length
}

function pranayamCount(activities: GuestActivity[]): number {
  return activities.filter((item) => isPranayamTemplate(item.templateId)).length
}

function workoutCount(activities: GuestActivity[]): number {
  return activities.filter((item) => isWorkoutTemplate(item.templateId)).length
}

function heartCount(activities: GuestActivity[]): number {
  return activities.filter((item) => isHeartTemplate(item.templateId)).length
}

function vitalCount(activities: GuestActivity[]): number {
  return activities.filter((item) => isVitalTemplate(item.templateId)).length
}

/** Length and how often still to ask. Pranayam details are collected earlier. */
function pendingSizeActivities(activities: GuestActivity[]): GuestActivity[] {
  return sizeStepActivities(activities).filter((item) => !item.sized)
}

/** Relaxation is checked off. It does not keep a minute target. */
function withoutRelaxationTiming(activity: GuestActivity): GuestActivity {
  if (activity.templateId !== 'relaxation') return activity
  return { ...activity, trackingMode: 'checkbox', targetValue: null, targetUnit: null }
}

function listedMinutes(activity: GuestActivity): GuestActivity {
  const plain = withoutRelaxationTiming(activity)
  if (plain !== activity) return plain
  const control = activitySizeControl(activity)
  if (!control || activity.targetValue == null || control.steps.includes(activity.targetValue)) return activity
  const target = activity.targetValue
  const nearest = control.steps.reduce((best, step) =>
    Math.abs(step - target) < Math.abs(best - target) ? step : best,
  )
  return withSize(activity, nearest)
}

/** Medicine, Pranayam, Workout, Heartfulness, Vitals, Reminder, Save. */
const WELCOME_QUESTIONS = 7

/** One dot per welcome question. Follow-up screens stay on their question's dot. */
function welcomeQuestion(draft: GuestDraft): number {
  if (draft.step === 8) return 6
  if (draft.step !== 1) return 5
  switch (draft.pickPhase) {
    case 'pranayam':
    case 'pranayams':
    case 'pranayamDetail':
      return 1
    case 'workout':
    case 'workouts':
    case 'workoutDetail':
    case 'stepGoal':
      return 2
    case 'heartfulness':
    case 'practices':
    case 'practiceDetail':
      return 3
    case 'vitals':
    case 'vitalPicks':
    case 'targets':
    case 'activities':
      return 4
    default:
      return 0
  }
}

function currentSize(activity: GuestActivity): number {
  const control = activitySizeControl(activity)
  const fallback = control?.steps[0] ?? 1
  return activity.targetValue ?? fallback
}

function withSize(activity: GuestActivity, value: number): GuestActivity {
  if (!activitySizeControl(activity)) return activity
  if (isWaterHabit(activity) || activity.targetUnit === 'glasses') {
    return { ...activity, targetValue: value, targetUnit: 'glasses' }
  }
  if (activity.trackingMode === 'count') return { ...activity, targetValue: value, targetUnit: null }
  return { ...activity, targetValue: value, targetUnit: 'minutes' }
}

function blobToDataUrl(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : null)
    reader.onerror = () => resolve(null)
    reader.readAsDataURL(blob)
  })
}

function choiceCode(ids: string[]): string {
  return ids.slice(0, 8).join(',').slice(0, 80)
}

export function StartFlow({
  draft,
  onDraft,
  onGoogle,
  adding = false,
  addingMedicine = false,
}: {
  draft: GuestDraft
  onDraft: (draft: GuestDraft) => void
  onGoogle: () => Promise<void>
  adding?: boolean
  /** One more bottle from the Vitals tab, then back to that tab. */
  addingMedicine?: boolean
}) {
  const navigate = useNavigate()
  const { locale, t } = useLocale()
  const [gapIndex, setGapIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
  const [pranayamIndex, setPranayamIndex] = useState(0)
  const [workoutIndex, setWorkoutIndex] = useState(0)
  const [heartIndex, setHeartIndex] = useState(0)
  const [targetIndex, setTargetIndex] = useState(0)
  const [targetText, setTargetText] = useState('')
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [typeError, setTypeError] = useState(false)
  const [exploreMore, setExploreMore] = useState(false)
  const [reassurance, setReassurance] = useState<string | null>(null)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [nudgeTimes, setNudgeTimes] = useState<string[]>(() => {
    if (draft.reminderTimes?.length) return draft.reminderTimes
    return [draft.reminderTime ?? '19:00']
  })
  const gapTimer = useRef<number | null>(null)
  const draftRef = useRef(draft)
  draftRef.current = draft
  const keptIds = useRef<Set<string> | null>(adding ? new Set(draft.activities.map((item) => item.localId)) : null)
  const [practiceOn, setPracticeOn] = useState(false)
  const [practiceElapsed, setPracticeElapsed] = useState(0)
  const [practicePaused, setPracticePaused] = useState(false)
  const practiceStarted = useRef<string | null>(null)
  const practiceTick = useRef<number | null>(null)
  const practiceDone = useRef(false)

  useEffect(() => {
    return () => {
      if (gapTimer.current != null) window.clearTimeout(gapTimer.current)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    document.querySelector('.landing')?.scrollTo?.(0, 0)
    document.querySelector('.start-flow')?.scrollIntoView?.({ block: 'start' })
  }, [draft.step, draft.pickPhase, pranayamIndex, workoutIndex, heartIndex, targetIndex, adding, customOpen])

  useEffect(() => {
    const key = `resuming-onboarding-started-${draft.guestId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* ignore */
    }
    track('onboarding_started')
  }, [draft.guestId])

  useEffect(() => {
    if (draft.step !== 8) return
    track('signin_shown')
  }, [draft.step])

  function persist(next: GuestDraft) {
    onDraft(next)
  }

  function finishStep(step: number, choices: string, next: GuestDraft) {
    track('onboarding_step_completed', { step, choices })
    persist(next)
  }

  function go(step: number, base: GuestDraft = draft) {
    persist(setGuestStep(base, step))
  }

  const gapActivity = draft.activities[gapIndex]

  function toggleTemplate(id: string) {
    const existing = draft.activities.find((item) => item.templateId === id)
    if (existing) {
      if (adding && keptIds.current?.has(existing.localId)) return
      persist(removeGuestActivity(draft, existing.localId))
      return
    }
    if (adding) {
      if (draft.activities.length >= GUEST_MAX_ACTIVITIES) return
    } else if (isPranayamTemplate(id)) {
      if (pranayamCount(draft.activities) >= PRANAYAM_IDS.length) return
    } else if (isWorkoutTemplate(id)) {
      if (workoutCount(draft.activities) >= WORKOUT_IDS.length) return
    } else if (isHeartTemplate(id)) {
      if (heartCount(draft.activities) >= HEART_IDS.length) return
    } else if (isVitalTemplate(id)) {
      if (vitalCount(draft.activities) >= VITAL_IDS.length) return
    } else if (nonPranayamCount(draft.activities) >= START_PICK_MAX) return
    const template = ACTIVITY_TEMPLATES.find((item) => item.id === id)
    if (!template) return
    const input = activityInputFromTemplate(template, 'tiny')
    const deadline = template.type === 'deadline' ? addDays(todayLocalDate(), 14) : null
    // Goal habits ask for an amount next — leave blank until they choose.
    const goalHabit = isDailyGoalHabit({ templateId: template.id })
    persist(
      upsertGuestActivity(draft, {
        localId: newLocalId(),
        name: input.name,
        emoji: input.emoji,
        type: input.type,
        trackingMode: input.trackingMode,
        targetValue: goalHabit ? null : input.targetValue,
        targetUnit: input.targetUnit,
        weeklyTarget: input.weeklyTarget,
        deadline,
        templateId: template.id,
        why: null,
        usuallyWhen: null,
      }),
    )
    track('activity_created', {
      template_id: catalogTrackId(template.id),
      type: template.type,
      tracking: template.trackingMode,
      signed_in: false,
    })
  }

  function acceptPranayam() {
    if (draft.activities.some((item) => item.templateId === 'anuloma_viloma')) {
      persist({ ...draft, pickPhase: 'pranayams' })
      return
    }
    const template = ACTIVITY_TEMPLATES.find((item) => item.id === 'anuloma_viloma')
    if (!template) return
    const input = activityInputFromTemplate(template, 'tiny')
    const next = upsertGuestActivity(draft, {
      localId: newLocalId(),
      name: input.name,
      emoji: input.emoji,
      type: input.type,
      trackingMode: input.trackingMode,
      targetValue: input.targetValue,
      targetUnit: input.targetUnit,
      weeklyTarget: input.weeklyTarget,
      deadline: null,
      templateId: template.id,
      why: null,
      usuallyWhen: null,
    })
    persist({ ...next, pickPhase: 'pranayams' })
    track('activity_created', {
      template_id: catalogTrackId(template.id),
      type: template.type,
      tracking: template.trackingMode,
      signed_in: false,
    })
  }

  function declinePranayam() {
    const next = draft.activities.reduce((current, activity) => {
      if (!activity.templateId || !PRANAYAM_IDS.includes(activity.templateId as (typeof PRANAYAM_IDS)[number])) {
        return current
      }
      return removeGuestActivity(current, activity.localId)
    }, draft)
    persist({ ...next, pickPhase: 'workout' })
  }

  function continuePranayams() {
    const list = selectedPranayams(draft.activities)
    if (list.length === 0) {
      persist({ ...draft, pickPhase: 'workout' })
      return
    }
    const snapped = list.reduce(
      (current, activity) => upsertGuestActivity(current, listedMinutes(activity)),
      draft,
    )
    setPranayamIndex(0)
    persist({ ...snapped, pickPhase: 'pranayamDetail' })
  }

  function advancePranayamDetail() {
    const list = selectedPranayams(draft.activities)
    const current = list[pranayamIndex]
    const nextDraft = current ? upsertGuestActivity(draft, { ...current, sized: true }) : draft
    if (pranayamIndex + 1 < list.length) {
      setPranayamIndex(pranayamIndex + 1)
      persist({ ...nextDraft, pickPhase: 'pranayamDetail' })
      return
    }
    persist({ ...nextDraft, pickPhase: 'workout' })
  }

  function backPranayamDetail() {
    if (pranayamIndex > 0) {
      setPranayamIndex(pranayamIndex - 1)
      return
    }
    persist({ ...draft, pickPhase: 'pranayams' })
  }

  function acceptWorkout() {
    persist({ ...draft, pickPhase: 'workouts' })
  }

  function declineWorkout() {
    const next = draft.activities.reduce((current, activity) => {
      if (!activity.templateId || !WORKOUT_IDS.includes(activity.templateId as (typeof WORKOUT_IDS)[number])) {
        return current
      }
      return removeGuestActivity(current, activity.localId)
    }, draft)
    persist({ ...next, pickPhase: 'heartfulness' })
  }

  function openWorkoutDetails(base: GuestDraft) {
    const list = workoutDetailList(base.activities)
    if (list.length === 0) {
      persist({ ...base, pickPhase: 'heartfulness' })
      return
    }
    const snapped = list.reduce(
      (current, activity) => upsertGuestActivity(current, listedMinutes(activity)),
      base,
    )
    setWorkoutIndex(0)
    persist({ ...snapped, pickPhase: 'workoutDetail' })
  }

  function continueWorkouts() {
    const chosen = selectedWorkouts(draft.activities)
    if (chosen.length === 0) {
      persist({ ...draft, pickPhase: 'heartfulness' })
      return
    }
    const steps = chosen.find((item) => item.templateId === 'steps')
    if (steps) {
      setTargetText(initialTargetText(steps))
      persist({ ...draft, pickPhase: 'stepGoal' })
      return
    }
    openWorkoutDetails(draft)
  }

  function continueStepGoal() {
    const steps = draft.activities.find((item) => item.templateId === 'steps')
    const value = parseTarget('steps', targetText)
    if (!steps || value == null) return
    const next = upsertGuestActivity(draft, { ...steps, targetValue: value, targetUnit: 'steps' })
    openWorkoutDetails(next)
  }

  function advanceWorkoutDetail() {
    const list = workoutDetailList(draft.activities)
    const current = list[workoutIndex]
    const nextDraft = current ? upsertGuestActivity(draft, { ...current, sized: true }) : draft
    if (workoutIndex + 1 < list.length) {
      setWorkoutIndex(workoutIndex + 1)
      persist({ ...nextDraft, pickPhase: 'workoutDetail' })
      return
    }
    persist({ ...nextDraft, pickPhase: 'heartfulness' })
  }

  function backWorkoutDetail() {
    if (workoutIndex > 0) {
      setWorkoutIndex(workoutIndex - 1)
      return
    }
    const steps = draft.activities.find((item) => item.templateId === 'steps')
    if (steps) {
      setTargetText(initialTargetText(steps))
      persist({ ...draft, pickPhase: 'stepGoal' })
      return
    }
    persist({ ...draft, pickPhase: 'workouts' })
  }

  function acceptHeartfulness() {
    persist({ ...draft, pickPhase: 'practices' })
  }

  function declineHeartfulness() {
    const next = draft.activities.reduce((current, activity) => {
      if (!activity.templateId || !HEART_IDS.includes(activity.templateId as (typeof HEART_IDS)[number])) {
        return current
      }
      return removeGuestActivity(current, activity.localId)
    }, draft)
    persist({ ...next, pickPhase: 'vitals' })
  }

  function continuePractices() {
    const list = selectedHearts(draft.activities)
    if (list.length === 0) {
      persist({ ...draft, pickPhase: 'vitals' })
      return
    }
    const snapped = list.reduce(
      (current, activity) => upsertGuestActivity(current, listedMinutes(activity)),
      draft,
    )
    setHeartIndex(0)
    persist({ ...snapped, pickPhase: 'practiceDetail' })
  }

  function advancePracticeDetail() {
    const list = selectedHearts(draft.activities)
    const current = list[heartIndex]
    const nextDraft = current
      ? upsertGuestActivity(draft, { ...withoutRelaxationTiming(current), sized: true })
      : draft
    if (heartIndex + 1 < list.length) {
      setHeartIndex(heartIndex + 1)
      persist({ ...nextDraft, pickPhase: 'practiceDetail' })
      return
    }
    persist({ ...nextDraft, pickPhase: 'vitals' })
  }

  function backPracticeDetail() {
    if (heartIndex > 0) {
      setHeartIndex(heartIndex - 1)
      return
    }
    persist({ ...draft, pickPhase: 'practices' })
  }

  function acceptVitals() {
    persist({ ...draft, pickPhase: 'vitalPicks' })
  }

  function finishVitals(base: GuestDraft) {
    const list = targetActivities(base.activities)
    if (list.length === 0) {
      persist(setGuestStep(base, 4))
      return
    }
    setTargetIndex(0)
    setTargetText(initialTargetText(list[0]))
    persist(setGuestStep({ ...base, pickPhase: 'targets' }, 1))
  }

  function declineVitals() {
    const next = draft.activities.reduce((current, activity) => {
      if (activity.templateId !== 'weight' && activity.templateId !== 'blood_pressure') return current
      return removeGuestActivity(current, activity.localId)
    }, draft)
    finishVitals(next)
  }

  function continueVitals() {
    finishVitals(draft)
  }

  function saveCurrentTarget(base: GuestDraft): GuestDraft {
    const list = targetActivities(base.activities)
    const current = list[targetIndex]
    if (!current) return base
    const value = parseTarget(current.templateId, targetText)
    if (value == null) return base
    const targetUnit = current.templateId === 'weight' ? 'kg' : current.templateId === 'steps' ? 'steps' : current.targetUnit
    return upsertGuestActivity(base, { ...current, targetValue: value, targetUnit })
  }

  function advanceTarget() {
    const nextDraft = saveCurrentTarget(draft)
    const list = targetActivities(nextDraft.activities)
    if (targetIndex + 1 < list.length) {
      const upcoming = list[targetIndex + 1]
      setTargetIndex(targetIndex + 1)
      setTargetText(upcoming ? initialTargetText(upcoming) : '')
      persist({ ...nextDraft, pickPhase: 'targets' })
      return
    }
    persist(
      setGuestStep(
        {
          ...nextDraft,
          pickPhase: selectedVitals(nextDraft.activities).length > 0 ? 'vitalPicks' : 'vitals',
        },
        4,
      ),
    )
  }

  function backTarget() {
    const list = targetActivities(draft.activities)
    if (targetIndex > 0) {
      const previous = list[targetIndex - 1]
      setTargetIndex(targetIndex - 1)
      setTargetText(previous ? initialTargetText(previous) : '')
      return
    }
    persist({
      ...draft,
      pickPhase: selectedVitals(draft.activities).length > 0 ? 'vitalPicks' : 'vitals',
    })
  }

  function selectionFull(templateId: string | null, selected: boolean): boolean {
    if (selected) return false
    if (adding) return draft.activities.length >= GUEST_MAX_ACTIVITIES
    if (isPranayamTemplate(templateId)) return pranayamCount(draft.activities) >= PRANAYAM_IDS.length
    if (isWorkoutTemplate(templateId)) return workoutCount(draft.activities) >= WORKOUT_IDS.length
    if (isHeartTemplate(templateId)) return heartCount(draft.activities) >= HEART_IDS.length
    if (isVitalTemplate(templateId)) return vitalCount(draft.activities) >= VITAL_IDS.length
    return nonPranayamCount(draft.activities) >= START_PICK_MAX
  }

  function refineTypedHabit(localId: string, name: string) {
    void refineHabitKind(name).then((nextPlan) => {
      if (!nextPlan) return
      const apply = () => {
        const current = draftRef.current
        const item = current.activities.find((activity) => activity.localId === localId)
        if (!item || current.gapAnswer[localId] || current.step > 2) return
        if (
          item.measure === nextPlan.measure &&
          item.recommended === nextPlan.recommended &&
          JSON.stringify(item.goalSteps ?? []) === JSON.stringify(nextPlan.goalSteps)
        ) {
          return
        }
        const updated = applyHabitPlan(item, nextPlan)
        persist(upsertGuestActivity(current, updated))
      }
      if (draftRef.current.activities.some((activity) => activity.localId === localId)) apply()
      else window.setTimeout(apply, 0)
    })
  }

  function draftWithTypedHabit(base: GuestDraft): GuestDraft {
    const name = customName.trim()
    if (!name) return base
    if (!classifyHabitLocally(name).confident) return base
    const counted = adding ? base.activities.length : nonPranayamCount(base.activities)
    const pickMax = adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX
    if (counted >= pickMax) return base
    const localId = newLocalId()
    const habitPlan = classifyHabitLocally(name)
    refineTypedHabit(localId, name)
    return upsertGuestActivity(
      base,
      applyHabitPlan(
        {
          localId,
          name,
          emoji: habitPlan.emoji,
          type: 'daily',
          trackingMode: habitPlan.trackingMode,
          targetValue: habitPlan.targetValue,
          targetUnit: habitPlan.targetUnit,
          weeklyTarget: null,
          deadline: null,
          templateId: null,
          why: null,
          usuallyWhen: null,
        },
        habitPlan,
      ),
    )
  }

  function addCustomHabit() {
    const name = customName.trim()
    const habitPlan = name ? classifyHabitLocally(name) : null
    if (name && habitPlan && !habitPlan.confident) {
      setTypeError(true)
      return
    }
    setTypeError(false)
    const next = draftWithTypedHabit(draft)
    if (next === draft) return
    setCustomName('')
    setCustomOpen(false)
    persist(next)
    track('activity_created', {
      template_id: 'custom',
      type: 'daily',
      tracking: habitPlan?.trackingMode ?? 'timer',
      signed_in: false,
    })
  }

  const typedNameCounts =
    customName.trim() !== '' && classifyHabitLocally(customName).confident

  function continueFromPick() {
    const name = customName.trim()
    const habitPlan = name ? classifyHabitLocally(name) : null
    if (name && habitPlan && !habitPlan.confident) {
      setTypeError(true)
      if (draft.activities.length === 0) return
    } else {
      setTypeError(false)
    }
    const next = draftWithTypedHabit(draft)
    if (next.activities.length === 0) {
      if (adding || !next.medicineDaily) return
      finishStep(1, 'medicine', draftAfterPick(next))
      return
    }
    if (next !== draft) {
      setCustomName('')
      track('activity_created', {
        template_id: 'custom',
        type: 'daily',
        tracking: habitPlan?.trackingMode ?? 'timer',
        signed_in: false,
      })
    }
    if (adding) {
      const added = next.activities.some((item) => !keptIds.current?.has(item.localId))
      if (!added) return
      finishStep(1, choiceCode(next.activities.map((item) => item.templateId ?? 'custom')), next)
      navigate('/today')
      return
    }
    finishStep(
      1,
      choiceCode(next.activities.map((item) => item.templateId ?? 'custom')),
      draftAfterPick(next),
    )
  }

  function stepAfterSetup(base: GuestDraft): number {
    return hasTimerHabit(base) ? 5 : 4
  }

  function hasSizeStep(base: GuestDraft): boolean {
    return pendingSizeActivities(base.activities).length > 0
  }

  function enterSizeStep(base: GuestDraft): GuestDraft {
    setSizeIndex(0)
    return setGuestStep(base, 3)
  }

  function draftAfterGoals(base: GuestDraft): GuestDraft {
    if (hasSizeStep(base)) return enterSizeStep(base)
    return base
  }

  function finishGoals(base: GuestDraft, choices: string) {
    const next = draftAfterGoals(base)
    if (hasSizeStep(next)) {
      finishStep(2, choices, next)
      return
    }
    finishStep(2, choices, setGuestStep(next, stepAfterSetup(next)))
  }

  function draftAfterPick(base: GuestDraft): GuestDraft {
    if (base.activities.some(isDailyGoalHabit)) return setGuestStep(base, 2)
    if (hasSizeStep(base)) return enterSizeStep(base)
    return setGuestStep(base, stepAfterSetup(base))
  }

  function advanceSizeStep() {
    const list = pendingSizeActivities(draft.activities)
    const current = list[sizeIndex]
    if (sizeIndex + 1 < list.length) {
      track('onboarding_step_completed', {
        step: 3,
        choices: current?.templateId ?? current?.name ?? 'sized',
      })
      setSizeIndex(sizeIndex + 1)
      return
    }
    finishStep(3, 'sized', setGuestStep(draft, stepAfterSetup(draft)))
  }

  function pickGap(id: string) {
    if (!gapActivity) return
    const option = gapOptionsFor(gapActivity).find((item) => item.id === id)
    const glasses = option && 'glasses' in option ? option.glasses : undefined
    const grams = option && 'grams' in option ? option.grams : undefined
    const hours = option && 'hours' in option ? option.hours : undefined
    const stepCount = option && 'count' in option ? option.count : undefined
    const activities =
      glasses == null && grams == null && hours == null && stepCount == null
        ? draft.activities
        : draft.activities.map((item) => {
            if (item.localId !== gapActivity.localId) return item
            if (glasses != null) return { ...item, targetValue: glasses, targetUnit: 'glasses' as const }
            if (grams != null) return { ...item, targetValue: grams, targetUnit: 'g' as const }
            if (stepCount != null) return { ...item, targetValue: stepCount, targetUnit: 'steps' as const }
            if (hours == null) return item
            const unit = item.measure === 'sleep' || item.targetUnit === 'hr' || item.templateId === 'sleep_hours' ? 'hr' as const : 'hours' as const
            return { ...item, targetValue: hours, targetUnit: unit }
          })
    const next = saveGuestDraft({
      ...draft,
      activities,
      gapAnswer: { ...draft.gapAnswer, [gapActivity.localId]: id },
    })
    persist(next)
    setReassurance(gapReassurance(id))
    if (gapTimer.current != null) window.clearTimeout(gapTimer.current)
    gapTimer.current = window.setTimeout(() => {
      gapTimer.current = null
      setReassurance(null)
      if (gapIndex + 1 < next.activities.length) {
        const nextGoal = next.activities.findIndex((item, index) => index > gapIndex && isDailyGoalHabit(item))
        if (nextGoal >= 0) setGapIndex(nextGoal)
        else finishGoals(next, choiceCode(Object.values(next.gapAnswer)))
      } else finishGoals(next, choiceCode(Object.values(next.gapAnswer)))
    }, 1200)
  }

  function setActivitySize(localId: string, value: number) {
    const current = draft.activities.find((item) => item.localId === localId)
    if (!current) return
    persist(upsertGuestActivity(draft, withSize(current, value)))
  }

  function setWeekCadence(localId: string, cadence: WeekCadence) {
    const current = draft.activities.find((item) => item.localId === localId)
    if (!current) return
    persist(upsertGuestActivity(draft, applyWeekCadence(current, cadence)))
  }

  function openTodayAfterReminder(accepted: boolean) {
    let next = draft
    if (accepted) {
      const times = (nudgeTimes.length > 0 ? nudgeTimes : ['19:00'])
        .map((time) => time || '19:00')
        .filter((time, index, list) => list.indexOf(time) === index)
        .slice(0, 5)
      const first = times[0] ?? '19:00'
      track('onboarding_reminder_set', { time: first, count: times.length })
      next = saveGuestDraft({
        ...draft,
        reminderTimes: times,
        reminderTime: first,
        reminderDeclined: false,
      })
      const slots = times
        .map((time) => parseTimeInput(time))
        .filter((time): time is NonNullable<typeof time> => time != null)
      if (slots.length > 0) {
        void enableDailyDigestFromOnboarding(slots).catch(() => {
          /* permission can wait until Settings */
        })
      }
    } else {
      track('onboarding_reminder_set', { time: 'none' })
      next = saveGuestDraft({
        ...draft,
        reminderTimes: [],
        reminderTime: null,
        reminderDeclined: true,
      })
    }
    persist(setGuestStep(next, 8))
  }

  useEffect(() => {
    if (draft.step !== 2) return
    const goalAt = draft.activities.findIndex(isDailyGoalHabit)
    if (goalAt < 0) return
    if (!isDailyGoalHabit(draft.activities[gapIndex] ?? { templateId: null })) setGapIndex(goalAt)
  }, [draft.step, draft.activities, gapIndex])

  useEffect(() => {
    if (draft.step !== 3) return
    const list = pendingSizeActivities(draft.activities)
    if (list.length === 0) {
      persist(setGuestStep(draft, stepAfterSetup(draft)))
      return
    }
    if (sizeIndex >= list.length) setSizeIndex(list.length - 1)
  }, [draft.step, draft.activities, sizeIndex])

  useEffect(() => {
    if (draft.pickPhase !== 'pranayamDetail' || adding) return
    const list = selectedPranayams(draft.activities)
    if (list.length === 0) {
      persist({ ...draft, pickPhase: 'workout' })
      return
    }
    if (pranayamIndex >= list.length) setPranayamIndex(list.length - 1)
  }, [draft.pickPhase, draft.activities, pranayamIndex, adding])

  useEffect(() => {
    if (draft.pickPhase !== 'workoutDetail' || adding) return
    const list = workoutDetailList(draft.activities)
    if (list.length === 0) {
      persist({ ...draft, pickPhase: 'heartfulness' })
      return
    }
    if (workoutIndex >= list.length) setWorkoutIndex(list.length - 1)
  }, [draft.pickPhase, draft.activities, workoutIndex, adding])

  useEffect(() => {
    if (draft.pickPhase !== 'practiceDetail' || adding) return
    const list = selectedHearts(draft.activities)
    if (list.length === 0) {
      persist({ ...draft, pickPhase: 'vitals' })
      return
    }
    if (heartIndex >= list.length) setHeartIndex(list.length - 1)
  }, [draft.pickPhase, draft.activities, heartIndex, adding])

  useEffect(() => {
    if (draft.pickPhase !== 'targets' || adding) return
    const list = targetActivities(draft.activities)
    if (list.length === 0) {
      // Steps leaves this list once its goal is saved. Stepping again would
      // write a new draft forever and freeze the page.
      if (draft.step !== 4) {
        persist(
          setGuestStep(
            {
              ...draft,
              pickPhase: selectedVitals(draft.activities).length > 0 ? 'vitalPicks' : 'vitals',
            },
            4,
          ),
        )
      }
      return
    }
    if (targetIndex >= list.length) setTargetIndex(list.length - 1)
  }, [draft.pickPhase, draft.activities, draft.step, targetIndex, adding])

  const sizeActivities = pendingSizeActivities(draft.activities)
  const pranayamQueue = selectedPranayams(draft.activities)
  const workoutQueue = selectedWorkouts(draft.activities)
  const heartQueue = selectedHearts(draft.activities)
  const detailingPranayam =
    draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'pranayamDetail'
  const detailingWorkout =
    draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'workoutDetail'
  const detailingHeart =
    draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'practiceDetail'
  const detailing = detailingPranayam || detailingWorkout || detailingHeart
  const detailActivity = detailingPranayam
    ? (pranayamQueue[pranayamIndex] ?? null)
    : detailingWorkout
      ? (workoutQueue[workoutIndex] ?? null)
      : detailingHeart
        ? (heartQueue[heartIndex] ?? null)
        : null
  const sizeActivity = detailActivity ?? (draft.step === 3 ? (sizeActivities[sizeIndex] ?? null) : null)
  const sizeControl = sizeActivity ? activitySizeControl(sizeActivity) : null
  const sizeValue = sizeActivity && sizeControl ? currentSize(sizeActivity) : null
  const sizeCadence = sizeActivity ? weekCadenceOf(sizeActivity) : null
  const sizeArt = sizeActivity ? habitSizeArtFor(sizeActivity) : null
  const question = welcomeQuestion(draft)
  const continueCount =
    (adding
      ? draft.activities.filter((item) => !keptIds.current?.has(item.localId)).length
      : draft.activities.length) +
    (typedNameCounts ? 1 : 0) +
    (!adding && draft.medicineDaily ? 1 : 0)
  const practiceActivity = draft.activities.find((item) => item.trackingMode === 'timer') ?? null
  const resumedToday = practiceActivity
    ? draft.logs.some((log) => log.kind !== 'count' && log.localActivityId === practiceActivity.localId)
    : false

  useEffect(() => {
    if (!practiceOn || practicePaused) return
    practiceTick.current = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const delta = practiceTick.current ? (now - practiceTick.current) / 1000 : 0
      practiceTick.current = now
      setPracticeElapsed((prev) => prev + delta)
    }, 250)
    return () => window.clearInterval(id)
  }, [practiceOn, practicePaused])

  useEffect(() => {
    if (!practiceOn || practiceElapsed < PRACTICE_SECONDS || practiceDone.current) return
    practiceDone.current = true
    finishPractice(PRACTICE_SECONDS)
    // finishPractice reads the latest draft from the render that crossed two minutes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceOn, practiceElapsed])

  function finishPractice(seconds: number) {
    const activity = draft.activities.find((item) => item.trackingMode === 'timer')
    const whole = Math.max(0, Math.floor(seconds))
    let next = draft
    if (activity && whole >= 30 && practiceStarted.current) {
      next = appendGuestLog(draft, {
        localActivityId: activity.localId,
        startedAt: practiceStarted.current,
        durationSeconds: whole,
        date: todayLocalDate(),
      })
      track('onboarding_timer_completed', { seconds: whole })
    } else {
      track('onboarding_timer_skipped')
    }
    setPracticeOn(false)
    setPracticePaused(false)
    setPracticeElapsed(0)
    persist(setGuestStep(next, 6))
  }

  function beginPractice() {
    practiceDone.current = false
    practiceStarted.current = new Date().toISOString()
    setPracticeElapsed(0)
    setPracticePaused(false)
    setPracticeOn(true)
    track('onboarding_timer_started')
  }

  useEffect(() => {
    if (draft.step !== 2 || draft.activities.some(isDailyGoalHabit)) return
    const next = draftAfterGoals(draft)
    if (hasSizeStep(next)) {
      persist(next)
      return
    }
    persist(setGuestStep(draft, stepAfterSetup(draft)))
    // Skip the removed "when did you last" question. Daily amounts still use this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.step, draft.activities])

  if (addingMedicine) {
    return (
      <div className="start-flow">
        <div className="brand-line">
          <BrandTitle className="app-title" />
        </div>
        <MedicineForm
          initial={null}
          saving={false}
          error={null}
          onCancel={() => navigate('/numbers')}
          onSubmit={async (input) => {
            const photo = input.photo ? await blobToDataUrl(input.photo) : null
            persist({
              ...draft,
              medicineDaily: true,
              medicines: [
                ...draft.medicines,
                {
                  name: input.name.trim(),
                  weekdays: input.weekdays,
                  times: input.times,
                  ...(input.system ? { system: input.system } : {}),
                  ...(photo ? { photo } : {}),
                },
              ].slice(0, GUEST_MAX_MEDICINES),
            })
            navigate('/numbers')
          }}
        />
      </div>
    )
  }

  return (
    <div className="start-flow">
      <div className="brand-line">
        <BrandTitle className="app-title" />
      </div>
      {!adding && (
        <div className="onboarding-dots" aria-label={`Step ${question + 1} of ${WELCOME_QUESTIONS}`}>
          {Array.from({ length: WELCOME_QUESTIONS }, (_, index) => (
            <span
              key={index}
              className={index === question ? 'onboarding-dot onboarding-dot-active' : 'onboarding-dot'}
            />
          ))}
        </div>
      )}

      {draft.step > 1 && (
        <button
          type="button"
          className="btn btn-ghost start-back"
          onClick={() => {
            if (draft.step === 5 && practiceOn) {
              setPracticeOn(false)
              setPracticePaused(false)
              setPracticeElapsed(0)
              return
            }
            if (draft.step === 3 && sizeIndex > 0) {
              setSizeIndex(sizeIndex - 1)
              return
            }
            if (!adding && draft.step === 4) {
              const targets = targetActivities(draft.activities)
              if (targets.length > 0) {
                const last = targets.length - 1
                setTargetIndex(last)
                setTargetText(initialTargetText(targets[last]))
                persist(setGuestStep({ ...draft, pickPhase: 'targets' }, 1))
                return
              }
              persist(
                setGuestStep(
                  {
                    ...draft,
                    pickPhase: selectedVitals(draft.activities).length > 0 ? 'vitalPicks' : 'vitals',
                  },
                  1,
                ),
              )
              return
            }
            let previous = draft.step - 1
            if (draft.step === 8) previous = 4
            else if (draft.step === 4) previous = hasTimerHabit(draft) ? 6 : hasSizeStep(draft) ? 3 : draft.activities.some(isDailyGoalHabit) ? 2 : 1
            else if (draft.step === 6) previous = 5
            else if (draft.step === 5) previous = hasSizeStep(draft) ? 3 : draft.activities.some(isDailyGoalHabit) ? 2 : 1
            else if (previous === 3 && !hasSizeStep(draft)) previous = draft.activities.some(isDailyGoalHabit) ? 2 : 1
            else if (previous === 2 && !draft.activities.some(isDailyGoalHabit)) previous = 1
            if (previous === 3) setSizeIndex(Math.max(0, pendingSizeActivities(draft.activities).length - 1))
            go(previous)
          }}
        >
          <Icon name="back" />
          {t('start.back')}
        </button>
      )}

      {draft.step === 1 && customOpen && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => {
              setCustomOpen(false)
              setCustomName('')
            }}
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">{t('start.createTitle')}</h1>
          <p className="screen-sub">{t('start.createSub')}</p>
          <label className="field">
            <span className="field-label">{t('start.name')}</span>
            <input
              className="field-input"
              value={customName}
              onChange={(event) => setCustomName(event.target.value)}
              placeholder={t('start.namePlaceholder')}
              autoFocus
              maxLength={60}
            />
          </label>
          <div className="start-flow-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                !customName.trim() ||
                (adding
                  ? draft.activities.length >= GUEST_MAX_ACTIVITIES
                  : nonPranayamCount(draft.activities) >= START_PICK_MAX)
              }
              onClick={addCustomHabit}
            >
              {t('start.continue')}
            </button>
          </div>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'ask' && (
        <>
          <h1 className="screen-heading">{t('start.pick')}</h1>
          <p className="screen-sub">{t('start.pickSub')}</p>
          <h2 className="screen-heading start-medicine-title">{t('start.medicineBody')}</h2>
          <div className="start-yes-no">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() =>
                persist({
                  ...draft,
                  pickPhase: draft.medicines.length > 0 ? 'medicines' : 'medicine',
                  medicineDaily: true,
                })
              }
            >
              {t('landing.yes')}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                persist({ ...draft, pickPhase: 'pranayam', medicineDaily: false, medicines: [] })
              }
            >
              {t('start.no')}
            </button>
          </div>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'medicine' && (
        <MedicineForm
          key={draft.medicines.length}
          initial={null}
          saving={false}
          error={null}
          onCancel={() =>
            persist({ ...draft, pickPhase: draft.medicines.length > 0 ? 'medicines' : 'ask' })
          }
          onSubmit={async (input) => {
            const photo = input.photo ? await blobToDataUrl(input.photo) : null
            const next = [
              ...draft.medicines,
              {
                name: input.name.trim(),
                weekdays: input.weekdays,
                times: input.times,
                ...(input.system ? { system: input.system } : {}),
                ...(photo ? { photo } : {}),
              },
            ].slice(0, GUEST_MAX_MEDICINES)
            persist({
              ...draft,
              pickPhase: 'medicines',
              medicineDaily: true,
              medicines: next,
            })
          }}
        />
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'medicines' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => persist({ ...draft, pickPhase: 'ask' })}
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">{t('start.medicinesReady')}</h1>
          <p className="screen-sub">{t('start.medicinesSub')}</p>
          <ul className="start-medicine-list">
            {draft.medicines.map((medicine, index) => (
              <li key={`${medicine.name}-${index}`} className="start-medicine-row">
                <MedicineThumb photo={medicine.photo} system={medicine.system} />
                <span className="activity-meta">
                  <span className="activity-name">{medicine.name}</span>
                  {medicine.system ? (
                    <span className="activity-desc">{t(`medicines.${medicine.system}`)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
          {draft.medicines.length < GUEST_MAX_MEDICINES && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => persist({ ...draft, pickPhase: 'medicine' })}
            >
              {t('start.addAnotherMedicine')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => persist({ ...draft, pickPhase: 'pranayam', medicineDaily: true })}
          >
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'pranayam' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() =>
              persist({ ...draft, pickPhase: draft.medicines.length > 0 ? 'medicines' : 'ask' })
            }
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h2 className="screen-heading start-medicine-title">{t('start.pranayamBody')}</h2>
          <div className="start-yes-no">
            <button type="button" className="btn btn-primary" onClick={acceptPranayam}>
              {t('landing.yes')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={declinePranayam}>
              {t('start.no')}
            </button>
          </div>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'pranayams' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => persist({ ...draft, pickPhase: 'pranayam' })}
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">{t('start.pranayamReady')}</h1>
          <p className="screen-sub">{t('start.pranayamSub')}</p>
          <div className="start-featured">
            {PRANAYAM_IDS.map((id) => {
              const selected = draft.activities.some((item) => item.templateId === id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`start-featured-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleTemplate(id)}
                >
                  <HabitMark templateId={id} />
                  <span>{templateLabel(id, locale)}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={continuePranayams}
          >
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'workout' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() =>
              persist({
                ...draft,
                pickPhase: draft.activities.some((item) => isPranayamTemplate(item.templateId))
                  ? 'pranayams'
                  : 'pranayam',
              })
            }
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h2 className="screen-heading start-medicine-title">{t('start.workoutBody')}</h2>
          <p className="screen-sub">{t('start.workoutLike')}</p>
          <div className="start-yes-no">
            <button type="button" className="btn btn-primary" onClick={acceptWorkout}>
              {t('landing.yes')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={declineWorkout}>
              {t('start.no')}
            </button>
          </div>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'workouts' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => persist({ ...draft, pickPhase: 'workout' })}
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">{t('start.workoutReady')}</h1>
          <p className="screen-sub">{t('start.workoutSub')}</p>
          <div className="start-featured">
            {WORKOUT_IDS.map((id) => {
              const selected = draft.activities.some((item) => item.templateId === id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`start-featured-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleTemplate(id)}
                >
                  <HabitMark templateId={id} />
                  <span>{templateLabel(id, locale)}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="btn btn-primary" onClick={continueWorkouts}>
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'stepGoal' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => persist({ ...draft, pickPhase: 'workouts' })}
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">{t('start.targetSteps')}</h1>
          <label className="field">
            <span className="field-label">{t('start.target')}</span>
            <input
              className="field-input"
              inputMode="numeric"
              value={targetText}
              onChange={(event) => setTargetText(event.target.value)}
              placeholder="10000"
              autoFocus
            />
          </label>
          <p className="screen-sub">{t('notes.steps')}</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={parseTarget('steps', targetText) == null}
            onClick={continueStepGoal}
          >
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'heartfulness' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() =>
              persist({
                ...draft,
                pickPhase: draft.activities.some((item) => isWorkoutTemplate(item.templateId))
                  ? 'workouts'
                  : 'workout',
              })
            }
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h2 className="screen-heading start-medicine-title">{t('start.heartfulnessBody')}</h2>
          <div className="start-yes-no">
            <button type="button" className="btn btn-primary" onClick={acceptHeartfulness}>
              {t('landing.yes')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={declineHeartfulness}>
              {t('start.no')}
            </button>
          </div>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'practices' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => persist({ ...draft, pickPhase: 'heartfulness' })}
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">{t('start.heartfulnessReady')}</h1>
          <p className="screen-sub">{t('start.heartfulnessSub')}</p>
          <div className="start-featured">
            {HEART_IDS.map((id) => {
              const selected = draft.activities.some((item) => item.templateId === id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`start-featured-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleTemplate(id)}
                >
                  <HabitMark templateId={id} />
                  <span>{templateLabel(id, locale)}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="btn btn-primary" onClick={continuePractices}>
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'vitals' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() =>
              persist({
                ...draft,
                pickPhase: draft.activities.some((item) => isHeartTemplate(item.templateId))
                  ? 'practices'
                  : 'heartfulness',
              })
            }
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h2 className="screen-heading start-medicine-title">{t('start.vitalsBody')}</h2>
          <p className="screen-sub">{t('start.vitalsLike')}</p>
          <div className="start-yes-no">
            <button type="button" className="btn btn-primary" onClick={acceptVitals}>
              {t('landing.yes')}
            </button>
            <button type="button" className="btn btn-secondary" onClick={declineVitals}>
              {t('start.no')}
            </button>
          </div>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'vitalPicks' && (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => persist({ ...draft, pickPhase: 'vitals' })}
          >
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">{t('start.vitalsReady')}</h1>
          <p className="screen-sub">{t('start.vitalsSub')}</p>
          <div className="start-featured">
            {VITAL_IDS.map((id) => {
              const selected = draft.activities.some((item) => item.templateId === id)
              return (
                <button
                  key={id}
                  type="button"
                  className={`start-featured-option${selected ? ' is-selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() => toggleTemplate(id)}
                >
                  <HabitMark templateId={id} />
                  <span>{templateLabel(id, locale)}</span>
                </button>
              )
            })}
          </div>
          <button type="button" className="btn btn-primary" onClick={continueVitals}>
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 1 && !customOpen && !adding && draft.pickPhase === 'targets' && (() => {
        const targetActivity = targetActivities(draft.activities)[targetIndex]
        if (!targetActivity) return null
        const weight = targetActivity.templateId === 'weight'
        const parsed = parseTarget(targetActivity.templateId, targetText)
        return (
          <>
            <button type="button" className="btn btn-ghost start-back" onClick={backTarget}>
              <Icon name="back" />
              {t('start.back')}
            </button>
            <h1 className="screen-heading">{weight ? t('start.targetWeight') : t('start.targetSteps')}</h1>
            <label className="field">
              <span className="field-label">{t('start.target')}</span>
              <input
                className="field-input"
                inputMode={weight ? 'decimal' : 'numeric'}
                value={targetText}
                onChange={(event) => setTargetText(event.target.value)}
                placeholder={weight ? '70' : '10000'}
                autoFocus
              />
            </label>
            <p className="screen-sub">{weight ? 'kg' : t('notes.steps')}</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={parsed == null}
              onClick={advanceTarget}
            >
              {t('start.continue')}
            </button>
          </>
        )
      })()}

      {draft.step === 1 && !customOpen && (adding || draft.pickPhase === 'activities') && (
        <>
          {!adding && (
            <button
              type="button"
              className="btn btn-ghost start-back"
              onClick={() =>
                persist({
                  ...draft,
                  pickPhase: draft.activities.some((item) => isVitalTemplate(item.templateId))
                    ? 'vitalPicks'
                    : 'vitals',
                })
              }
            >
              <Icon name="back" />
              {t('start.back')}
            </button>
          )}
          <h1 className="screen-heading">
            {adding ? t('start.add') : t('start.activitiesIntro')}
          </h1>
          {adding && <p className="screen-sub">{t('start.addSub')}</p>}
          {draft.activities.some((item) => item.templateId == null && !(adding && keptIds.current?.has(item.localId))) && (
            <div className="start-featured">
              {draft.activities
                .filter((item) => item.templateId == null && !(adding && keptIds.current?.has(item.localId)))
                .map((item) => (
                  <button
                    key={item.localId}
                    type="button"
                    className="start-featured-option is-selected"
                    onClick={() => persist(removeGuestActivity(draft, item.localId))}
                  >
                    {item.name}
                  </button>
                ))}
            </div>
          )}
          <div className="start-featured">
            {START_FEATURED.map((item) => {
              const existing = draft.activities.find((activity) => activity.templateId === item.id)
              const kept = Boolean(existing && adding && keptIds.current?.has(existing.localId))
              if (kept) return null
              const selected = Boolean(existing)
              const full = selectionFull(item.id, selected)
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`start-featured-option${selected ? ' is-selected' : ''}`}
                  disabled={full}
                  aria-pressed={selected}
                  onClick={() => toggleTemplate(item.id)}
                >
                  <HabitMark templateId={item.id} />
                  <span>{t(item.labelKey)}</span>
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="btn btn-ghost start-explore"
            onClick={() => setExploreMore((open) => !open)}
            aria-expanded={exploreMore}
          >
            {exploreMore ? t('start.exploreLess') : t('start.explore')}
          </button>
          {exploreMore && (
          <div className="habit-groups habit-pick">
            <form
              className="start-type"
              onSubmit={(event) => {
                event.preventDefault()
                addCustomHabit()
              }}
            >
              <label className="field">
                <span className="visually-hidden">{t('start.name')}</span>
                <input
                  className="field-input"
                  value={customName}
                  onChange={(event) => {
                    setCustomName(event.target.value)
                    setTypeError(false)
                  }}
                  placeholder={t('start.typePlaceholder')}
                  maxLength={60}
                  enterKeyHint="done"
                  aria-invalid={typeError}
                />
              </label>
              <button
                type="submit"
                className="btn btn-secondary"
                disabled={
                  !customName.trim() || selectionFull(null, false)
                }
              >
                {t('start.addName')}
              </button>
            </form>
            {typeError && (
              <p className="error start-type-error" role="alert">
                {t('start.unknown')}
              </p>
            )}
            {HABIT_GROUPS.map((group) => {
              const ids = group.ids.filter((id) => !FEATURED_IDS.has(id))
              if (ids.length === 0) return null
              return (
              <section key={group.title} className="habit-group">
                <h2 className="habit-group-title">{groupTitle(group.title, locale)}</h2>
                <div className="onboarding-chips">
                  {ids.map((id) => {
                    const template = templateById(id)
                    if (!template) return null
                    const existing = draft.activities.find((item) => item.templateId === template.id)
                    const kept = Boolean(existing && adding && keptIds.current?.has(existing.localId))
                    const selected = Boolean(existing) && !kept
                    const full = selectionFull(template.id, selected)
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className={`onboarding-chip habit-tile ${selected ? 'onboarding-chip-selected' : ''}`}
                        disabled={full || kept}
                        onClick={() => toggleTemplate(template.id)}
                      >
                        <span
                          className={`habit-tile-icon${HABIT_ART[template.id] ? ' habit-tile-icon-art' : ''}`}
                          aria-hidden
                        >
                          {HABIT_ART[template.id] ? (
                            <img className="habit-tile-art" src={HABIT_ART[template.id]} alt="" />
                          ) : (
                            <HabitIcon id={template.id} />
                          )}
                        </span>
                        <span className="habit-tile-label">{templateLabel(template.id, locale)}</span>
                      </button>
                    )
                  })}
                </div>
              </section>
              )
            })}
            <section className="habit-group">
              <h2 className="habit-group-title">{t('start.vitals')}</h2>
              <div className="onboarding-chips">
                {START_VITALS.filter((vital) => !FEATURED_IDS.has(vital.id)).map((vital) => {
                  const existing = draft.activities.find((item) => item.templateId === vital.id)
                  const kept = Boolean(existing && adding && keptIds.current?.has(existing.localId))
                  const selected = Boolean(existing) && !kept
                  const full = selectionFull(vital.id, selected)
                  return (
                    <button
                      key={vital.id}
                      type="button"
                      className={`onboarding-chip habit-tile ${selected ? 'onboarding-chip-selected' : ''}`}
                      disabled={full || kept}
                      onClick={() => toggleTemplate(vital.id)}
                    >
                      <span
                        className={`habit-tile-icon${HABIT_ART[vital.id] ? ' habit-tile-icon-art' : ''}`}
                        aria-hidden
                      >
                        {HABIT_ART[vital.id] ? (
                          <img className="habit-tile-art" src={HABIT_ART[vital.id]} alt="" />
                        ) : (
                          <HabitIcon id={vital.id} />
                        )}
                      </span>
                      <span className="habit-tile-label">
                        {templateLabel(vital.id, locale) ?? vital.label}
                        {vital.caption ? <span className="habit-tile-caption">{vital.caption}</span> : null}
                      </span>
                    </button>
                  )
                })}
              </div>
            </section>
          </div>
          )}
          <div className="start-flow-footer">
            <button
              type="button"
              className="btn btn-primary"
              disabled={continueCount === 0}
              onClick={continueFromPick}
            >
              {continueCount === 0 ? t('start.pickOne') : continueLabel(continueCount)}
            </button>
          </div>
        </>
      )}

      {draft.step === 2 && gapActivity && isDailyGoalHabit(gapActivity) && (
        <>
          <h1 className="screen-heading">{gapHeading(gapActivity)}</h1>
          <p className="screen-sub">
            {gapActivity.emoji} {visibleName(gapActivity, locale)}
          </p>
          {gapNote(gapActivity) && <p className="screen-sub">{gapNote(gapActivity)}</p>}
          <HabitVideoPlaceholder
            templateId={gapActivity.templateId}
            name={visibleName(gapActivity, locale)}
            measure={gapActivity.measure}
          />
          <div className="choice-grid choice-grid-size" role="group" aria-label={gapHeading(gapActivity)}>
            {gapOptionsFor(gapActivity).map((option) => {
              const selected = draft.gapAnswer[gapActivity.localId] === option.id
              const parts = gapOptionParts(option)
              return (
              <button
                key={option.id}
                type="button"
                className={`choice-tile choice-tile-stack ${selected ? 'choice-tile-selected' : ''}`}
                aria-label={option.label}
                onClick={() => pickGap(option.id)}
              >
                <span className="choice-tile-primary">{parts.primary}</span>
                {parts.secondary ? (
                  <span className="choice-tile-secondary">{parts.secondary}</span>
                ) : null}
              </button>
              )
            })}
          </div>
          {reassurance && <p className="onboarding-hint">{reassurance}</p>}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => finishGoals(draft, 'skip')}
          >
            {t('landing.skip')}
          </button>
        </>
      )}

      {(draft.step === 3 || detailing) && sizeActivity && (
        <>
          {detailing && (
            <button
              type="button"
              className="btn btn-ghost start-back"
              onClick={
                detailingHeart ? backPracticeDetail : detailingWorkout ? backWorkoutDetail : backPranayamDetail
              }
            >
              <Icon name="back" />
              {t('start.back')}
            </button>
          )}
          <h1 className="screen-heading">{t('start.sizeTitle')}</h1>
          <p className="screen-sub">{t('start.sizeSub')}</p>
          <fieldset className="field habit-size-block">
            <legend className="field-label habit-size-title">
              <HabitMark
                templateId={sizeActivity.templateId}
                name={visibleName(sizeActivity, locale)}
                emoji={sizeActivity.emoji}
              />
              <span>{visibleName(sizeActivity, locale)}</span>
            </legend>
            <p className="habit-size-tagline">{habitSizeTagline(sizeActivity)}</p>
            {sizeActivity.templateId && isPranayamTemplate(sizeActivity.templateId) ? (
              <HabitVideoPlaceholder
                templateId={sizeActivity.templateId}
                name={visibleName(sizeActivity, locale)}
                placeholder
              />
            ) : sizeArt ? (
              <img className="habit-size-art" src={sizeArt} alt="" />
            ) : null}
            {sizeActivity.templateId === 'relaxation' ? null : sizeControl ? (
              <div
                className="choice-grid choice-grid-size"
                role="group"
                aria-label={t('start.length', { name: visibleName(sizeActivity, locale) })}
              >
                {sizeControl.steps.map((step) => {
                  const parts = sizeControl.label
                    ? durationChipParts(step)
                    : {
                        primary: String(step),
                        secondary: sizeControl.suffix.trim() || null,
                      }
                  const aria = sizeControl.label?.(step) ?? `${step}${sizeControl.suffix}`
                  return (
                    <button
                      key={step}
                      type="button"
                      className={`choice-tile choice-tile-stack ${sizeValue === step ? 'choice-tile-selected' : ''}`}
                      aria-label={aria}
                      onClick={() => setActivitySize(sizeActivity.localId, step)}
                    >
                      <span className="choice-tile-primary">{parts.primary}</span>
                      {parts.secondary ? (
                        <span className="choice-tile-secondary">{parts.secondary}</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="screen-sub">{t('start.checkOff')}</p>
            )}
            <span className="field-label habit-often">{t('start.often')}</span>
            <div
              className="choice-grid choice-grid-cadence"
              role="group"
              aria-label={t('start.cadence', { name: visibleName(sizeActivity, locale) })}
            >
              {WEEK_CADENCE.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`choice-tile choice-tile-stack ${sizeCadence === option.id ? 'choice-tile-selected' : ''}`}
                  aria-label={option.id === 'daily' ? t('cadence.daily') : option.id === 'once' ? t('cadence.onceLabel') : t('cadence.twiceLabel')}
                  onClick={() => setWeekCadence(sizeActivity.localId, option.id)}
                >
                  <span className="choice-tile-primary">
                    {option.id === 'daily' ? t('cadence.daily') : option.id === 'once' ? t('cadence.once') : t('cadence.twice')}
                  </span>
                  {option.secondary ? (
                    <span className="choice-tile-secondary">{t('cadence.week')}</span>
                  ) : null}
                </button>
              ))}
            </div>
          </fieldset>
          <button
            type="button"
            className="btn btn-primary"
            onClick={
              detailingPranayam
                ? advancePranayamDetail
                : detailingWorkout
                  ? advanceWorkoutDetail
                  : detailingHeart
                    ? advancePracticeDetail
                    : advanceSizeStep
            }
          >
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 5 && practiceActivity && (
        <>
          <h1 className="screen-heading">{t('start.nowTitle')}</h1>
          {practiceOn ? (
            <>
              <p className="screen-sub">{visibleName(practiceActivity, locale)}</p>
              <p className="screen-heading" aria-live="polite">
                {`${Math.floor(Math.max(0, PRACTICE_SECONDS - practiceElapsed) / 60)}:${String(Math.floor(Math.max(0, PRACTICE_SECONDS - practiceElapsed) % 60)).padStart(2, '0')}`}
              </p>
              <button type="button" className="btn btn-secondary" onClick={() => setPracticePaused((value) => !value)}>
                {practicePaused ? t('today.resume') : t('today.pause')}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => finishPractice(practiceElapsed)}>
                {t('today.done')}
              </button>
            </>
          ) : (
            <>
              <p className="screen-sub">{t('start.nowBody', { name: visibleName(practiceActivity, locale) })}</p>
              <button type="button" className="btn btn-primary" onClick={beginPractice}>
                {t('start.startTwo')}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  track('onboarding_timer_skipped')
                  go(6)
                }}
              >
                {t('start.later')}
              </button>
            </>
          )}
        </>
      )}

      {draft.step === 6 && (
        <>
          <h1 className="screen-heading">
            {resumedToday && practiceActivity
              ? t('start.resumedTitle', { name: visibleName(practiceActivity, locale) })
              : t('start.readyTitle')}
          </h1>
          <p className="screen-sub">
            {resumedToday ? t('start.resumedBody') : t('start.readyBody')}
          </p>
          <button type="button" className="btn btn-primary" onClick={() => go(4)}>
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 4 && (
        <>
          <h1 className="screen-heading">{t('start.reminderTitle')}</h1>
          {(draft.medicines.length > 0 || draft.medicineDaily) && (
            <p className="screen-sub">{t('start.reminderMedicine')}</p>
          )}
          <p className="screen-sub">{t('start.reminderSub')}</p>
          <div className="reminder-times">
            {nudgeTimes.map((time, index) => (
              <label key={`reminder-${index}`} className="field">
                <span className="field-label">
                  {index === 0 ? t('start.reminder') : t('start.reminderN', { n: index + 1 })}
                </span>
                <div className="reminder-time-row">
                  <input
                    className="field-input"
                    type="time"
                    value={time || '19:00'}
                    onChange={(event) => {
                      const next = [...nudgeTimes]
                      next[index] = event.target.value || '19:00'
                      setNudgeTimes(next)
                    }}
                  />
                  {nudgeTimes.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      aria-label={t('start.removeN', { n: index + 1 })}
                      onClick={() => setNudgeTimes(nudgeTimes.filter((_, i) => i !== index))}
                    >
                      {t('start.remove')}
                    </button>
                  )}
                </div>
              </label>
            ))}
          </div>
          {nudgeTimes.length < 5 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setNudgeTimes([...nudgeTimes, '12:00'])}
            >
              {t('start.addReminder')}
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => openTodayAfterReminder(true)}>
            {nudgeTimes.length === 1
              ? t('start.remindAt', { time: formatReminderClock(nudgeTimes[0] || '19:00') })
              : t('start.remindTimes', { count: nudgeTimes.length })}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => openTodayAfterReminder(false)}>
            {t('start.notNow')}
          </button>
        </>
      )}

      {draft.step === 8 && (
        <>
          <h1 className="screen-heading">{t('start.saveTitle')}</h1>
          <p className="screen-sub">{onboardingSummary(draft)}</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={googleBusy}
            onClick={() => {
              track('signin_method_clicked', { method: 'google' })
              setGoogleBusy(true)
              void onGoogle().finally(() => setGoogleBusy(false))
            }}
          >
            {AUTH_PROVIDERS[0].label}
          </button>
          <EmailSignInForm onClick={() => track('signin_method_clicked', { method: 'email' })} />
          <p className="onboarding-hint">{t('start.free')}</p>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/today')}>
            {t('start.notNow')}
          </button>
        </>
      )}
    </div>
  )
}
