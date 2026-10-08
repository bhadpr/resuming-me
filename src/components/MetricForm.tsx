import { useEffect, useState, type FormEvent } from 'react'
import { habitArtFor, habitTemplateId } from '../data/habitArt'
import { isCatalogLabel, templateLabel } from '../lib/catalogName'
import { useLocale } from '../hooks/useLocale'
import { useThemedArt } from '../hooks/useThemedArt'
import { templateById } from '../data/activityTemplates'
import { HabitIcon } from './HabitIcon'
import { HabitMark } from './HabitMark'
import { Icon } from './Icon'
import { GoalTargetPicker, StandardVitalTarget, WeightTargetField } from './GoalTargetPicker'
import { STARTER_METRICS, type Metric, type MetricInput } from '../lib/metrics'
import {
  gapHeading,
  isDailyGoalHabit,
  parseGoalText,
  standardVitalTarget,
  weightUnitOf,
  type WeightUnit,
} from '../lib/onboardingFlow'
import { vitalTarget } from '../lib/vitalTargets'

const UNIT_SUGGESTIONS = ['kg', 'lb', 'hrs', 'bpm', 'score', '%', 'oz', 'glasses'] as const
const CUSTOM_UNIT = '__custom__'

function isPresetUnit(unit: string): boolean {
  return (UNIT_SUGGESTIONS as readonly string[]).includes(unit)
}

function fromMetric(metric: Metric): MetricInput {
  return {
    name: metric.name,
    emoji: metric.emoji,
    unit: metric.unit,
    templateId: metric.template_id ?? null,
    nameOverridden: metric.name_overridden ?? false,
  }
}

const emptyInput: MetricInput = {
  name: '',
  emoji: '⚖️',
  unit: 'kg',
}

function scrollFormTop() {
  window.scrollTo(0, 0)
  document.querySelector('main')?.scrollTo?.(0, 0)
}

function vitalCaption(metric: MetricInput): string | null {
  if (metric.name === 'Systolic') return 'Upper'
  if (metric.name === 'Diastolic') return 'Lower'
  return null
}

function metricAlreadyAdded(name: string, existingNames: readonly string[]): boolean {
  return existingNames.some((item) => item.trim().toLowerCase() === name.trim().toLowerCase())
}

