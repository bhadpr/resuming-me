import { useState, type FormEvent } from 'react'
import { EmojiPicker } from './EmojiPicker'
import type { Activity, ActivityInput } from '../lib/activities'
import type { ActivityType, TrackingMode } from '../types/database'

interface ActivityFormProps {
  initial?: Activity | null
  saving?: boolean
  error?: string | null
  onSubmit: (input: ActivityInput) => Promise<void> | void
  onCancel: () => void
}

function fromActivity(activity: Activity): ActivityInput {
  return {
    name: activity.name,
    emoji: activity.emoji,
    type: activity.type,
    trackingMode: activity.tracking_mode,
    targetValue: activity.target_value,
    targetUnit: activity.target_unit,
    weeklyTarget: activity.weekly_target,
    deadline: activity.deadline,
  }
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
}

export function ActivityForm({
  initial = null,
  saving = false,
  error = null,
  onSubmit,
  onCancel,
}: ActivityFormProps) {
  const [input, setInput] = useState<ActivityInput>(
    initial ? fromActivity(initial) : emptyInput,
  )

  function update<K extends keyof ActivityInput>(key: K, value: ActivityInput[K]) {
    setInput((prev) => {
      const next = { ...prev, [key]: value }

      // Sensible defaults when switching type / mode
      if (key === 'type') {
        const type = value as ActivityType
        if (type === 'deadline') {
          next.trackingMode = 'checkbox'
          next.targetValue = null
          next.targetUnit = null
          next.weeklyTarget = null
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
          next.targetUnit = next.targetUnit ?? 'minutes'
        }
      }

      return next
    })
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSubmit(input)
  }

  const showTarget =
    input.type !== 'deadline' &&
    (input.trackingMode === 'timer' || input.trackingMode === 'count')

  return (
    <form className="activity-form" onSubmit={handleSubmit}>
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

      <div className="field">
        <span className="field-label">Emoji</span>
        <EmojiPicker value={input.emoji} onChange={(emoji) => update('emoji', emoji)} />
      </div>

      <fieldset className="field">
        <legend className="field-label">Type</legend>
        <div className="segmented">
          {(
            [
              ['daily', 'Daily'],
              ['weekly_n', 'Weekly'],
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

      {input.type !== 'deadline' && (
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

      {showTarget && (
        <div className="field-row">
          <label className="field field-grow">
            <span className="field-label">
              {input.trackingMode === 'timer' ? 'Minutes' : 'Count target'}
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
          {input.trackingMode === 'timer' && (
            <label className="field field-grow">
              <span className="field-label">Unit</span>
              <select
                className="field-input"
                value={input.targetUnit ?? 'minutes'}
                onChange={(e) => update('targetUnit', e.target.value)}
              >
                <option value="minutes">minutes</option>
                <option value="seconds">seconds</option>
              </select>
            </label>
          )}
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

      {initial && (
        <p className="form-hint">
          Changing the target only applies from today onward — past days keep their original
          target.
        </p>
      )}

      {error && <p className="error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create activity'}
        </button>
      </div>
    </form>
  )
}
