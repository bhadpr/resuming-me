import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activity } from '../lib/activities'
import type { LogEntry } from '../lib/logs'
import { STARTER_METRICS, type Metric, type MetricInput } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import {
  buildActivityInsightSeries,
  INSIGHTS_WINDOW_DAYS,
  type DayStatusOpts,
  type InsightsResult,
  type InsightsWindow,
} from '../lib/insights'
import { computeMetricTrendStats } from '../lib/stats'
import { listAccountComebacks } from '../lib/comeback'
import { daysBetween } from '../lib/dates'
import { findPatterns, patternTextIsCausal } from '../lib/patterns'
import { track } from '../lib/track'
import { templateLabel, visibleName } from '../lib/catalogName'
import { habitTemplateId } from '../data/habitArt'
import { useLocale } from '../hooks/useLocale'
import { ActivityInsightChart } from './ActivityInsightChart'
import { HabitMark } from './HabitMark'
import { MetricTrendChart } from './MetricTrendChart'

function chartTarget(activity: Activity | undefined): number | null {
  if (!activity || activity.type === 'deadline') return null
  if (activity.tracking_mode === 'checkbox') return 1
  if (activity.target_value == null) return null
  if (activity.tracking_mode === 'timer' && activity.target_unit === 'seconds') {
    return activity.target_value / 60
  }
  return activity.target_value
}

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
  dayStatusOpts?: DayStatusOpts
  onAddActivity: () => void
  onAddMetric: (input: MetricInput) => void
  quietLine?: string | null
  slipAnswer?: string | null
  onOpenActivity?: (activityId: string) => void
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
  dayStatusOpts,
  onAddActivity,
  onAddMetric,
  quietLine = null,
  slipAnswer = null,
  onOpenActivity,
}: InsightsScreenProps) {
  const { locale, t } = useLocale()
  const windowWord = t(window === 'week' ? 'insights.week' : 'insights.month')
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
  const comebacks = useMemo(
    () => listAccountComebacks(activities, entries, today, 30, dayStatusOpts),
    [activities, entries, today, dayStatusOpts],
  )
  const patterns = useMemo(
    () =>
      findPatterns({
        activities,
        entries,
        metrics,
        metricEntries,
        today,
        slipAnswer,
        restDates: dayStatusOpts?.restDates,
        pauses: dayStatusOpts?.pauses,
        freshStarts: dayStatusOpts?.freshStarts,
        showEverything: dayStatusOpts?.showEverything,
      }).filter((pattern) => !patternTextIsCausal(pattern.text)),
    [activities, entries, metrics, metricEntries, today, slipAnswer, dayStatusOpts, locale],
  )
  const earlyAccount = useMemo(() => {
    const started = activeActivities
      .map((activity) => activity.created_at.slice(0, 10))
      .sort()[0]
    if (!started) return false
    return daysBetween(started, today) < 14
  }, [activeActivities, today])
  const [showComebackHelp] = useState(
    () => typeof localStorage === 'undefined' || localStorage.getItem('resuming-comeback-explained') !== '1',
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

  const shownPatternKinds = useRef(new Set<string>())

  useEffect(() => {
    if (!showComebackHelp || loading || empty) return
    const timerId = globalThis.setTimeout(() => {
      localStorage.setItem('resuming-comeback-explained', '1')
    }, 1500)
    return () => globalThis.clearTimeout(timerId)
  }, [showComebackHelp, loading, empty])

  useEffect(() => {
    if (loading || empty || earlyAccount) return
    for (const pattern of patterns) {
      if (shownPatternKinds.current.has(pattern.kind)) continue
      shownPatternKinds.current.add(pattern.kind)
      track('pattern_shown', {
        kind: pattern.kind,
        confidence: Number(pattern.confidence.toFixed(2)),
      })
    }
  }, [loading, empty, earlyAccount, patterns])

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
          <h2>{t('nav.insights')}</h2>
          <p className="screen-sub">{t('insights.sub')}</p>
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">{t('list.loading')}</p>
      ) : empty ? (
        <section className="empty-state">
          <p className="empty-state-emoji">📊</p>
          <h2>{t('insights.needDays')}</h2>
          <p>{t('insights.addOne')}</p>
          <div className="onboarding-chips">
            {STARTER_METRICS.map((metric) => {
              const id = habitTemplateId({ name: metric.name })
              const label = (id && templateLabel(id, locale)) || metric.name
              return (
                <button
                  key={metric.name}
                  type="button"
                  className="onboarding-chip"
                  onClick={() => onAddMetric(metric)}
                >
                  {label}
                </button>
              )
            })}
          </div>
          <button type="button" className="btn btn-primary" onClick={onAddActivity}>
            {t('insights.addHabit')}
          </button>
        </section>
      ) : !insights ? (
        <p className="muted-center">{t('list.loading')}</p>
      ) : (
        <>
          {quietLine && (
            <p className="insights-quiet">{quietLine}</p>
          )}
          <section className="insights-summary comeback-hero">
            <p>
              {t(comebacks.length === 1 ? 'insights.comeback' : 'insights.comebacks', {
                count: comebacks.length,
              })}
            </p>
            {showComebackHelp && (
              <p className="screen-sub">{t('insights.help')}</p>
            )}
          </section>
          {earlyAccount ? (
            <section className="today-section">
              <h3 className="section-label">{t('insights.patterns')}</h3>
              <p>
                {t('insights.tooEarly')}
                {comebacks.length === 0
                  ? t('insights.comebackExplain')
                  : t(comebacks.length === 1 ? 'insights.hadComeback' : 'insights.hadComebacks', {
                      count: comebacks.length,
                    })}
              </p>
            </section>
          ) : patterns.length > 0 && (
            <section className="today-section">
              <h3 className="section-label">{t('insights.patterns')}</h3>
              <ul className="insights-list">
                {patterns.map((pattern) => (
                  <li key={pattern.kind}>
                    <button
                      type="button"
                      className="insights-row"
                      onClick={() => {
                        track('pattern_tapped', { kind: pattern.kind })
                        if (pattern.activityId) onOpenActivity?.(pattern.activityId)
                      }}
                    >
                      <span className="activity-meta">
                        <span className="activity-name">{pattern.earlyGuess ? t('insights.earlyGuess') : t('insights.pattern')}</span>
                        <span className="activity-desc">{pattern.text}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="segmented window-toggle">
            <button
              type="button"
              className={`segmented-btn ${window === 'week' ? 'segmented-btn-active' : ''}`}
              onClick={() => onWindowChange('week')}
            >
              {t('insights.days7')}
            </button>
            <button
              type="button"
              className={`segmented-btn ${window === 'month' ? 'segmented-btn-active' : ''}`}
              onClick={() => onWindowChange('month')}
            >
              {t('insights.days30')}
            </button>
          </div>
          <section className="insights-summary">
            <p>{insights.summary}</p>
            <p className="screen-sub">
              {insights.from} → {insights.to}
            </p>
          </section>

          <section className="today-section">
            <h3 className="section-label">{t('insights.easiest')}</h3>
            <p className="screen-sub insights-hint">
              {t('insights.tapHabit', { window: windowWord })}
            </p>
            {insights.activities.length === 0 ? (
              <p className="muted-center">{t('insights.noHabits')}</p>
            ) : (
              <ul className="insights-list">
                {insights.activities.map((a) => {
                  const key = activityKey(a.activityId)
                  const open = isOpen(key)
                  const activity = activities.find((x) => x.id === a.activityId)
                  const series =
                    open && activity
                      ? buildActivityInsightSeries(activity, entries, window, today, dayStatusOpts)
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
                        <HabitMark
                          name={activity ? visibleName(activity, locale) : a.name}
                          templateId={activity?.template_id}
                        />
                        <span className="activity-meta">
                          <span className="activity-name">
                            {activity ? visibleName(activity, locale) : a.name}
                          </span>
                          <span className="activity-desc">
                            {a.scheduled === 0
                              ? t('insights.nothingScheduled')
                              : a.postponed > 0
                                ? t('insights.showedUpSkipped', {
                                    done: a.showedUp,
                                    scheduled: a.scheduled,
                                    count: a.postponed,
                                  })
                                : t('insights.showedUp', {
                                    done: a.showedUp,
                                    scheduled: a.scheduled,
                                  })}
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
                          {a.scheduled === 0 ? '—' : `${a.showedUp}/${a.scheduled}`}
                        </span>
                      </button>
                      {open && activity && (
                        <div className="insights-row-chart">
                          <ActivityInsightChart
                            points={series}
                            windowLabel={window === 'week' ? t('insights.chart7') : t('insights.chart30')}
                            target={chartTarget(activity)}
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
            <h3 className="section-label">{t('nav.vitals')}</h3>
            <p className="screen-sub insights-hint">
              {t('insights.tapNumber', { window: windowWord })}
            </p>
            {activeMetrics.length === 0 ? (
              <p className="muted-center">{t('insights.addWeight')}</p>
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
                        <HabitMark name={visibleName(m, locale)} templateId={m.template_id} />
                        <span className="activity-meta">
                          <span className="activity-name">{visibleName(m, locale)}</span>
                          <span className="activity-desc">
                            {latest
                              ? t('insights.latest', {
                                  value: latest.value,
                                  unit: m.unit,
                                  count: trend.values.length,
                                })
                              : t('insights.noLogs', { window: windowWord })}
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
                            windowDays={windowDays}
                            today={today}
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
            <h3 className="section-label">{t('insights.patterns')}</h3>
            <p className="screen-sub insights-hint">
              {t('insights.tapPattern', { window: windowWord })}
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
                    <span className="activity-name">{t('insights.whenSkip')}</span>
                    <span className="activity-desc">
                      {insights.peakSkipDay
                        ? t('insights.skipMost', {
                            day: insights.peakSkipDay.label,
                            count: insights.peakSkipDay.count,
                            window: windowWord,
                          })
                        : t('insights.nothingSkipped')}
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
                    <span className="activity-name">{t('insights.whenShow')}</span>
                    <span className="activity-desc">
                      {insights.peakSessionBucket
                        ? t('insights.mostLand', {
                            bucket: insights.peakSessionBucket.label,
                            count: insights.peakSessionBucket.count,
                          })
                        : t('insights.noTimed')}
                    </span>
                  </span>
                  <span className="insights-rate">
                    {insights.peakSessionBucket
                      ? insights.peakSessionBucket.label
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
                            <span className="bar-grid-label">{b.label}</span>
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
