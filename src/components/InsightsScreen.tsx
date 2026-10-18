import { useEffect, useMemo, useRef, useState } from 'react'
import type { Activity } from '../lib/activities'
import type { LogEntry } from '../lib/logs'
import { STARTER_METRICS, type Metric, type MetricInput } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import {
  buildActivityInsightSeries,
  INSIGHTS_WINDOW_DAYS,
  mostResumableActivity,
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
import { phoneStepsSupported, readPhoneStepsWeek, summarizeStepWeek, type PhoneStepsWeek } from '../lib/healthSteps'
import { DEFAULT_STEP_GOAL, formatStepCount, isDailyStepsMetric } from '../lib/steps'
import { ActivityInsightChart } from './ActivityInsightChart'
import { HabitMark } from './HabitMark'
import { StepsWeek } from './StepsWeek'
import { VitalTrend } from './VitalTrend'
import { formatPair, formatPairDelta } from '../lib/vitalChart'
import { Icon } from './Icon'
import './insights-ui.css'

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
  const windowDays = INSIGHTS_WINDOW_DAYS[window]
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set())
  const [phoneSteps, setPhoneSteps] = useState<PhoneStepsWeek | null>(null)
  const [didInitOpen, setDidInitOpen] = useState(false)

  const activeMetrics = useMemo(
    () => metrics.filter((m) => !m.archived),
    [metrics],
  )
  const activeActivities = useMemo(
    () => activities.filter((a) => !a.archived),
    [activities],
  )
  const hasStepsHabit = activeActivities.some((activity) => activity.template_id === 'steps')
  const listedMetrics = useMemo(
    () => (hasStepsHabit ? activeMetrics.filter((metric) => !isDailyStepsMetric(metric)) : activeMetrics),
    [activeMetrics, hasStepsHabit],
  )
  const showPhoneSteps =
    hasStepsHabit || activeMetrics.some((metric) => isDailyStepsMetric(metric))
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
  const easiest = insights ? mostResumableActivity(insights.activities) : null
  const easiestActivity = easiest
    ? activities.find((activity) => activity.id === easiest.activityId)
    : undefined
  const easiestName = easiestActivity
    ? visibleName(easiestActivity, locale)
    : easiest?.name ?? null
  const habitRows = useMemo(() => {
    if (!insights) return []
    return [...insights.activities].sort((a, b) => {
      const rateA = a.scheduled > 0 ? a.showedUp / a.scheduled : -1
      const rateB = b.scheduled > 0 ? b.showedUp / b.scheduled : -1
      return rateB - rateA
    })
  }, [insights])

  useEffect(() => {
    if (!showPhoneSteps || !phoneStepsSupported()) return
    let cancelled = false
    void readPhoneStepsWeek(new Date(), windowDays).then((next) => {
      if (!cancelled) setPhoneSteps(next)
    })
    return () => {
      cancelled = true
    }
  }, [showPhoneSteps, windowDays])

  useEffect(() => {
    if (didInitOpen || loading || !insights) return
    const first =
      habitRows[0] != null
        ? activityKey(habitRows[0].activityId)
        : listedMetrics[0] != null
          ? metricKey(listedMetrics[0].id)
          : null
    if (first) setOpenKeys(new Set([first]))
    setDidInitOpen(true)
  }, [didInitOpen, loading, insights, habitRows, listedMetrics])

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
    <div className="insights-screen in">
      <div className="in-intro">
        <div>
          <h2>{t('nav.insights')}</h2>
          <p className="screen-sub">{t('insights.sub')}</p>
        </div>
        {!empty && !loading && (
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
        )}
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">{t('list.loading')}</p>
      ) : empty ? (
        <section className="empty-state">
          <span className="empty-state-icon"><Icon name="insights" size={24} /></span>
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
          <section className="in-hero">
            <div className="in-kpis">
              <div className="in-kpi">
                <span className="in-kpi-value">
                  {insights.totalScheduled === 0 ? '—' : `${insights.showedUpScheduled}/${insights.totalScheduled}`}
                </span>
                <span className="in-kpi-label">{t('insights.kpiShowed')}</span>
              </div>
              <div className="in-kpi">
                <span className="in-kpi-value">{comebacks.length}</span>
                <span className="in-kpi-label">{t('insights.kpiComebacks')}</span>
              </div>
              <div className="in-kpi">
                <span className="in-kpi-value">{easiest && easiest.showedUp > 0 && easiestName ? easiestName : '—'}</span>
                <span className="in-kpi-label">{t('insights.easiest')}</span>
              </div>
            </div>
            <p className="in-hero-story">{insights.summary}</p>
            <p className="in-hero-range">
              {insights.from} → {insights.to}
            </p>
            {showComebackHelp && !earlyAccount && (
              <p className="in-hero-help">{t('insights.help')}</p>
            )}
          </section>
          {quietLine && <p className="in-quiet">{quietLine}</p>}
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
          ) : (
            patterns.length > 0 && (
              <section className="today-section">
                <h3 className="section-label">{t('insights.patterns')}</h3>
                <ul className="in-patterns">
                  {patterns.map((pattern) => (
                    <li key={pattern.kind}>
                      <button
                        type="button"
                        className="in-pattern"
                        onClick={() => {
                          track('pattern_tapped', { kind: pattern.kind })
                          if (pattern.activityId) onOpenActivity?.(pattern.activityId)
                        }}
                      >
                        <span className="in-pattern-kind">
                          {pattern.earlyGuess ? t('insights.earlyGuess') : t('insights.pattern')}
                        </span>
                        <span className="in-pattern-text">{pattern.text}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )
          )}

          <section className="today-section">
            <div className="in-charts">
              <div className="in-chart-card">
                <p className="in-chart-title">{t('insights.whenShow')}</p>
                <p className="in-chart-note">
                  {insights.peakSessionBucket
                    ? t('insights.mostLand', {
                        bucket: insights.peakSessionBucket.label,
                        count: insights.peakSessionBucket.count,
                      })
                    : t('insights.noTimed')}
                </p>
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
              {insights.peakSkipDay && (
                <div className="in-chart-card in-chart-slip">
                  <p className="in-chart-title">{t('insights.whenSkip')}</p>
                  <p className="in-chart-note">
                    {t('insights.skipMost', {
                      day: insights.peakSkipDay.label,
                      count: insights.peakSkipDay.count,
                      window: windowWord,
                    })}
                  </p>
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
              )}
            </div>
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
                {habitRows.map((a) => {
                  const key = activityKey(a.activityId)
                  const open = isOpen(key)
                  const activity = activities.find((x) => x.id === a.activityId)
                  const isSteps = activity?.template_id === 'steps'
                  const stepGoal = activity?.target_value ?? DEFAULT_STEP_GOAL
                  const phoneDays = phoneSteps?.status === 'days' ? phoneSteps.days : null
                  const phoneSummary =
                    isSteps && phoneDays
                      ? summarizeStepWeek(phoneDays, stepGoal, today)
                      : null
                  const series =
                    open && activity && !isSteps
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
                            {phoneSummary
                              ? `${t('today.stepsWeekMet', {
                                  met: String(phoneSummary.metDays),
                                  days: String(phoneDays?.length ?? windowDays),
                                })}${
                                  phoneSummary.average > 0
                                    ? ` · ${t('today.stepsWeekAverage', {
                                        value: formatStepCount(phoneSummary.average, locale),
                                      })}`
                                    : ''
                                }`
                              : a.scheduled === 0
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
                              className="progress-bar-fill"
                              style={{
                                width: `${
                                  phoneSummary
                                    ? Math.round(
                                        (phoneSummary.metDays / Math.max(phoneDays?.length ?? 1, 1)) * 100,
                                      )
                                    : a.scheduled === 0
                                      ? 0
                                      : Math.round((a.showedUp / a.scheduled) * 100)
                                }%`,
                              }}
                            />
                          </div>
                        </span>
                        <span className="insights-rate">
                          {phoneSummary
                            ? `${phoneSummary.metDays}/${phoneDays?.length ?? windowDays}`
                            : a.scheduled === 0
                              ? '—'
                              : `${a.showedUp}/${a.scheduled}`}
                        </span>
                      </button>
                      {open && activity && (
                        <div className="insights-row-chart">
                          {isSteps ? (
                            <StepsWeek goal={stepGoal} heading={false} days={windowDays} />
                          ) : (
                            <ActivityInsightChart
                              points={series}
                              windowLabel={window === 'week' ? t('insights.chart7') : t('insights.chart30')}
                              target={chartTarget(activity)}
                            />
                          )}
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
            {listedMetrics.length === 0 ? (
              <p className="muted-center">{t('insights.addWeight')}</p>
            ) : (
              <ul className="insights-list">
                {listedMetrics.map((m) => {
                  const key = metricKey(m.id)
                  const open = isOpen(key)
                  const rows = metricEntries.filter((e) => e.metric_id === m.id)
                  const stepsMetric = isDailyStepsMetric(m)
                  const phoneDays = phoneSteps?.status === 'days' ? phoneSteps.days : null
                  const phoneSummary =
                    stepsMetric && phoneDays
                      ? summarizeStepWeek(phoneDays, DEFAULT_STEP_GOAL, today)
                      : null
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
                            {phoneSummary
                              ? `${t('today.stepsWeekMet', {
                                  met: String(phoneSummary.metDays),
                                  days: String(phoneDays?.length ?? windowDays),
                                })}${
                                  phoneSummary.average > 0
                                    ? ` · ${t('today.stepsWeekAverage', {
                                        value: formatStepCount(phoneSummary.average, locale),
                                      })}`
                                    : ''
                                }`
                              : latest
                                ? t('insights.latest', {
                                    value: formatPair(latest.value, latest.secondary),
                                    unit: m.unit,
                                    count: trend.values.length,
                                  })
                                : t('insights.noLogs', { window: windowWord })}
                          </span>
                        </span>
                        <span className="insights-rate">
                          {phoneSummary
                            ? `${phoneSummary.metDays}/${phoneDays?.length ?? windowDays}`
                            : formatPairDelta(trend.delta, trend.secondaryDelta)}
                        </span>
                      </button>
                      {open && (
                        <div className="insights-row-chart">
                          {stepsMetric ? (
                            <StepsWeek goal={DEFAULT_STEP_GOAL} heading={false} days={windowDays} />
                          ) : (
                            <VitalTrend
                              metric={m}
                              entries={rows}
                              activities={activities}
                              values={trend.values}
                              windowDays={windowDays}
                              today={today}
                            />
                          )}
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
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