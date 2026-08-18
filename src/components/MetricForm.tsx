import { useState, type FormEvent } from 'react'
import { EmojiPicker, METRIC_EMOJIS } from './EmojiPicker'
import type { Metric, MetricInput } from '../lib/metrics'

const UNIT_SUGGESTIONS = ['lbs', 'kg', 'hrs', 'bpm', 'score', '%', 'oz', 'glasses'] as const
const CUSTOM_UNIT = '__custom__'

function isPresetUnit(unit: string): boolean {
  return (UNIT_SUGGESTIONS as readonly string[]).includes(unit)
}

interface MetricFormProps {
  initial?: Metric | null
  saving?: boolean
  error?: string | null
  onSubmit: (input: MetricInput) => Promise<void> | void
  onCancel: () => void
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

export function MetricForm({
  initial = null,
  saving = false,
  error = null,
  onSubmit,
  onCancel,
}: MetricFormProps) {
  const starting = initial ? fromMetric(initial) : emptyInput
  const [input, setInput] = useState<MetricInput>(starting)
  const [useCustomUnit, setUseCustomUnit] = useState(() => !isPresetUnit(starting.unit))

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

  return (
    <form className="activity-form" onSubmit={handleSubmit}>
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
        <span className="field-label">Emoji</span>
        <EmojiPicker
          value={input.emoji}
          onChange={(emoji) => setInput((prev) => ({ ...prev, emoji }))}
          options={METRIC_EMOJIS}
          label="Number emoji"
        />
      </div>

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

      <p className="form-hint">
        A number you log once a day from Today. No target.
      </p>

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Add number'}
        </button>
      </div>
    </form>
  )
}
