import { useMemo, useState } from 'react'
import type { Activity } from '../lib/activities'
import type { LogEntry } from '../lib/logs'
import type { Metric } from '../lib/metrics'
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

type Selected =
  | { kind: 'activity'; id: string }
  | { kind: 'metric'; id: string }
  | { kind: 'skip-days' }
  | { kind: 'session-times' }
  | null

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
}: InsightsScreenProps) {
  const [selected, setSelected] = useState<Selected>({ kind: 'skip-days' })

  const selectedActivity = useMemo(() => {
    if (selected?.kind !== 'activity') return null
    return activities.find((a) => a.id === selected.id) ?? null
  }, [activities, selected])

  const selectedMetric = useMemo(() => {
    if (selected?.kind !== 'metric') return null
    return metrics.find((m) => m.id === selected.id) ?? null
  }, [metrics, selected])

  const activitySeries = useMemo(() => {
    if (!selectedActivity) return []
    return buildActivityInsightSeries(selectedActivity, entries, window, today)
  }, [selectedActivity, entries, window, today])

  const metricTrend = useMemo(() => {
    if (!selectedMetric) return null
    const rows = metricEntries.filter((e) => e.metric_id === selectedMetric.id)
    return computeMetricTrendStats(
      rows,
      INSIGHTS_WINDOW_DAYS[window] as 7 | 30,
      today,
    )
  }, [selectedMetric, metricEntries, window, today])

  const activeMetrics = useMemo(
    () => metrics.filter((m) => !m.archived),
    [metrics],
  )

  function toggleActivity(id: string) {
    setSelected((prev) =>
      prev?.kind === 'activity' && prev.id === id ? null : { kind: 'activity', id },
    )
  }

  function toggleMetric(id: string) {
    setSelected((prev) =>
      prev?.kind === 'metric' && prev.id === id ? null : { kind: 'metric', id },
    )
  }

  function togglePattern(kind: 'skip-days' | 'session-times') {
    setSelected((prev) => (prev?.kind === kind ? null : { kind }))
  }

  return (
    <div className="insights-screen">
      <div className="screen-heading">
        <div>
          <h2>Insights</h2>
          <p className="screen-sub">The shape of avoidance across everything.</p>
        </div>
      </div>

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

      {error && <p className="error">{error}</p>}

      {loading || !insights ? (
        <p className="muted-center">Loading insights…</p>
      ) : (
        <>
          <section className="insights-summary">
            <p>{insights.summary}</p>
            <p className="screen-sub">
              {insights.from} → {insights.to}
            </p>
          </section>

          <section className="today-section">
            <h3 className="section-label">Postponement rate</h3>
            <p className="screen-sub insights-hint">
              Tap an activity for its {window} chart.
            </p>
            {insights.activities.length === 0 ? (
              <p className="muted-center">No active daily/weekly activities yet.</p>
            ) : (
              <ul className="insights-list">
                {insights.activities.map((a) => {
                  const open =
                    selected?.kind === 'activity' && selected.id === a.activityId
                  return (
                    <li
                      key={a.activityId}
                      className={`insights-row-wrap ${open ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className={`insights-row ${open ? 'insights-row-active' : ''}`}
                        onClick={() => toggleActivity(a.activityId)}
                        aria-expanded={open}
                      >
                        <span className="activity-emoji" aria-hidden>
                          {a.emoji}
                        </span>
                        <span className="activity-meta">
                          <span className="activity-name">{a.name}</span>
                          <span className="activity-desc">
                            {a.postponed} postponed · {a.met} met · {a.scheduled}{' '}
                            scheduled
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
                      {open && selectedActivity && (
                        <div className="insights-row-chart">
                          <ActivityInsightChart
                            points={activitySeries}
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
              <p className="muted-center">No metrics yet. Add one from the Metrics tab.</p>
            ) : (
              <ul className="insights-list">
                {activeMetrics.map((m) => {
                  const open = selected?.kind === 'metric' && selected.id === m.id
                  const rows = metricEntries.filter((e) => e.metric_id === m.id)
                  const windowDays = INSIGHTS_WINDOW_DAYS[window]
                  const preview = computeMetricTrendStats(
                    rows,
                    windowDays as 7 | 30,
                    today,
                  )
                  const latest =
                    preview.values.length > 0
                      ? preview.values[preview.values.length - 1]
                      : null
                  return (
                    <li
                      key={m.id}
                      className={`insights-row-wrap ${open ? 'is-open' : ''}`}
                    >
                      <button
                        type="button"
                        className={`insights-row ${open ? 'insights-row-active' : ''}`}
                        onClick={() => toggleMetric(m.id)}
                        aria-expanded={open}
                      >
                        <span className="activity-emoji" aria-hidden>
                          {m.emoji}
                        </span>
                        <span className="activity-meta">
                          <span className="activity-name">{m.name}</span>
                          <span className="activity-desc">
                            {latest
                              ? `Latest ${latest.value} ${m.unit} · ${preview.values.length} points`
                              : `No logs in this ${window} yet`}
                          </span>
                        </span>
                        <span className="insights-rate">
                          {preview.delta == null
                            ? '—'
                            : `${preview.delta > 0 ? '+' : ''}${formatNum(preview.delta)}`}
                        </span>
                      </button>
                      {open && selectedMetric && metricTrend && (
                        <div className="insights-row-chart">
                          <MetricTrendChart
                            values={metricTrend.values}
                            unit={selectedMetric.unit}
                            min={metricTrend.min}
                            max={metricTrend.max}
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
                className={`insights-row-wrap ${selected?.kind === 'skip-days' ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className={`insights-row ${selected?.kind === 'skip-days' ? 'insights-row-active' : ''}`}
                  onClick={() => togglePattern('skip-days')}
                  aria-expanded={selected?.kind === 'skip-days'}
                >
                  <span className="activity-emoji" aria-hidden>
                    📅
                  </span>
                  <span className="activity-meta">
                    <span className="activity-name">When you skip</span>
                    <span className="activity-desc">
                      {insights.peakSkipDay
                        ? `You postpone most often on ${insights.peakSkipDay.label}s (${insights.peakSkipDay.count} in this window).`
                        : 'No postponements in this window yet.'}
                    </span>
                  </span>
                  <span className="insights-rate">
                    {insights.peakSkipDay ? insights.peakSkipDay.label : '—'}
                  </span>
                </button>
                {selected?.kind === 'skip-days' && (
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
                className={`insights-row-wrap ${selected?.kind === 'session-times' ? 'is-open' : ''}`}
              >
                <button
                  type="button"
                  className={`insights-row ${selected?.kind === 'session-times' ? 'insights-row-active' : ''}`}
                  onClick={() => togglePattern('session-times')}
                  aria-expanded={selected?.kind === 'session-times'}
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
                {selected?.kind === 'session-times' && (
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
