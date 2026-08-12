import { describeMetric, type Metric } from '../lib/metrics'

interface MetricListProps {
  metrics: Metric[]
  loading: boolean
  showArchived: boolean
  onToggleArchived: () => void
  onSelect: (metric: Metric) => void
  onAdd: () => void
}

export function MetricList({
  metrics,
  loading,
  showArchived,
  onToggleArchived,
  onSelect,
  onAdd,
}: MetricListProps) {
  const visible = showArchived ? metrics : metrics.filter((m) => !m.archived)

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
          <p>Add something like Weight or Hours slept to track over time.</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            Add metric
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
