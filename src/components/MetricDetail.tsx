import { useMemo, useState } from 'react'
import { describeMetric, type Metric } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import {
  computeMetricTrendStats,
  type MetricWindowDays,
} from '../lib/stats'
import { MetricTrendChart } from './MetricTrendChart'

interface MetricDetailProps {
  metric: Metric
  entries: MetricEntry[]
  loadingEntries?: boolean
  busy?: boolean
  error?: string | null
  onEdit: () => void
  onBack: () => void
  onArchive: () => Promise<void>
  onUnarchive: () => Promise<void>
  onDelete: () => Promise<void>
}

export function MetricDetail({
  metric,
  entries,
  loadingEntries = false,
  busy = false,
  error = null,
  onEdit,
  onBack,
  onArchive,
  onUnarchive,
  onDelete,
}: MetricDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [windowDays, setWindowDays] = useState<MetricWindowDays>(30)

  const trend = useMemo(
    () => computeMetricTrendStats(entries, windowDays),
    [entries, windowDays],
  )

  return (
    <div className="activity-detail metric-detail">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="detail-hero">
        <span className="detail-emoji" aria-hidden>
          {metric.emoji}
        </span>
        <h2>{metric.name}</h2>
        <p className="screen-sub">{describeMetric(metric)}</p>
        {metric.archived && <span className="badge">Archived</span>}
      </div>

      <div className="segmented window-toggle">
        {([7, 30, 90] as const).map((days) => (
          <button
            key={days}
            type="button"
            className={`segmented-btn ${windowDays === days ? 'segmented-btn-active' : ''}`}
            onClick={() => setWindowDays(days)}
          >
            {days}d
          </button>
        ))}
      </div>

      {loadingEntries ? (
        <p className="muted-center">Loading trend…</p>
      ) : (
        <>
          <MetricTrendChart
            values={trend.values}
            unit={metric.unit}
            min={trend.min}
            max={trend.max}
          />

          <dl className="detail-facts">
            <div>
              <dt>Min</dt>
              <dd>{trend.min == null ? '—' : `${formatNum(trend.min)} ${metric.unit}`}</dd>
            </div>
            <div>
              <dt>Max</dt>
              <dd>{trend.max == null ? '—' : `${formatNum(trend.max)} ${metric.unit}`}</dd>
            </div>
            <div>
              <dt>Avg</dt>
              <dd>{trend.avg == null ? '—' : `${formatNum(trend.avg)} ${metric.unit}`}</dd>
            </div>
            <div>
              <dt>Delta</dt>
              <dd>
                {trend.delta == null
                  ? '—'
                  : `${trend.delta > 0 ? '+' : ''}${formatNum(trend.delta)} ${metric.unit}`}
              </dd>
            </div>
            <div>
              <dt>Points</dt>
              <dd>{trend.values.length}</dd>
            </div>
          </dl>
        </>
      )}

      {error && <p className="error">{error}</p>}

      <div className="detail-actions">
        <button type="button" className="btn btn-primary" onClick={onEdit} disabled={busy}>
          Edit number
        </button>

        {metric.archived ? (
          <div className="detail-archive">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onUnarchive()}
              disabled={busy}
            >
              Show on Numbers again
            </button>
            <p className="activity-desc">Hidden from Numbers. Logged values stay.</p>
          </div>
        ) : (
          <div className="detail-archive">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onArchive()}
              disabled={busy}
            >
              Hide from Numbers
            </button>
            <p className="activity-desc">
              Hide from the list. Logged values stay. Delete is what removes them.
            </p>
          </div>
        )}

        {!confirmDelete ? (
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            Delete permanently…
          </button>
        ) : (
          <div className="confirm-delete">
            <p>
              This permanently deletes <strong>{metric.name}</strong> and any logged values.
              This can&apos;t be undone.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => onDelete()}
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
