import { useEffect, useState, type FormEvent } from 'react'
import { ACTIVITY_TEMPLATES, HABIT_GROUPS, activityInputFromTemplate, templateById, tinyHint } from '../data/activityTemplates'
import { HABIT_ART } from '../data/habitArt'
import { activityOwnVideo, habitVideoFor, parseYoutubeLink, youtubeWatchUrl } from '../data/habitVideos'
import { HabitIcon } from './HabitIcon'
import { DayPeriodPicker } from './DayPeriodPicker'
import { GoalTargetPicker, StandardVitalTarget, WeightTargetField } from './GoalTargetPicker'
import { HabitMark } from './HabitMark'
import { HabitVideoPlaceholder } from './HabitVideoPlaceholder'
import { activityPeriod } from '../lib/dayPeriod'
import {
  VITAL_GOAL_IDS,
  WEEK_CADENCE,
  activitySizeControl,
  applyWeekCadence,
  durationChipParts,
  gapHeading,
  gapOptionsFor,
  habitSizeTagline,
  isDailyGoalHabit,
  isPranayamHabit,
  parseGoalText,
  standardVitalTarget,
  weekCadenceOf,
  weightUnitOf,
  type WeekCadence,
  type WeightUnit,
} from '../lib/onboardingFlow'
import { addDays, todayLocalDate } from '../lib/dates'
import type { Activity, ActivityInput } from '../lib/activities'
import { groupTitle, isCatalogLabel, templateLabel, visibleName } from '../lib/catalogName'
import { useLocale } from '../hooks/useLocale'
import { useThemedArt } from '../hooks/useThemedArt'
import type { ActivityType, TrackingMode } from '../types/database'

function fromActivity(activity: Activity): ActivityInput {
  const timerInSeconds = activity.tracking_mode === 'timer' && activity.target_unit === 'seconds'
  return {
    name: activity.name,
    emoji: activity.emoji,
    type: activity.type,
    trackingMode: activity.tracking_mode,
    targetValue: timerInSeconds
      ? Math.max(1, Math.round((activity.target_value ?? 60) / 60))
      : activity.target_value,
    targetUnit: timerInSeconds ? 'minutes' : activity.target_unit,
    weeklyTarget: activity.weekly_target,
    deadline: activity.deadline,
    whyMatters: activity.why_matters,
    usuallyWhen: activity.usually_when,
    offWeekdays: activity.off_weekdays ?? [],
    templateId: activity.template_id ?? null,
    nameOverridden: activity.name_overridden ?? false,
  }
}

function withCatalog(input: ActivityInput, templateId: string | null): ActivityInput {
  return {
    ...input,
    templateId,
    nameOverridden: templateId != null && !isCatalogLabel(templateId, input.name),
  }
}

function templateAlreadyAdded(templateId: string, label: string, names: readonly string[]): boolean {
  const taken = new Set(names.map((name) => name.trim().toLowerCase()))
  if (taken.has(label.toLowerCase())) return true
  if (templateId === 'exercise' && (taken.has('exercise') || taken.has('strength'))) return true
  if (templateId === 'stretching' && taken.has('stretch')) return true
  return false
}

const emptyInput: ActivityInput = {
  name: '',
  emoji: '📌',
  type: 'daily',
  trackingMode: 'timer',
  targetValue: 10,
  targetUnit: 'minutes',
  weeklyTarget: null,
  deadline: null,
  whyMatters: null,
  usuallyWhen: null,
  offWeekdays: [],
}

function scrollFormTop() {
  window.scrollTo(0, 0)
  document.querySelector('main')?.scrollTo?.(0, 0)
}

function goalOptionMatches(templateId: string, value: number): boolean {
  return gapOptionsFor({ templateId }).some((option) => {
    const record = option as { glasses?: number; grams?: number; hours?: number; count?: number }
    return record.glasses === value || record.grams === value || record.hours === value || record.count === value
  })
}

