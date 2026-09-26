import { describeMetric, type Metric } from '../lib/metrics'
import { ArchivedFilter } from './ArchivedFilter'
import { HabitMark } from './HabitMark'

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
  const archivedCount = metrics.filter((m) => m.archived).length

  return (
    <div className="activity-list-screen">
      <div className="screen-heading">
        <div>
          <h2>Vitals</h2>
          <p className="screen-sub">Numbers you check in on.</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          Add
        </button>
      </div>

      <ArchivedFilter
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggle={onToggleArchived}
        showLabel="Show hidden from Vitals"
      />

      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : visible.length === 0 ? (
        <section className="empty-state">
          <p className="empty-state-emoji">⚖️</p>
          <h2>Nothing here yet</h2>
          <p>Weight, steps, blood pressure, or another number you want to keep.</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            Add vital
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
                <HabitMark name={metric.name} />
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