export function MetricForm({
  initial = null,
  existingNames = [],
  saving = false,
  error = null,
  goalHabitIds = [],
  onSubmit,
  onAddGoal,
  onCancel,
  onPhaseChange,
}: {
  initial?: Metric | null
  existingNames?: readonly string[]
  saving?: boolean
  error?: string | null
  /** Template ids already added as daily-goal habits (water, steps…). */
  goalHabitIds?: readonly string[]
  onSubmit: (input: MetricInput, target?: number | null) => Promise<void> | void
  /** Water, protein, fasting, and steps have a daily goal, so they are created as habits. */
  onAddGoal?: (templateId: string, target: number) => Promise<void> | void
  onCancel: () => void
  onPhaseChange?: (phase: 'pick' | 'setup' | 'details') => void
}) {
  const { locale, t } = useLocale()
  const themed = useThemedArt()
  const starting = initial ? fromMetric(initial) : emptyInput
  const [phase, setPhase] = useState<'pick' | 'setup' | 'details'>(initial ? 'details' : 'pick')
  const [input, setInput] = useState<MetricInput>(starting)
  const [useCustomUnit, setUseCustomUnit] = useState(() => !isPresetUnit(starting.unit))
  const editKind = initial ? habitTemplateId({ template_id: initial.template_id, name: initial.name }) : null
  const editGoal = editKind != null && isDailyGoalHabit({ templateId: editKind })
  const savedTarget = initial ? vitalTarget(initial.id) : null
  const [goalValue, setGoalValue] = useState<number | null>(editGoal ? savedTarget : null)
  const [targetText, setTargetText] = useState(() =>
    savedTarget == null || editGoal ? '' : String(savedTarget),
  )
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(() => weightUnitOf(initial?.unit ?? 'kg'))
  const setupId = initial ? editKind : (input.templateId ?? null)
  const goalSetup = !initial && onAddGoal != null && setupId != null && isDailyGoalHabit({ templateId: setupId })
  const weightSetup = setupId === 'weight'
  const standard = standardVitalTarget(setupId)
  const typedTarget = parseGoalText(setupId, targetText)
  const setupTarget = goalSetup ? (typedTarget ?? goalValue) : weightSetup ? typedTarget : null
  const setupReady = goalSetup || weightSetup ? setupTarget != null : true

  const remaining = STARTER_METRICS.filter((metric) => {
    if (metricAlreadyAdded(metric.name, existingNames)) return false
    const id = habitTemplateId({ name: metric.name })
    return !(id && isDailyGoalHabit({ templateId: id }) && goalHabitIds.includes(id))
  })

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])

  useEffect(() => {
    scrollFormTop()
  }, [phase])

  function handleUnitSelect(value: string) {
    if (value === CUSTOM_UNIT) {
      setUseCustomUnit(true)
      setInput((prev) => ({
        ...prev,
        unit: isPresetUnit(prev.unit) ? '' : prev.unit,
      }))
      return
    }
    setUseCustomUnit(false)
    setInput((prev) => ({ ...prev, unit: value }))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (weightSetup) {
      if (typedTarget == null) return
      await onSubmit({ ...input, unit: weightUnit }, typedTarget)
      return
    }
    if (editGoal) {
      const target = typedTarget ?? goalValue
      if (target == null) return
      await onSubmit(input, target)
      return
    }
    await onSubmit(input, standard ? null : typedTarget)
  }

  function openSetup(metric: MetricInput) {
    const templateId = habitTemplateId({ name: metric.name })
    setInput({ ...metric, templateId, nameOverridden: false })
    setUseCustomUnit(!isPresetUnit(metric.unit))
    setGoalValue(templateId ? (templateById(templateId)?.tinyValue ?? null) : null)
    setTargetText('')
    setPhase('setup')
  }

  function backToPick() {
    setInput(emptyInput)
    setUseCustomUnit(false)
    setTargetText('')
    setPhase('pick')
  }

  async function saveSetup() {
    if (!setupReady) return
    if (goalSetup && setupId && setupTarget != null) {
      await onAddGoal?.(setupId, setupTarget)
      return
    }
    if (weightSetup) {
      await onSubmit({ ...input, unit: weightUnit }, setupTarget)
      return
    }
    await onSubmit(input, null)
  }

  const nameLine = (name: string) => (
    <p className="screen-sub start-detail-name">
      <HabitMark templateId={setupId} name={name} emoji={input.emoji} />
      {name}
    </p>
  )

  if (!initial && phase === 'setup') {
    const name = templateLabel(setupId ?? '', locale) ?? input.name
    return (
      <div className="activity-form activity-pick">
        <div className="activity-pick-body">
          <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={backToPick}>
            <Icon name="back" />
            {t('start.back')}
          </button>
          <h1 className="screen-heading">
            {weightSetup ? t('start.targetWeight') : goalSetup ? gapHeading({ templateId: setupId }) : name}
          </h1>
          {(weightSetup || goalSetup) && nameLine(name)}
          {standard && <StandardVitalTarget messageKey={standard} />}
          {goalSetup && (
            <GoalTargetPicker
              habit={{ templateId: setupId }}
              value={goalValue}
              text={targetText}
              onPick={(value) => {
                setTargetText('')
                setGoalValue(value)
              }}
              onText={setTargetText}
            />
          )}
          {weightSetup && (
            <WeightTargetField
              text={targetText}
              unit={weightUnit}
              onText={setTargetText}
              onUnit={setWeightUnit}
            />
          )}
        </div>

        {error && <p className="error">{error}</p>}

        <div className="activity-pick-footer form-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !setupReady}
            onClick={() => void saveSetup()}
          >
            {saving ? 'Saving…' : t('start.save')}
          </button>
        </div>
      </div>
    )
  }

  if (!initial && phase === 'pick') {
    return (
      <div className="activity-form activity-pick">
        <div className="activity-pick-body">
          <div className="field">
            <span className="field-label">Start from a vital</span>
            {remaining.length === 0 ? (
              <p className="screen-sub">You already have the usual ones. Create your own below.</p>
            ) : (
              <div className="habit-groups habit-pick">
                <div className="onboarding-chips">
                  {remaining.map((metric) => {
                    const art = habitArtFor({ name: metric.name })
                    const caption = vitalCaption(metric)
                    return (
                      <button
                        key={metric.name}
                        type="button"
                        className="onboarding-chip habit-tile"
                        onClick={() => openSetup(metric)}
                      >
                        <span className={`habit-tile-icon${art ? ' habit-tile-icon-art' : ''}`} aria-hidden>
                          {art ? (
                            <img className="habit-tile-art" src={themed(art)} alt="" />
                          ) : (
                            <HabitIcon id={habitTemplateId({ name: metric.name }) ?? 'custom'} />
                          )}
                        </span>
                        <span className="habit-tile-label">
                          {templateLabel(habitTemplateId({ name: metric.name }) ?? '', locale) ?? metric.name}
                          {caption ? <span className="habit-tile-caption">{caption}</span> : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setInput(emptyInput)
              setUseCustomUnit(false)
              setPhase('details')
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

  if (initial && (weightSetup || standard || editGoal)) {
    const unitChanged = weightSetup && weightUnit !== weightUnitOf(initial.unit)
    const canSave = weightSetup ? typedTarget != null : editGoal ? (typedTarget ?? goalValue) != null : false
    return (
      <form className="activity-form" onSubmit={handleSubmit}>
        {standard && <StandardVitalTarget messageKey={standard} />}
        {editGoal && (
          <div className="field">
            <span className="field-label">{gapHeading({ templateId: setupId })}</span>
            <GoalTargetPicker
              habit={{ templateId: setupId }}
              value={goalValue}
              text={targetText}
              onPick={(value) => {
                setTargetText('')
                setGoalValue(value)
              }}
              onText={setTargetText}
            />
          </div>
        )}
        {weightSetup && (
          <WeightTargetField
            text={targetText}
            unit={weightUnit}
            onText={setTargetText}
            onUnit={setWeightUnit}
            autoFocus={false}
          />
        )}
        {unitChanged && <p className="form-hint">{t('start.pastReadings')}</p>}

        {error && <p className="error">{error}</p>}

        <div className="form-actions activity-pick-footer">
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
            {standard ? t('start.back') : 'Cancel'}
          </button>
          {!standard && (
            <button type="submit" className="btn btn-primary" disabled={saving || !canSave}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <form className="activity-form" onSubmit={handleSubmit}>
      {!initial && (
        <button
          type="button"
          className="btn btn-ghost start-back"
          onClick={backToPick}
        >
          Back
        </button>
      )}

      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="field-input"
          value={input.name}
          onChange={(e) =>
            setInput((prev) => {
              const name = e.target.value
              const templateId = prev.templateId ?? null
              return {
                ...prev,
                name,
                nameOverridden: templateId != null && !isCatalogLabel(templateId, name),
              }
            })
          }
          placeholder="e.g. Weight"
          autoFocus
          required
        />
      </label>

      <div className="field">
        <span className="field-label">Unit</span>
        <select
          className="field-input"
          value={useCustomUnit ? CUSTOM_UNIT : input.unit}
          onChange={(e) => handleUnitSelect(e.target.value)}
          required={!useCustomUnit}
        >
          {UNIT_SUGGESTIONS.map((unit) => (
            <option key={unit} value={unit}>
              {unit}
            </option>
          ))}
          <option value={CUSTOM_UNIT}>Other…</option>
        </select>
        {useCustomUnit && (
          <input
            className="field-input"
            value={input.unit}
            onChange={(e) => setInput((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="e.g. 1-5"
            required
            autoFocus
          />
        )}
      </div>

      <label className="field">
        <span className="field-label">{t('start.targetOptional')}</span>
        <input
          className="field-input"
          inputMode="decimal"
          value={targetText}
          onChange={(e) => setTargetText(e.target.value)}
          enterKeyHint="done"
        />
      </label>

      {error && <p className="error">{error}</p>}

      <div className="form-actions activity-pick-footer">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create vital'}
        </button>
      </div>
    </form>
  )
}