/** Edit for a catalog habit: the same amount and how-often choices as adding it. */
function CatalogHabitEdit({
  initial,
  saving,
  error,
  onSubmit,
}: {
  initial: Activity
  saving: boolean
  error: string | null
  onSubmit: (input: ActivityInput) => Promise<void> | void
}) {
  const { locale, t } = useLocale()
  const themed = useThemedArt()
  const templateId: string | null = initial.template_id ?? null
  const base = fromActivity(initial)
  const name = visibleName(initial, locale)
  const goal = isDailyGoalHabit({ templateId })
  const weight = templateId === 'weight'
  const standard = standardVitalTarget(templateId)
  const control = activitySizeControl({
    templateId,
    trackingMode: initial.tracking_mode,
    type: initial.type,
    targetUnit: initial.target_unit,
  })
  const [sizeValue, setSizeValue] = useState<number | null>(initial.target_value)
  const [cadence, setCadence] = useState<WeekCadence>(
    weekCadenceOf({ type: initial.type, weeklyTarget: initial.weekly_target }),
  )
  const [goalValue, setGoalValue] = useState<number | null>(initial.target_value)
  const [goalText, setGoalText] = useState(() => {
    if (!templateId || !goal || initial.target_value == null) return ''
    return goalOptionMatches(templateId, initial.target_value) ? '' : String(initial.target_value)
  })
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(weightUnitOf(initial.target_unit))
  const [weightText, setWeightText] = useState(initial.target_value != null ? String(initial.target_value) : '')

  const steps =
    control == null
      ? []
      : [...control.steps, ...(sizeValue != null && !control.steps.includes(sizeValue) ? [sizeValue] : [])].sort(
          (a, b) => a - b,
        )
  const art = templateId ? HABIT_ART[templateId] : undefined

  async function save() {
    if (weight) {
      const typed = parseGoalText(templateId, weightText)
      if (typed == null) return
      await onSubmit({ ...base, targetValue: typed, targetUnit: weightUnit })
      return
    }
    if (goal) {
      const typed = goalText.trim() ? parseGoalText(templateId, goalText) : null
      const value = typed ?? goalValue
      if (value == null || value <= 0) return
      await onSubmit({ ...base, targetValue: value })
      return
    }
    if (standard) {
      await onSubmit(base)
      return
    }
    const paced = applyWeekCadence({ type: base.type, weeklyTarget: base.weeklyTarget }, cadence)
    const next: ActivityInput = { ...base, type: paced.type, weeklyTarget: paced.weeklyTarget }
    if (control) {
      const value = sizeValue ?? control.steps[0] ?? 1
      next.targetValue = value
      next.targetUnit = base.trackingMode === 'count' ? null : 'minutes'
    }
    await onSubmit(next)
  }

  const goalReady = !goal || (goalText.trim() ? parseGoalText(templateId, goalText) != null : (goalValue ?? 0) > 0)
  const weightReady = !weight || parseGoalText(templateId, weightText) != null

  return (
    <div className="catalog-habit-edit">
      {weight ? (
        <>
          <h1 className="screen-heading">{t('start.targetWeight')}</h1>
          <p className="screen-sub start-detail-name">
            <HabitMark templateId={templateId} name={name} emoji={initial.emoji} />
            {name}
          </p>
          <WeightTargetField text={weightText} unit={weightUnit} onText={setWeightText} onUnit={setWeightUnit} />
        </>
      ) : goal ? (
        <>
          <h1 className="screen-heading">{gapHeading({ templateId })}</h1>
          <p className="screen-sub start-detail-name">
            <HabitMark templateId={templateId} name={name} emoji={initial.emoji} />
            {name}
          </p>
          <GoalTargetPicker
            habit={{ templateId }}
            value={goalValue}
            text={goalText}
            onPick={(value) => {
              setGoalText('')
              setGoalValue(value)
            }}
            onText={setGoalText}
          />
        </>
      ) : standard ? (
        <>
          <h1 className="screen-heading">{name}</h1>
          <StandardVitalTarget messageKey={standard} />
        </>
      ) : (
        <>
          <h1 className="screen-heading">{t('start.sizeTitle')}</h1>
          <p className="screen-sub">{t('start.sizeSub')}</p>
          <fieldset className="field habit-size-block">
            <legend className="field-label habit-size-title">
              <HabitMark templateId={templateId} name={name} emoji={initial.emoji} />
              <span>{name}</span>
            </legend>
            <p className="habit-size-tagline">{habitSizeTagline({ templateId, name: initial.name })}</p>
            {isPranayamHabit(templateId) ? (
              <HabitVideoPlaceholder templateId={templateId} name={name} placeholder />
            ) : art ? (
              <img className="habit-size-art" src={themed(art)} alt="" />
            ) : null}
            {control ? (
              <div className="choice-grid choice-grid-size" role="group" aria-label={t('start.length', { name })}>
                {steps.map((step) => {
                  const parts = control.label
                    ? durationChipParts(step)
                    : { primary: String(step), secondary: control.suffix.trim() || null }
                  const aria = control.label?.(step) ?? `${step}${control.suffix}`
                  return (
                    <button
                      key={step}
                      type="button"
                      className={`choice-tile choice-tile-stack ${sizeValue === step ? 'choice-tile-selected' : ''}`}
                      aria-label={aria}
                      aria-pressed={sizeValue === step}
                      onClick={() => setSizeValue(step)}
                    >
                      <span className="choice-tile-primary">{parts.primary}</span>
                      {parts.secondary ? <span className="choice-tile-secondary">{parts.secondary}</span> : null}
                    </button>
                  )
                })}
              </div>
            ) : (
              <p className="screen-sub">{t('start.checkOff')}</p>
            )}
            <span className="field-label habit-often">{t('start.often')}</span>
            <div className="choice-grid choice-grid-cadence" role="group" aria-label={t('start.cadence', { name })}>
              {WEEK_CADENCE.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`choice-tile choice-tile-stack ${cadence === option.id ? 'choice-tile-selected' : ''}`}
                  aria-pressed={cadence === option.id}
                  onClick={() => setCadence(option.id)}
                >
                  <span className="choice-tile-primary">
                    {option.id === 'daily'
                      ? t('cadence.daily')
                      : option.id === 'once'
                        ? t('cadence.once')
                        : t('cadence.twice')}
                  </span>
                  {option.secondary ? <span className="choice-tile-secondary">{t('cadence.week')}</span> : null}
                </button>
              ))}
            </div>
          </fieldset>
        </>
      )}
      {error && <p className="error">{error}</p>}
      <button
        type="button"
        className="btn btn-primary catalog-habit-save"
        disabled={saving || !goalReady || !weightReady}
        onClick={() => void save()}
      >
        {saving ? t('reminders.saving') : t('start.save')}
      </button>
    </div>
  )
}

