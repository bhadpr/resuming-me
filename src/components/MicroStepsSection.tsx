import { useEffect, useMemo, useState } from 'react'
import type { Activity } from '../lib/activities'
import { daysBetween, todayLocalDate } from '../lib/dates'
import { readStoredMicroSteps, type MicroStep } from '../lib/microSteps'

interface MicroStepsSectionProps {
  activity: Activity
  busy?: boolean
  onBreakDown: () => Promise<{ steps?: MicroStep[]; error?: string }>
}

export function MicroStepsSection({
  activity,
  busy = false,
  onBreakDown,
}: MicroStepsSectionProps) {
  const [steps, setSteps] = useState<MicroStep[]>(() =>
    readStoredMicroSteps(activity.micro_steps),
  )
  const [checked, setChecked] = useState<boolean[]>([])
  const [breakingDown, setBreakingDown] = useState(false)
  const [breakdownError, setBreakdownError] = useState<string | null>(null)

  useEffect(() => {
    const next = readStoredMicroSteps(activity.micro_steps)
    setSteps(next)
    setChecked(next.map(() => false))
    setBreakdownError(null)
  }, [activity.id, activity.micro_steps])

  const daysLeft = useMemo(() => {
    if (!activity.deadline) return null
    return daysBetween(todayLocalDate(), activity.deadline)
  }, [activity.deadline])

  async function handleBreakDown() {
    setBreakingDown(true)
    setBreakdownError(null)
    try {
      const result = await onBreakDown()
      if (result.error) {
        setBreakdownError(result.error)
        return
      }
      if (result.steps) {
        setSteps(result.steps)
        setChecked(result.steps.map(() => false))
      }
    } catch {
      setBreakdownError('Something went wrong. Try again in a moment.')
    } finally {
      setBreakingDown(false)
    }
  }

  const loading = busy || breakingDown

  return (
    <section className="micro-steps-section">
      <div className="micro-steps-header">
        <h3 className="section-label">Micro-steps</h3>
        {daysLeft != null && (
          <span className="micro-steps-countdown">
            {daysLeft < 0
              ? `${Math.abs(daysLeft)}d overdue`
              : daysLeft === 0
                ? 'Due today'
                : `${daysLeft}d left`}
          </span>
        )}
      </div>

      {steps.length > 0 ? (
        <ul className="micro-steps-list">
          {steps.map((step, index) => (
            <li key={`${index}-${step.text}`}>
              <label className="micro-step-row">
                <input
                  type="checkbox"
                  checked={checked[index] ?? false}
                  onChange={(e) =>
                    setChecked((prev) => {
                      const next = [...prev]
                      next[index] = e.target.checked
                      return next
                    })
                  }
                />
                <span className="micro-step-text">{step.text}</span>
                {step.minutes != null && (
                  <span className="micro-step-minutes">~{step.minutes} min</span>
                )}
              </label>
            </li>
          ))}
        </ul>
      ) : (
        <p className="micro-steps-empty">
          Break a big deadline into three small steps when AI breakdown is enabled.
        </p>
      )}

      {breakdownError && (
        <div className="notice notice-warning micro-steps-notice" role="status">
          <p>{breakdownError}</p>
        </div>
      )}

      <button
        type="button"
        className="btn btn-secondary btn-compact"
        disabled={loading}
        onClick={() => void handleBreakDown()}
      >
        {loading
          ? 'Breaking down…'
          : steps.length > 0
            ? 'Regenerate steps'
            : 'Break this down'}
      </button>
    </section>
  )
}
