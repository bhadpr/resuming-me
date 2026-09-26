import { useEffect, useState, type FormEvent } from 'react'
import { ACTIVITY_TEMPLATES, HABIT_GROUPS, activityInputFromTemplate, templateById, tinyHint } from '../data/activityTemplates'
import { HABIT_ART } from '../data/habitArt'
import { HabitIcon } from './HabitIcon'
import { addDays, todayLocalDate } from '../lib/dates'
import type { Activity, ActivityInput } from '../lib/activities'
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
  onPhaseChange?: (phase: 'pick' | 'details') => void
}) {
  const [phase, setPhase] = useState<'pick' | 'details'>(initial ? 'details' : 'pick')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [input, setInput] = useState<ActivityInput>(
    initial ? fromActivity(initial) : emptyInput,
  )

  useEffect(() => {
    onPhaseChange?.(phase)
  }, [phase, onPhaseChange])

  useEffect(() => {
    scrollFormTop()
  }, [phase])

  function goPhase(next: 'pick' | 'details') {
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
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    await onSubmit(input)
  }

  async function continueWithTemplate() {
    if (!selectedTemplateId || !input.name.trim()) return
    await onSubmit(input)
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

  if (!initial && phase === 'pick') {
    return (
      <div className="activity-form activity-pick">
        <div className="activity-pick-body">
          <div className="field">
            <span className="field-label">Start from a template</span>
            <div className="habit-groups habit-pick">
              {HABIT_GROUPS.map((group) => (
                <section key={group.title} className="habit-group">
                  <h2 className="habit-group-title">{group.title}</h2>
                  <div className="onboarding-chips">
                    {group.ids.map((id) => {
                      const template = templateById(id)
                      if (!template) return null
                      const chosen = selectedTemplateId === template.id
                      const taken = templateAlreadyAdded(template.id, template.label, existingNames)
                      const art = HABIT_ART[template.id]
                      return (
                        <button
                          key={template.id}
                          type="button"
                          className={`onboarding-chip habit-tile ${chosen ? 'onboarding-chip-selected' : ''}`}
                          disabled={taken}
                          aria-pressed={chosen}
                          onClick={() => pickTemplate(template.id)}
                        >
                          <span className={`habit-tile-icon${art ? ' habit-tile-icon-art' : ''}`} aria-hidden>
                            {art ? (
                              <img className="habit-tile-art" src={art} alt="" />
                            ) : (
                              <HabitIcon id={template.id} />
                            )}
                          </span>
                          <span className="habit-tile-label">{template.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </section>
              ))}
            </div>
            {selectedHint ? <p className="screen-sub">{selectedHint}</p> : null}
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
          <button
            type="button"
            className="btn btn-primary"
            disabled={saving || !selectedTemplateId}
            onClick={() => void continueWithTemplate()}
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
            setSelectedTemplateId(null)
            setInput(emptyInput)
            goPhase('pick')
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
          onChange={(e) => update('name', e.target.value)}
          placeholder="e.g. Read book"
          autoFocus
          required
        />
      </label>

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

      {input.type !== 'deadline' && input.type !== 'monthly' && (
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
              {input.targetUnit === 'glasses'
                ? 'Glasses a day'
                : input.targetUnit === 'g'
                  ? 'Grams a day'
                  : input.targetUnit === 'hours' || input.targetUnit === 'hr'
                    ? 'Hours a day'
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

      <label className="field">
        <span className="field-label">Usually when?</span>
        <input
          className="field-input"
          maxLength={40}
          value={input.usuallyWhen ?? ''}
          onChange={(e) => update('usuallyWhen', e.target.value || null)}
          placeholder="Optional"
        />
      </label>

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
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Save changes' : 'Create habit'}
        </button>
      </div>
    </form>
  )
}
