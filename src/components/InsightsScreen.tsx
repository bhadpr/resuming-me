import { useEffect, useMemo, useState } from 'react'
import type { Activity } from '../lib/activities'
import type { LogEntry } from '../lib/logs'
import { STARTER_METRICS, type Metric, type MetricInput } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import {
  buildActivityInsightSeries,
  formatPercent,
  INSIGHTS_WINDOW_DAYS,
  type InsightsResult,
  type InsightsWindow,
} from '../lib/insights'
import { computeMetricTrendStats } from '../lib/stats'
import { ActivityInsightChart } from './ActivityInsightChart'
import { MetricTrendChart } from './MetricTrendChart'

function activityKey(id: string) {
  return `activity:${id}`
}

function metricKey(id: string) {
  return `metric:${id}`
}

interface InsightsScreenProps {
  window: InsightsWindow
  onWindowChange: (window: InsightsWindow) => void
  insights: InsightsResult | null
  activities: Activity[]
  entries: LogEntry[]
  metrics: Metric[]
  metricEntries: MetricEntry[]
  today: string
  loading: boolean
  error: string | null
  onAddActivity: () => void
  onAddMetric: (input: MetricInput) => void
}

export function InsightsScreen({
  window,
  onWindowChange,
  insights,
  activities,
  entries,
  metrics,
  metricEntries,
  today,
  loading,
  error,
  onAddActivity,
  onAddMetric,
}: InsightsScreenProps) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set())
  const [didInitOpen, setDidInitOpen] = useState(false)

  const activeMetrics = useMemo(
    () => metrics.filter((m) => !m.archived),
    [metrics],
  )
  const activeActivities = useMemo(
    () => activities.filter((a) => !a.archived),
    [activities],
  )
  const empty =
    !loading && activeActivities.length === 0 && activeMetrics.length === 0

  useEffect(() => {
    if (didInitOpen || loading || !insights) return
    const first =
      insights.activities[0] != null
        ? activityKey(insights.activities[0].activityId)
        : activeMetrics[0] != null
          ? metricKey(activeMetrics[0].id)
          : 'skip-days'
    setOpenKeys(new Set([first]))
    setDidInitOpen(true)
  }, [didInitOpen, loading, insights, activeMetrics])

  function isOpen(key: string) {
    return openKeys.has(key)
  }

  function toggle(key: string) {
    setOpenKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="insights-screen">
      <div className="screen-heading">
        <div>
          <h2>Insights</h2>
          <p className="screen-sub">Where skips pile up.</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : empty ? (
        <section className="empty-state">
          <p className="empty-state-emoji">📊</p>
          <h2>Insights need a few days</h2>
          <p>Add something you’ve been putting off, or log Weight or Sleep.</p>
          <div className="onboarding-chips">
            {STARTER_METRICS.map((metric) => (
              <button
                key={metric.name}
                type="button"
                className="onboarding-chip"
                onClick={() => onAddMetric(metric)}
              >
                {metric.emoji} {metric.name}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={onAddActivity}>
            Add something to resume
          </button>
        </section>
      ) : !insights ? (
        <p className="muted-center">Loading…</p>
      ) : (
        <>
          <div className="segmented window-toggle">
            <button
              type="button"
              className={`segmented-btn ${window === 'week' ? 'segmented-btn-active' : ''}`}
              onClick={() => onWindowChange('week')}
            >
              Week
            </button>
            <button
              type="button"
              className={`segmented-btn ${window === 'month' ? 'segmented-btn-active' : ''}`}
              onClick={() => onWindowChange('month')}
            >
              Month
            </button>
          </div>
          <section className="insights-summary">
            <p>{insights.summary}</p>
            <p className="screen-sub">
              {insights.from} → {insights.to}
            </p>
          </section>

          <section className="today-section">
            <h3 className="section-label">Skipped</h3>
            <p className="screen-sub insights-hint">
              Tap an activity for its {window} chart.
            </p>
            {insights.activities.length === 0 ? (
              <p className="muted-center">No repeating activities on Insights yet.</p>
            ) : (
              <ul className="insights-list">
                {insights.activities.map((a) => {
                  const key = activityKey(a.activityId)
                  const open = isOpen(key)
                  const activity = activities.find((x) => x.id === a.activityId)
                  const series =
                    open && activity
                      ? buildActivityInsightSeries(activity, entries, window, today)
                      : []
                  return (
                    <li
                      key={a.activityId}
                      className={`insights-row-wrap ${open ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className={`insights-row ${open ? 'insights-row-active' : ''}`}
                        onClick={() => toggle(key)}
                        aria-expanded={open}
                      >
                        <span className="activity-emoji" aria-hidden>
                          {a.emoji}
                        </span>
                        <span className="activity-meta">
                          <span className="activity-name">{a.name}</span>
                          <span className="activity-desc">
                            {a.scheduled === 0
                              ? 'Nothing scheduled yet'
                              : `Skipped ${a.postponed} of ${a.scheduled} this ${window}`}
                          </span>
                          <div className="progress-bar" aria-hidden>
                            <div
                              className="progress-bar-fill progress-bar-fill-warn"
                              style={{
                                width: `${Math.round(a.postponementRate * 100)}%`,
                              }}
                            />
                          </div>
                        </span>
                        <span className="insights-rate">
                          {formatPercent(a.postponementRate)}
                        </span>
                      </button>
                      {open && activity && (
                        <div className="insights-row-chart">
                          <ActivityInsightChart
                            points={series}
                            windowLabel={window === 'week' ? '7-day' : '30-day'}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="today-section">
            <h3 className="section-label">Metrics</h3>
            <p className="screen-sub insights-hint">
              Tap a metric for its {window} trend.
            </p>
            {activeMetrics.length === 0 ? (
              <p className="muted-center">Add a number from Metrics.</p>
            ) : (
              <ul className="insights-list">
                {activeMetrics.map((m) => {
                  const key = metricKey(m.id)
                  const open = isOpen(key)
                  const rows = metricEntries.filter((e) => e.metric_id === m.id)
                  const windowDays = INSIGHTS_WINDOW_DAYS[window]
                  const trend = computeMetricTrendStats(
                    rows,
                    windowDays as 7 | 30,
                    today,
                  )
                  const latest =
                    trend.values.length > 0
                      ? trend.values[trend.values.length - 1]
                      : null
                  return (
                    <li
                      key={m.id}
                      className={`insights-row-wrap ${open ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className={`insights-row ${open ? 'insights-row-active' : ''}`}
                        onClick={() => toggle(key)}
                        aria-expanded={open}
                      >
                        <span className="activity-emoji" aria-hidden>
                          {m.emoji}
                        </span>
                        <span className="activity-meta">
                          <span className="activity-name">{m.name}</span>
                          <span className="activity-desc">
                            {latest
                              ? `Latest ${latest.value} ${m.unit} · ${trend.values.length} points`
                              : `No logs in this ${window} yet`}
                          </span>
                        </span>
                        <span className="insights-rate">
                          {trend.delta == null
                            ? '—'
                            : `${trend.delta > 0 ? '+' : ''}${formatNum(trend.delta)}`}
                        </span>
                      </button>
                      {open && (
                        <div className="insights-row-chart">
                          <MetricTrendChart
                            values={trend.values}
                            unit={m.unit}
                            min={trend.min}
                            max={trend.max}
                          />
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="today-section">
            <h3 className="section-label">Patterns</h3>
            <p className="screen-sub insights-hint">
              Tap a pattern for its {window} chart.
            </p>
            <ul className="insights-list">
              <li
                className={`insights-row-wrap ${isOpen('skip-days') ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className={`insights-row ${isOpen('skip-days') ? 'insights-row-active' : ''}`}
                  onClick={() => toggle('skip-days')}
                  aria-expanded={isOpen('skip-days')}
                >
                  <span className="activity-emoji" aria-hidden>
                    📅
                  </span>
                  <span className="activity-meta">
                    <span className="activity-name">When you put things off</span>
                    <span className="activity-desc">
                      {insights.peakSkipDay
                        ? `${insights.peakSkipDay.label} shows up most (${insights.peakSkipDay.count} this ${window}).`
                        : 'Nothing put off in this window yet.'}
                    </span>
                  </span>
                  <span className="insights-rate">
                    {insights.peakSkipDay ? insights.peakSkipDay.label : '—'}
                  </span>
                </button>
                {isOpen('skip-days') && (
                  <div className="insights-row-chart">
                    <div className="insights-pattern-chart">
                      <div className="bar-grid">
                        {insights.dayOfWeekSkips.map((d) => (
                          <div key={d.key} className="bar-grid-item">
                            <div className="bar-grid-track">
                              <div
                                className="bar-grid-fill"
                                style={{
                                  height: `${barHeight(d.count, insights.dayOfWeekSkips)}%`,
                                }}
                              />
                            </div>
                            <span className="bar-grid-label">{d.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </li>

              <li
                className={`insights-row-wrap ${isOpen('session-times') ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className={`insights-row ${isOpen('session-times') ? 'insights-row-active' : ''}`}
                  onClick={() => toggle('session-times')}
                  aria-expanded={isOpen('session-times')}
                >
                  <span className="activity-emoji" aria-hidden>
                    ⏰
                  </span>
                  <span className="activity-meta">
                    <span className="activity-name">When you show up</span>
                    <span className="activity-desc">
                      {insights.peakSessionBucket
                        ? `Most completions/sessions land in the ${insights.peakSessionBucket.label} (${insights.peakSessionBucket.count}).`
                        : 'No timed completions in this window yet.'}
                    </span>
                  </span>
                  <span className="insights-rate">
                    {insights.peakSessionBucket
                      ? insights.peakSessionBucket.label.slice(0, 3)
                      : '—'}
                  </span>
                </button>
                {isOpen('session-times') && (
                  <div className="insights-row-chart">
                    <div className="insights-pattern-chart">
                      <div className="bar-grid bar-grid-4">
                        {insights.sessionTimeBuckets.map((b) => (
                          <div key={b.key} className="bar-grid-item">
                            <div className="bar-grid-track">
                              <div
                                className="bar-grid-fill bar-grid-fill-primary"
                                style={{
                                  height: `${barHeight(b.count, insights.sessionTimeBuckets)}%`,
                                }}
                              />
                            </div>
                            <span className="bar-grid-label">{b.label.slice(0, 3)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </li>
            </ul>
          </section>
        </>
      )}
    </div>
  )
}

function barHeight(count: number, all: Array<{ count: number }>): number {
  const max = Math.max(...all.map((x) => x.count), 1)
  return Math.round((count / max) * 100)
}

function formatNum(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}
