import { useEffect, useState, type FormEvent } from 'react'
import { habitArtFor, habitTemplateId } from '../data/habitArt'
import { HabitIcon } from './HabitIcon'
import { STARTER_METRICS, type Metric, type MetricInput } from '../lib/metrics'

const UNIT_SUGGESTIONS = ['lbs', 'kg', 'hrs', 'bpm', 'score', '%', 'oz', 'glasses'] as const
const CUSTOM_UNIT = '__custom__'

function isPresetUnit(unit: string): boolean {
  return (UNIT_SUGGESTIONS as readonly string[]).includes(unit)
}

function fromMetric(metric: Metric): MetricInput {
  return {
    name: metric.name,
    emoji: metric.emoji,
    unit: metric.unit,
  }
}

const emptyInput: MetricInput = {
  name: '',
  emoji: '⚖️',
  unit: 'lbs',
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
  onSubmit,
  onCancel,
  onPhaseChange,
}: {
  initial?: Metric | null
  existingNames?: readonly string[]
  saving?: boolean
  error?: string | null
  onSubmit: (input: MetricInput) => Promise<void> | void
  onCancel: () => void
  onPhaseChange?: (phase: 'pick' | 'details') => void
}) {
  const starting = initial ? fromMetric(initial) : emptyInput
  const [phase, setPhase] = useState<'pick' | 'details'>(initial ? 'details' : 'pick')
  const [selectedName, setSelectedName] = useState<string | null>(null)
  const [input, setInput] = useState<MetricInput>(starting)
  const [useCustomUnit, setUseCustomUnit] = useState(() => !isPresetUnit(starting.unit))

  const remaining = STARTER_METRICS.filter(
    (metric) => !metricAlreadyAdded(metric.name, existingNames),
  )

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
    await onSubmit(input)
  }

  async function continueWithStarter() {
    if (!selectedName || !input.name.trim()) return
    await onSubmit(input)
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
                    const chosen = selectedName === metric.name
                    const art = habitArtFor({ name: metric.name })
                    const caption = vitalCaption(metric)
                    return (
                      <button
                        key={metric.name}
                        type="button"
                        className={`onboarding-chip habit-tile ${chosen ? 'onboarding-chip-selected' : ''}`}
                        aria-pressed={chosen}
                        onClick={() => {
                          setSelectedName(metric.name)
                          setInput(metric)
                          setUseCustomUnit(!isPresetUnit(metric.unit))
                        }}
                      >
                        <span className={`habit-tile-icon${art ? ' habit-tile-icon-art' : ''}`} aria-hidden>
                          {art ? (
                            <img className="habit-tile-art" src={art} alt="" />
                          ) : (
                            <HabitIcon id={habitTemplateId({ name: metric.name }) ?? 'custom'} />
                          )}
                        </span>
                        <span className="habit-tile-label">
                          {metric.name}
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
              setSelectedName(null)
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !selectedName}
            onClick={() => void continueWithStarter()}
          >
            {saving ? 'Saving…' : 'Continue'}
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
            setSelectedName(null)
            setInput(emptyInput)
            setUseCustomUnit(false)
            setPhase('pick')
          }}
        >
          Back
        </button>
      )}

      <label className="field">
        <span className="field-label">Name</span>
        <input
          className="field-input"
          value={input.name}
          onChange={(e) => setInput((prev) => ({ ...prev, name: e.target.value }))}
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

      <p className="form-hint">A number you log once a day from Today. No target.</p>

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