export function ActivityForm({
  initial = null,
  existingNames = [],
  saving = false,
  error = null,
  onSubmit,
  onCancel,
  onPhaseChange,
}: {
  initial?: Activity | null
  existingNames?: readonly string[]
  saving?: boolean
  error?: string | null
  onSubmit: (input: ActivityInput) => Promise<void> | void
  onCancel: () => void
  onPhaseChange?: (phase: 'pick' | 'details' | 'simple') => void
}) {
  const { locale, t } = useLocale()
  const themed = useThemedArt()
  const [phase, setPhase] = useState<'pick' | 'details' | 'simple'>(
    initial?.template_id ? 'simple' : initial ? 'details' : 'pick',
  )
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(
    initial?.template_id ?? null,
  )
  const [input, setInput] = useState<ActivityInput>(
    initial ? fromActivity(initial) : emptyInput,
  )
  const [goalText, setGoalText] = useState('')
  const goalTemplateId = selectedTemplateId ?? input.templateId ?? null
  const goalHabit = isDailyGoalHabit({ templateId: goalTemplateId })
  const savedVideo = initial ? activityOwnVideo(initial) : null
  const [videoText, setVideoText] = useState(savedVideo ? youtubeWatchUrl(savedVideo) : '')
  const [videoInvalid, setVideoInvalid] = useState(false)
  const hasBuiltInVideo = goalTemplateId != null && habitVideoFor(goalTemplateId) != null

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])

  useEffect(() => {
    scrollFormTop()
  }, [phase])

  function goPhase(next: 'pick' | 'details' | 'simple') {
    setPhase(next)
  }

  function update<K extends keyof ActivityInput>(key: K, value: ActivityInput[K]) {
    setInput((prev) => {
      const next = { ...prev, [key]: value }

      if (key === 'type') {
        const type = value as ActivityType
        if (type === 'deadline') {
          next.trackingMode = 'checkbox'
          next.targetValue = null
          next.targetUnit = null
          next.weeklyTarget = null
        } else if (type === 'monthly') {
          next.trackingMode = 'checkbox'
          next.targetValue = null
          next.targetUnit = null
          next.weeklyTarget = null
          next.deadline = null
        } else if (type === 'weekly_n') {
          next.weeklyTarget = next.weeklyTarget ?? 2
          next.deadline = null
          if (next.trackingMode === 'checkbox') {
            next.targetValue = 1
            next.targetUnit = null
          }
        } else {
          next.weeklyTarget = null
          next.deadline = null
        }
      }

      if (key === 'trackingMode') {
        const mode = value as TrackingMode
        if (mode === 'checkbox') {
          next.targetValue = null
          next.targetUnit = null
        } else if (mode === 'count') {
          next.targetValue = next.targetValue ?? 1
          next.targetUnit = null
        } else if (mode === 'timer') {
          next.targetValue = next.targetValue ?? 10
          next.targetUnit = 'minutes'
        }
      }

      return next
    })
  }

  function pickTemplate(templateId: string) {
    const template = templateById(templateId)
    if (!template) return
    const next = activityInputFromTemplate(template, 'tiny')
    if (next.type === 'deadline') next.deadline = addDays(todayLocalDate(), 14)
    if (next.trackingMode === 'timer') next.targetUnit = 'minutes'
    setSelectedTemplateId(template.id)
    setInput(next)
    setGoalText('')
    setVideoText('')
    setVideoInvalid(false)
    goPhase('simple')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (goalHabit && input.targetValue == null) return
    const video = videoText.trim() ? parseYoutubeLink(videoText) : null
    if (videoText.trim() && !video) {
      setVideoInvalid(true)
      return
    }
    const videoChanged =
      (video?.youtubeId ?? null) !== (savedVideo?.youtubeId ?? null) ||
      (video?.startSeconds ?? null) !== (savedVideo?.startSeconds ?? null)
    await onSubmit({
      ...withCatalog(input, selectedTemplateId ?? input.templateId ?? null),
      ...(videoChanged ? { video } : {}),
    })
  }

  const showTarget =
    input.type !== 'deadline' &&
    input.type !== 'monthly' &&
    (input.trackingMode === 'timer' || input.trackingMode === 'count')

  const selectedHint = selectedTemplateId
    ? (() => {
        const matched = ACTIVITY_TEMPLATES.find((template) => template.id === selectedTemplateId)
        return matched ? tinyHint(matched) : null
      })()
    : null

  if (initial?.template_id) {
    return <CatalogHabitEdit initial={initial} saving={saving} error={error} onSubmit={onSubmit} />
  }

  if (!initial && phase === 'simple' && selectedTemplateId) {
    const template = templateById(selectedTemplateId)
    if (template) {
      const next = activityInputFromTemplate(template, 'tiny')
      const seed: Activity = {
        id: '',
        user_id: '',
        name: next.name,
        emoji: next.emoji,
        type: next.type,
        tracking_mode: next.trackingMode,
        target_value: next.targetValue,
        target_unit: next.trackingMode === 'timer' ? 'minutes' : next.targetUnit,
        target_effective_from: todayLocalDate(),
        weekly_target: next.weeklyTarget,
        deadline: next.type === 'deadline' ? addDays(todayLocalDate(), 14) : null,
        why_matters: null,
        usually_when: null,
        off_weekdays: [],
        micro_steps: [],
        archived: false,
        template_id: template.id,
        name_overridden: false,
        created_at: '',
        updated_at: '',
      }
      return (
        <>
          <button
            type="button"
            className="btn btn-ghost start-back"
            onClick={() => {
              setSelectedTemplateId(null)
              goPhase('pick')
            }}
          >
            {t('start.back')}
          </button>
          <CatalogHabitEdit initial={seed} saving={saving} error={error} onSubmit={onSubmit} />
        </>
      )
    }
  }

  if (!initial && phase === 'pick') {
    return (
      <div className="activity-form activity-pick">
        <div className="activity-pick-body">
          <div className="field">
            <span className="field-label">{t('form.template')}</span>
            <div className="habit-groups habit-pick">
              {HABIT_GROUPS.map((group) => {
                const ids = group.ids.filter((id) => {
                  const template = templateById(id)
                  if (!template || VITAL_GOAL_IDS.has(id)) return false
                  return !templateAlreadyAdded(template.id, template.label, existingNames)
                })
                if (ids.length === 0) return null
                return (
                <section key={group.title} className="habit-group">
                  <h2 className="habit-group-title">{groupTitle(group.title, locale)}</h2>
                  <div className="onboarding-chips">
                    {ids.map((id) => {
                      const template = templateById(id)
                      if (!template) return null
                      const art = HABIT_ART[template.id]
                      return (
                        <button
                          key={template.id}
                          type="button"
                          className="onboarding-chip habit-tile"
                          onClick={() => pickTemplate(template.id)}
                        >
                          <span className={`habit-tile-icon${art ? ' habit-tile-icon-art' : ''}`} aria-hidden>
                            {art ? (
                              <img className="habit-tile-art" src={themed(art)} alt="" />
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
            </div>
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setSelectedTemplateId(null)
              setInput(emptyInput)
              goPhase('details')
            }}
          >
            Create your own
          </button>
        </div>

        {error && <p className="error">{error}</p>}

        <div className="activity-pick-footer form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
        </div>
      </div>
    )
  }

  return (
    <form className="activity-form" onSubmit={handleSubmit}>
      {!initial && (
        <button
          type="button"
          className="btn btn-ghost start-back"
          onClick={() => {
            setSelectedTemplateId(null)
            setInput(emptyInput)
            goPhase('pick')
          }}
        >
          Back
        </button>
      )}

      {!(initial && goalHabit) && (
        <label className="field">
          <span className="field-label">Name</span>
          <input
            className="field-input"
            value={input.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="e.g. Read book"
            autoFocus
            required
          />
        </label>
      )}

      {goalHabit && (
        <div className="field">
          <span className="field-label">{gapHeading({ templateId: goalTemplateId })}</span>
          <GoalTargetPicker
            habit={{ templateId: goalTemplateId }}
            value={input.targetValue}
            text={goalText}
            onPick={(value) => {
              setGoalText('')
              update('targetValue', value)
            }}
            onText={(text) => {
              setGoalText(text)
              const typed = parseGoalText(goalTemplateId, text)
              if (typed != null) update('targetValue', typed)
            }}
          />
          {selectedHint && !initial ? <p className="screen-sub">{selectedHint}</p> : null}
        </div>
      )}

      {!goalHabit && (
      <fieldset className="field">
        <legend className="field-label">Type</legend>
        <div className="segmented">
          {(
            [
              ['daily', 'Daily'],
              ['weekly_n', 'Weekly'],
              ['monthly', 'Monthly'],
              ['deadline', 'Deadline'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`segmented-btn ${input.type === value ? 'segmented-btn-active' : ''}`}
              onClick={() => update('type', value)}
            >
              {label}
            </button>
          ))}
        </div>
      </fieldset>
      )}

      {!goalHabit && input.type !== 'deadline' && input.type !== 'monthly' && (
        <fieldset className="field">
          <legend className="field-label">Tracking</legend>
          <div className="segmented">
            {(
              [
                ['timer', 'Timer'],
                ['count', 'Count'],
                ['checkbox', 'Checkbox'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={`segmented-btn ${input.trackingMode === value ? 'segmented-btn-active' : ''}`}
                onClick={() => update('trackingMode', value)}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {showTarget && !goalHabit && (
        <div className="field-row">
          <label className="field field-grow">
            <span className="field-label">
              {input.targetUnit === 'glasses'
                ? 'Glasses a day'
                : input.targetUnit === 'g'
                  ? 'Grams a day'
                  : input.targetUnit === 'hours' || input.targetUnit === 'hr'
                    ? 'Hours a day'
                    : input.targetUnit === 'steps'
                      ? t('start.targetSteps')
                      : input.trackingMode === 'timer'
                        ? 'Minutes'
                        : 'Count target'}
            </span>
            <input
              className="field-input"
              type="number"
              min={1}
              step={1}
              value={input.targetValue ?? ''}
              onChange={(e) =>
                update('targetValue', e.target.value ? Number(e.target.value) : null)
              }
              required
            />
          </label>
        </div>
      )}

      {input.type === 'weekly_n' && (
        <label className="field">
          <span className="field-label">Times per week</span>
          <input
            className="field-input"
            type="number"
            min={1}
            max={7}
            step={1}
            value={input.weeklyTarget ?? ''}
            onChange={(e) =>
              update('weeklyTarget', e.target.value ? Number(e.target.value) : null)
            }
            required
          />
        </label>
      )}

      {input.type === 'deadline' && (
        <label className="field">
          <span className="field-label">Deadline</span>
          <input
            className="field-input"
            type="date"
            value={input.deadline ?? ''}
            onChange={(e) => update('deadline', e.target.value || null)}
            required
          />
        </label>
      )}

      {!goalHabit && (
        <label className="field">
          <span className="field-label">Why this matters</span>
          <input
            className="field-input"
            maxLength={80}
            value={input.whyMatters ?? ''}
            onChange={(e) => update('whyMatters', e.target.value || null)}
            placeholder="Optional"
          />
        </label>
      )}

      {!goalHabit && (
        <DayPeriodPicker
          value={activityPeriod({ usuallyWhen: input.usuallyWhen, templateId: input.templateId, name: input.name })}
          onChange={(period) => update('usuallyWhen', period)}
        />
      )}

      {!goalHabit && (
      <fieldset className="field">
        <legend className="field-label">Days off</legend>
        <p className="screen-sub">We won&apos;t ask on these days.</p>
        <div className="onboarding-chips">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((label, index) => {
            const selected = (input.offWeekdays ?? []).includes(index)
            return (
              <button
                key={label}
                type="button"
                className={`onboarding-chip ${selected ? 'onboarding-chip-selected' : ''}`}
                aria-pressed={selected}
                onClick={() => {
                  const current = input.offWeekdays ?? []
                  const next = selected ? current.filter((day) => day !== index) : [...current, index]
                  update('offWeekdays', next)
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
      </fieldset>
      )}

      <label className="field">
        <span className="field-label">{t('form.video')}</span>
        <input
          className="field-input"
          type="text"
          inputMode="url"
          autoComplete="off"
          value={videoText}
          placeholder={t('form.videoPlaceholder')}
          onChange={(e) => {
            setVideoText(e.target.value)
            setVideoInvalid(false)
          }}
        />
        {videoInvalid ? (
          <span className="error">{t('form.videoInvalid')}</span>
        ) : (
          <span className="screen-sub">{t(hasBuiltInVideo ? 'form.videoHintDefault' : 'form.videoHint')}</span>
        )}
      </label>

      {initial && (
        <p className="form-hint">
          Changing the target only applies from today onward — past days keep their original
          target.
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="form-actions activity-pick-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving || (goalHabit && input.targetValue == null)}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create habit'}
        </button>
      </div>
    </form>
  )
}
