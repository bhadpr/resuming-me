import { describeMetric, STARTER_METRICS, type Metric, type MetricInput } from '../lib/metrics'

interface MetricListProps {
  metrics: Metric[]
  loading: boolean
  showArchived: boolean
  onToggleArchived: () => void
  onSelect: (metric: Metric) => void
  onAdd: () => void
  onQuickAdd: (input: MetricInput) => void
}

export function MetricList({
  metrics,
  loading,
  showArchived,
  onToggleArchived,
  onSelect,
  onAdd,
  onQuickAdd,
}: MetricListProps) {
  const visible = showArchived ? metrics : metrics.filter((m) => !m.archived)
  const existingNames = new Set(visible.map((m) => m.name.toLowerCase()))
  const starters = STARTER_METRICS.filter(
    (metric) => !existingNames.has(metric.name.toLowerCase()),
  )

  return (
    <div className="activity-list-screen">
      <div className="screen-heading">
        <div>
          <h2>Metrics</h2>
          <p className="screen-sub">Track daily numbers like weight or mood.</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          Add
        </button>
      </div>

      <label className="toggle-row">
        <input type="checkbox" checked={showArchived} onChange={onToggleArchived} />
        <span>Show archived</span>
      </label>

      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : visible.length === 0 ? (
        <section className="empty-state">
          <p className="empty-state-emoji">⚖️</p>
          <h2>No metrics yet</h2>
          <p>Start with Weight or Sleep. You can add more later.</p>
          <div className="onboarding-chips">
            {starters.map((metric) => (
              <button
                key={metric.name}
                type="button"
                className="onboarding-chip"
                onClick={() => onQuickAdd(metric)}
              >
                {metric.emoji} {metric.name}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-ghost" onClick={onAdd}>
            Something else
          </button>
        </section>
      ) : (
        <ul className="activity-list">
          {visible.map((metric) => (
            <li key={metric.id}>
              <button
                type="button"
                className={`activity-row ${metric.archived ? 'activity-row-archived' : ''}`}
                onClick={() => onSelect(metric)}
              >
                <span className="activity-emoji" aria-hidden>
                  {metric.emoji}
                </span>
                <span className="activity-meta">
                  <span className="activity-name">
                    {metric.name}
                    {metric.archived && <span className="badge">Archived</span>}
                  </span>
                  <span className="activity-desc">{describeMetric(metric)}</span>
                </span>
                <span className="activity-chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
