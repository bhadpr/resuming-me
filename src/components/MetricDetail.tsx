import { useMemo, useState } from 'react'
import { describeMetric, type Metric } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import type { Activity } from '../lib/activities'
import {
  computeMetricTrendStats,
  type MetricWindowDays,
} from '../lib/stats'
import { HabitMark } from './HabitMark'
import { visibleName } from '../lib/catalogName'
import { habitTemplateId } from '../data/habitArt'
import { standardVitalTarget } from '../lib/onboardingFlow'
import { useLocale } from '../hooks/useLocale'
import { VitalTrend } from './VitalTrend'
import { formatPair, formatPairDelta } from '../lib/vitalChart'
import { todayLocalDate } from '../lib/dates'
import { Icon } from './Icon'

interface MetricDetailProps {
  metric: Metric
  entries: MetricEntry[]
  /** Habits, for the goal of water, protein, fasting and steps. */
  activities: Activity[]
  loadingEntries?: boolean
  busy?: boolean
  error?: string | null
  onEdit: () => void
  onBack: () => void
  onUnarchive: () => Promise<void>
  onDelete: () => Promise<void>
}

export function MetricDetail({
  metric,
  entries,
  activities,
  loadingEntries = false,
  busy = false,
  error = null,
  onEdit,
  onBack,
  onUnarchive,
  onDelete,
}: MetricDetailProps) {
  const { locale, t } = useLocale()
  const name = visibleName(metric, locale)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [windowDays, setWindowDays] = useState<MetricWindowDays>(30)

  const trend = useMemo(
    () => computeMetricTrendStats(entries, windowDays),
    [entries, windowDays],
  )

  return (
    <div className="activity-detail metric-detail">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <Icon name="back" />
        Back
      </button>

      <div className="detail-hero detail-hero-row">
        <HabitMark name={name} templateId={metric.template_id} />
        <div className="detail-hero-text">
          <h2>{name}</h2>
          <p className="screen-sub">{describeMetric(metric)}</p>
          {metric.archived && <span className="badge">Archived</span>}
        </div>
      </div>

      {!standardVitalTarget(habitTemplateId(metric)) && (
        <div className="detail-top-actions">
          <button type="button" className="btn btn-primary" onClick={onEdit} disabled={busy}>
            Edit
          </button>
        </div>
      )}

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
          <VitalTrend
            metric={metric}
            entries={entries}
            activities={activities}
            values={trend.values}
            windowDays={windowDays}
            today={todayLocalDate()}
          />

          <dl className="detail-facts">
            <div>
              <dt>Min</dt>
              <dd>
                {trend.min == null
                  ? '—'
                  : `${formatPair(trend.min, trend.secondaryMin)} ${metric.unit}`}
              </dd>
            </div>
            <div>
              <dt>Max</dt>
              <dd>
                {trend.max == null
                  ? '—'
                  : `${formatPair(trend.max, trend.secondaryMax)} ${metric.unit}`}
              </dd>
            </div>
            <div>
              <dt>Avg</dt>
              <dd>
                {trend.avg == null
                  ? '—'
                  : `${formatPair(roundOne(trend.avg), trend.secondaryAvg == null ? null : roundOne(trend.secondaryAvg))} ${metric.unit}`}
              </dd>
            </div>
            <div>
              <dt>Delta</dt>
              <dd>
                {trend.delta == null
                  ? '—'
                  : `${formatPairDelta(trend.delta, trend.secondaryDelta)} ${metric.unit}`}
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
        {metric.archived && (
          <div className="detail-archive">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onUnarchive()}
              disabled={busy}
            >
              {t('metricDetail.showAgain')}
            </button>
            <p className="activity-desc">{t('metricDetail.hidden')}</p>
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
              This permanently deletes <strong>{name}</strong> and any logged values.
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

function roundOne(n: number): number {
  return Math.round(n * 10) / 10
}
