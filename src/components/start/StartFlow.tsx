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
import { LanguagePicker } from '../LanguagePicker'

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `g-${Date.now()}`
}

const START_VITALS: { id: string; label: string; caption?: string }[] = [
  { id: 'weight', label: 'Weight' },
  { id: 'steps', label: 'Steps' },
  { id: 'water', label: 'Water' },
  { id: 'sleep_hours', label: 'Sleep' },
  { id: 'fasting', label: 'Fasting' },
  { id: 'protein', label: 'Protein' },
  { id: 'blood_pressure', label: 'Blood Pressure' },
  { id: 'heart_rate', label: 'Heart Rate' },
]

/** Short first question. Explore more opens the rest of the catalog. */
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

function choiceCode(ids: string[]): string {
  return ids.slice(0, 8).join(',').slice(0, 80)
}

export function StartFlow({
  draft,
  onDraft,
  onGoogle,
  adding = false,
}: {
  draft: GuestDraft
  onDraft: (draft: GuestDraft) => void
  onGoogle: () => Promise<void>
  adding?: boolean
}) {
  const navigate = useNavigate()
  const { locale, t } = useLocale()
  const [gapIndex, setGapIndex] = useState(0)
  const [sizeIndex, setSizeIndex] = useState(0)
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

  useEffect(() => {
    return () => {
      if (gapTimer.current != null) window.clearTimeout(gapTimer.current)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    document.querySelector('.landing')?.scrollTo?.(0, 0)
    document.querySelector('.start-flow')?.scrollIntoView?.({ block: 'start' })
  }, [draft.step, adding, customOpen])

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
      persist(removeGuestActivity(draft, existing.localId))
      return
    }
    const pickMax = adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX
    if (draft.activities.length >= pickMax) return
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
    const pickMax = adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX
    if (base.activities.length >= pickMax) return base
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
    if (next.activities.length === 0) return
    if (next !== draft) {
      setCustomName('')
      track('activity_created', {
        template_id: 'custom',
        type: 'daily',
        tracking: habitPlan?.trackingMode ?? 'timer',
        signed_in: false,
      })
    }
    finishStep(
      1,
      choiceCode(next.activities.map((item) => item.templateId ?? 'custom')),
      draftAfterPick(next),
    )
  }

  function hasSizeStep(base: GuestDraft): boolean {
    return sizeStepActivities(base.activities).length > 0
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
    finishStep(2, choices, setGuestStep(next, 4))
  }

  function draftAfterPick(base: GuestDraft): GuestDraft {
    if (base.activities.some(isDailyGoalHabit)) return setGuestStep(base, 2)
    if (hasSizeStep(base)) return enterSizeStep(base)
    return setGuestStep(base, 4)
  }

  function advanceSizeStep() {
    const list = sizeStepActivities(draft.activities)
    const current = list[sizeIndex]
    if (sizeIndex + 1 < list.length) {
      track('onboarding_step_completed', {
        step: 3,
        choices: current?.templateId ?? current?.name ?? 'sized',
      })
      setSizeIndex(sizeIndex + 1)
      return
    }
    finishStep(3, 'sized', setGuestStep(draft, 4))
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

  function saveReminder(times: string[]) {
    const cleaned = times
      .map((time) => time || '19:00')
      .filter((time, index, list) => list.indexOf(time) === index)
      .slice(0, 5)
    const next = cleaned[0] ?? '19:00'
    track('onboarding_reminder_set', { time: next, count: cleaned.length })
    persist(
      saveGuestDraft({
        ...draft,
        reminderTimes: cleaned,
        reminderTime: next,
        reminderDeclined: false,
      }),
    )
  }

  function openTodayAfterReminder(accepted: boolean) {
    if (accepted) {
      const times = nudgeTimes.length > 0 ? nudgeTimes : ['19:00']
      saveReminder(times)
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
      persist(
        saveGuestDraft({
          ...draft,
          reminderTimes: [],
          reminderTime: null,
          reminderDeclined: true,
        }),
      )
    }
    navigate('/today')
  }

  useEffect(() => {
    if (draft.step !== 2) return
    const goalAt = draft.activities.findIndex(isDailyGoalHabit)
    if (goalAt < 0) return
    if (!isDailyGoalHabit(draft.activities[gapIndex] ?? { templateId: null })) setGapIndex(goalAt)
  }, [draft.step, draft.activities, gapIndex])

  useEffect(() => {
    if (draft.step !== 3) return
    const list = sizeStepActivities(draft.activities)
    if (list.length === 0) {
      persist(setGuestStep(draft, 4))
      return
    }
    if (sizeIndex >= list.length) setSizeIndex(list.length - 1)
  }, [draft.step, draft.activities, sizeIndex])

  const sizeActivities = sizeStepActivities(draft.activities)
  const sizeActivity = sizeActivities[sizeIndex] ?? null
  const sizeControl = sizeActivity ? activitySizeControl(sizeActivity) : null
  const sizeValue = sizeActivity && sizeControl ? currentSize(sizeActivity) : null
  const sizeCadence = sizeActivity ? weekCadenceOf(sizeActivity) : null
  const sizeArt = sizeActivity ? habitSizeArtFor(sizeActivity) : null

  useEffect(() => {
    if (draft.step !== 2 || draft.activities.some(isDailyGoalHabit)) return
    const next = draftAfterGoals(draft)
    if (hasSizeStep(next)) {
      persist(next)
      return
    }
    navigate('/today')
    // Skip the removed "when did you last" question. Daily amounts still use this step.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.step, draft.activities])

  useEffect(() => {
    const removed = draft.step === 5 || draft.step === 6 || draft.step === 7
    if (!removed && draft.slipAnswer.length === 0) return
    const back = hasSizeStep(draft) ? 3 : draft.activities.some(isDailyGoalHabit) ? 2 : 1
    const step = removed ? back : draft.step
    persist(setGuestStep({ ...draft, slipAnswer: [] }, step))
    if (removed) navigate('/today', { replace: true })
    // Anyone still on the removed start-now or celebration screens goes to Today.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.step, draft.slipAnswer.length])

  return (
    <div className="start-flow">
      <div className="brand-line">
        <BrandTitle className="app-title" />
        <LanguagePicker />
      </div>
      <div className="onboarding-dots" aria-label={`Step ${draft.step} of 8`}>
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className={index + 1 === draft.step ? 'onboarding-dot onboarding-dot-active' : 'onboarding-dot'}
          />
        ))}
      </div>

      {draft.step > 1 && (
        <button
          type="button"
          className="btn btn-ghost start-back"
          onClick={() => {
            if (draft.step === 3 && sizeIndex > 0) {
              setSizeIndex(sizeIndex - 1)
              return
            }
            let previous = draft.step - 1
            if (previous >= 5 && previous <= 7) previous = 4
            if (previous === 3 && !hasSizeStep(draft)) previous = 2
            if (previous === 2 && !draft.activities.some(isDailyGoalHabit)) previous = 1
            if (previous === 3) setSizeIndex(Math.max(0, sizeStepActivities(draft.activities).length - 1))
            go(previous)
          }}
        >
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
              disabled={!customName.trim() || draft.activities.length >= (adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX)}
              onClick={addCustomHabit}
            >
              {t('start.continue')}
            </button>
          </div>
        </>
      )}

      {draft.step === 1 && !customOpen && (
        <>
          <h1 className="screen-heading">
            {adding ? t('start.add') : t('start.pick')}
          </h1>
          <p className="screen-sub">
            {adding ? t('start.addSub') : t('start.pickSub')}
          </p>
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
                !customName.trim() ||
                draft.activities.length >= (adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX)
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
          {draft.activities.some((item) => item.templateId == null) && (
            <div className="start-featured">
              {draft.activities
                .filter((item) => item.templateId == null)
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
              const selected = draft.activities.some((activity) => activity.templateId === item.id)
              const pickMax = adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX
              const full = draft.activities.length >= pickMax && !selected
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
                    const selected = draft.activities.some((item) => item.templateId === template.id)
                    const pickMax = adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX
                    const full = draft.activities.length >= pickMax && !selected
                    return (
                      <button
                        key={template.id}
                        type="button"
                        className={`onboarding-chip habit-tile ${selected ? 'onboarding-chip-selected' : ''}`}
                        disabled={full}
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
                  const selected = draft.activities.some((item) => item.templateId === vital.id)
                  const pickMax = adding ? GUEST_MAX_ACTIVITIES : START_PICK_MAX
                  const full = draft.activities.length >= pickMax && !selected
                  return (
                    <button
                      key={vital.id}
                      type="button"
                      className={`onboarding-chip habit-tile ${selected ? 'onboarding-chip-selected' : ''}`}
                      disabled={full}
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
              disabled={draft.activities.length === 0 && !typedNameCounts}
              onClick={continueFromPick}
            >
              {continueLabel(draft.activities.length + (typedNameCounts ? 1 : 0))}
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

      {draft.step === 3 && sizeActivity && (
        <>
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
            {sizeArt ? (
              <img className="habit-size-art" src={sizeArt} alt="" />
            ) : null}
            {sizeControl ? (
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
          <button type="button" className="btn btn-primary" onClick={advanceSizeStep}>
            {t('start.continue')}
          </button>
        </>
      )}

      {draft.step === 4 && (
        <>
          <h1 className="screen-heading">{t('start.reminderTitle')}</h1>
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
