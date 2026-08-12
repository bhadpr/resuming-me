import { useMemo, useState } from 'react'
import {
  getStarterActivityTemplates,
  getStarterMetricTemplates,
} from '../lib/onboarding'

interface OnboardingScreenProps {
  saving?: boolean
  error?: string | null
  onComplete: (selection: {
    activityIds: string[]
    metricIds: string[]
  }) => Promise<void>
  onSkip: () => void
}

export function OnboardingScreen({
  saving = false,
  error = null,
  onComplete,
  onSkip,
}: OnboardingScreenProps) {
  const activityTemplates = useMemo(() => getStarterActivityTemplates(), [])
  const metricTemplates = useMemo(() => getStarterMetricTemplates(), [])

  const [selectedActivities, setSelectedActivities] = useState<Set<string>>(
    () => new Set(activityTemplates.map((t) => t.id)),
  )
  const [selectedMetrics, setSelectedMetrics] = useState<Set<string>>(
    () => new Set(metricTemplates.map((t) => t.id)),
  )

  function toggleActivity(id: string) {
    setSelectedActivities((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleMetric(id: string) {
    setSelectedMetrics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const canSubmit = selectedActivities.size > 0 || selectedMetrics.size > 0

  return (
    <div className="onboarding-screen">
      <div className="screen-heading">
        <div>
          <h2>Get started</h2>
          <p className="screen-sub">
            Pick a few starters — you can edit or add more anytime.
          </p>
        </div>
      </div>

      <section className="today-section">
        <h3 className="section-label">Activities</h3>
        <ul className="template-list">
          {activityTemplates.map((t) => {
            const selected = selectedActivities.has(t.id)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`template-option ${selected ? 'template-option-selected' : ''}`}
                  onClick={() => toggleActivity(t.id)}
                  aria-pressed={selected}
                  disabled={saving}
                >
                  <span className="activity-emoji" aria-hidden>
                    {t.input.emoji}
                  </span>
                  <span className="activity-meta">
                    <span className="activity-name">{t.label}</span>
                    <span className="activity-desc">{t.blurb}</span>
                  </span>
                  <span className="theme-check" aria-hidden>
                    {selected ? '●' : '○'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="today-section">
        <h3 className="section-label">Metrics</h3>
        <ul className="template-list">
          {metricTemplates.map((t) => {
            const selected = selectedMetrics.has(t.id)
            return (
              <li key={t.id}>
                <button
                  type="button"
                  className={`template-option ${selected ? 'template-option-selected' : ''}`}
                  onClick={() => toggleMetric(t.id)}
                  aria-pressed={selected}
                  disabled={saving}
                >
                  <span className="activity-emoji" aria-hidden>
                    {t.input.emoji}
                  </span>
                  <span className="activity-meta">
                    <span className="activity-name">{t.label}</span>
                    <span className="activity-desc">{t.blurb}</span>
                  </span>
                  <span className="theme-check" aria-hidden>
                    {selected ? '●' : '○'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {error && <p className="error">{error}</p>}

      <div className="onboarding-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || !canSubmit}
          onClick={() =>
            void onComplete({
              activityIds: [...selectedActivities],
              metricIds: [...selectedMetrics],
            })
          }
        >
          {saving ? 'Setting up…' : 'Start tracking'}
        </button>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={saving}
          onClick={onSkip}
        >
          Skip for now
        </button>
      </div>
    </div>
  )
}
