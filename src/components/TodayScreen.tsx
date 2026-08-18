import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ActivityTodayProgress } from '../lib/today'
import { partitionTodayRows } from '../lib/today'
import type { Metric } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import type { ActiveTimerState } from '../lib/timerStorage'
import { formatDuration } from '../lib/timer'
import { DeadlineOverduePrompt } from './DeadlineOverduePrompt'

interface TodayScreenProps {
  dateLabel: string
  rows: ActivityTodayProgress[]
  metrics: Array<{ metric: Metric; entry: MetricEntry | null }>
  loading: boolean
  busyId: string | null
  error: string | null
  offlineNotice?: string | null
  activeTimer: ActiveTimerState | null
  timerElapsedSeconds: number
  onCheckOff: (row: ActivityTodayProgress) => void
  onUncheck: (row: ActivityTodayProgress) => void
  onIncrement: (row: ActivityTodayProgress) => void
  onLogMetric: (metricId: string, value: number) => void
  onTimerStart: (row: ActivityTodayProgress) => void
  onTimerPause: () => void
  onTimerResume: () => void
  onTimerStop: () => void
  onManualMinutes: (row: ActivityTodayProgress, minutes: number) => void
  onRescheduleDeadline: (row: ActivityTodayProgress, newDeadline: string) => void
  onEmptySetup?: () => void
}

export function TodayScreen({
  dateLabel,
  rows,
  metrics,
  loading,
  busyId,
  error,
  offlineNotice = null,
  activeTimer,
  timerElapsedSeconds,
  onCheckOff,
  onUncheck,
  onIncrement,
  onLogMetric,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerStop,
  onManualMinutes,
  onRescheduleDeadline,
  onEmptySetup,
}: TodayScreenProps) {
  const { hero, alsoDue, done } = useMemo(
    () => partitionTodayRows(rows, activeTimer?.activityId ?? null),
    [rows, activeTimer?.activityId],
  )
  const pendingMetrics = metrics.filter(({ entry }) => !entry)
  const loggedMetrics = metrics.filter(({ entry }) => entry)

  return (
    <div className="today-screen">
      <div className="screen-heading">
        <div>
          <h2>Today</h2>
          <p className="screen-sub">{dateLabel}</p>
        </div>
      </div>

      {offlineNotice && (
        <div className="notice notice-warning">
          <p>{offlineNotice}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="today-empty">
          <p className="today-empty-title">Today is waiting</p>
          <p className="today-empty-copy">
            Add one thing you’ve been putting off. It will show up here.
          </p>
          {onEmptySetup && (
            <button type="button" className="btn btn-primary" onClick={onEmptySetup}>
              Get started
            </button>
          )}
        </div>
      ) : (
        <>
          {hero && (
            <section className="today-section">
              <h3 className="section-label">{heroKicker(hero, activeTimer)}</h3>
              <ul className="today-list">
                <TodayActivityRow
                  row={hero}
                  hero
                  busy={busyId === hero.activity.id}
                  activeTimer={activeTimer}
                  timerElapsedSeconds={timerElapsedSeconds}
                  onCheckOff={() => onCheckOff(hero)}
                  onUncheck={() => onUncheck(hero)}
                  onIncrement={() => onIncrement(hero)}
                  onTimerStart={() => onTimerStart(hero)}
                  onTimerPause={onTimerPause}
                  onTimerResume={onTimerResume}
                  onTimerStop={onTimerStop}
                  onManualMinutes={(minutes) => onManualMinutes(hero, minutes)}
                  onRescheduleDeadline={(date) => onRescheduleDeadline(hero, date)}
                />
              </ul>
            </section>
          )}

          {alsoDue.length > 0 && (
            <section className="today-section">
              <h3 className="section-label">Also on Today</h3>
              <ul className="today-list">
                {alsoDue.map((row) => (
                  <TodayActivityRow
                    key={row.activity.id}
                    row={row}
                    busy={busyId === row.activity.id}
                    activeTimer={activeTimer}
                    timerElapsedSeconds={timerElapsedSeconds}
                    onCheckOff={() => onCheckOff(row)}
                    onUncheck={() => onUncheck(row)}
                    onIncrement={() => onIncrement(row)}
                    onTimerStart={() => onTimerStart(row)}
                    onTimerPause={onTimerPause}
                    onTimerResume={onTimerResume}
                    onTimerStop={onTimerStop}
                    onManualMinutes={(minutes) => onManualMinutes(row, minutes)}
                    onRescheduleDeadline={(date) => onRescheduleDeadline(row, date)}
                  />
                ))}
              </ul>
            </section>
          )}

          {done.length > 0 && (
            <details className="today-done">
              <summary className="section-label today-done-summary">
                Done today · {done.length}
              </summary>
              <ul className="today-list">
                {done.map((row) => (
                  <TodayActivityRow
                    key={row.activity.id}
                    row={row}
                    busy={busyId === row.activity.id}
                    activeTimer={activeTimer}
                    timerElapsedSeconds={timerElapsedSeconds}
                    onCheckOff={() => onCheckOff(row)}
                    onUncheck={() => onUncheck(row)}
                    onIncrement={() => onIncrement(row)}
                    onTimerStart={() => onTimerStart(row)}
                    onTimerPause={onTimerPause}
                    onTimerResume={onTimerResume}
                    onTimerStop={onTimerStop}
                    onManualMinutes={(minutes) => onManualMinutes(row, minutes)}
                    onRescheduleDeadline={(date) => onRescheduleDeadline(row, date)}
                  />
                ))}
              </ul>
            </details>
          )}

          {metrics.length > 0 && (
            <section className="today-section today-checkin">
              <h3 className="section-label">Numbers</h3>
              <ul className="today-list">
                {[...pendingMetrics, ...loggedMetrics].map(({ metric, entry }) => (
                  <li
                    key={metric.id}
                    className={`today-row ${entry ? 'today-row-done' : ''}`}
                  >
                    <span className="activity-emoji" aria-hidden>
                      {metric.emoji}
                    </span>
                    <span className="activity-meta">
                      <span className="activity-name">{metric.name}</span>
                      <span className="activity-desc">
                        {entry
                          ? `${entry.value} ${metric.unit} today`
                          : `Today’s ${metric.unit}`}
                      </span>
                    </span>
                    <MetricValueForm
                      metric={metric}
                      busy={busyId === metric.id}
                      onLog={onLogMetric}
                      initialValue={entry ? String(entry.value) : ''}
                      submitLabel={entry ? 'Update' : 'Log'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}

function heroKicker(
  row: ActivityTodayProgress,
  activeTimer: ActiveTimerState | null,
): string {
  if (activeTimer?.activityId === row.activity.id) return 'In progress'
  if (row.overdue) return 'Needs a decision'
  if (row.recentlyPostponed) return 'Resume now'
  return 'On Today'
}

function TodayActivityRow({
  row,
  hero = false,
  busy,
  activeTimer,
  timerElapsedSeconds,
  onCheckOff,
  onUncheck,
  onIncrement,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerStop,
  onManualMinutes,
  onRescheduleDeadline,
}: {
  row: ActivityTodayProgress
  hero?: boolean
  busy: boolean
  activeTimer: ActiveTimerState | null
  timerElapsedSeconds: number
  onCheckOff: () => void
  onUncheck: () => void
  onIncrement: () => void
  onTimerStart: () => void
  onTimerPause: () => void
  onTimerResume: () => void
  onTimerStop: () => void
  onManualMinutes: (minutes: number) => void
  onRescheduleDeadline: (newDeadline: string) => void
}) {
  const { activity, actionKind, done, progressLabel, current, target } = row
  const isThisTimer = activeTimer?.activityId === activity.id
  const timerLive = isThisTimer && activeTimer?.status === 'running'
  const timerPaused = isThisTimer && activeTimer?.status === 'paused'
  const partial =
    !done && !isThisTimer && current > 0 && actionKind !== 'deadline' && actionKind !== 'checkbox'
  const postponeNote =
    !done && row.recentlyPostponed
      ? row.activity.type === 'weekly_n'
        ? 'Put off last week'
        : row.activity.type === 'monthly'
          ? 'Put off last month'
          : 'Put off yesterday'
      : null
  const desc = isThisTimer
    ? `${progressLabel}${timerPaused ? ' · paused' : ' · running'}`
    : postponeNote
      ? `${progressLabel} · ${postponeNote}`
      : progressLabel
  const timerIdleLabel = postponeNote || partial ? 'Resume' : 'Start'
  const [showManual, setShowManual] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')

  if (row.activity.type === 'deadline' && row.overdue) {
    return (
      <li className={`today-row today-row-stack today-row-overdue ${hero ? 'today-row-hero' : ''}`}>
        <DeadlineOverduePrompt
          activity={activity}
          busy={busy}
          onMarkComplete={onCheckOff}
          onReschedule={onRescheduleDeadline}
        />
      </li>
    )
  }

  const rowStateClass = done
    ? 'today-row-done'
    : timerLive
      ? 'today-row-live'
      : timerPaused || partial
        ? 'today-row-progress'
        : ''

  return (
    <li
      className={`today-row today-row-stack ${hero ? 'today-row-hero' : ''} ${rowStateClass} ${row.overdue ? 'today-row-overdue' : ''}`}
    >
      <div className="today-row-main">
        <StatusMark live={timerLive} paused={timerPaused} />
        <span className="activity-emoji" aria-hidden>
          {activity.emoji}
        </span>
        <span className="activity-meta">
          <span className="activity-name">{activity.name}</span>
          <span className="activity-desc">
            {desc}
            {partial ? ' · in progress' : ''}
            {done ? ' · done' : ''}
          </span>
          {actionKind !== 'deadline' && !isThisTimer && (
            <div className="progress-bar" aria-hidden>
              <div
                className={`progress-bar-fill ${done ? 'progress-bar-fill-done' : ''}`}
                style={{
                  width: `${Math.min(100, (current / Math.max(target, 1)) * 100)}%`,
                }}
              />
            </div>
          )}
        </span>
        <span className="today-actions">
          {actionKind === 'checkbox' && (
            <button
              type="button"
              className={`btn btn-today ${done ? 'btn-today-done' : 'btn-primary'}`}
              disabled={busy}
              onClick={() => (done ? onUncheck() : onCheckOff())}
            >
              {done ? 'Undo' : 'Done'}
            </button>
          )}
          {actionKind === 'count' && (
            <button
              type="button"
              className={`btn btn-today ${done ? 'btn-today-done' : 'btn-primary'}`}
              disabled={busy || done}
              onClick={onIncrement}
            >
              {done ? 'Done' : '+1'}
            </button>
          )}
          {actionKind === 'deadline' && (
            <button
              type="button"
              className={`btn btn-today ${done ? 'btn-today-done' : 'btn-primary'}`}
              disabled={busy || done}
              onClick={onCheckOff}
            >
              {done ? 'Done' : 'Complete'}
            </button>
          )}
          {actionKind === 'timer' && !isThisTimer && (
            <button
              type="button"
              className={`btn btn-today ${done ? 'btn-today-done' : 'btn-primary'}`}
              disabled={busy || Boolean(activeTimer) || done}
              onClick={onTimerStart}
              title={
                done
                  ? 'Target met'
                  : activeTimer
                    ? 'Stop the other timer first'
                    : 'Start timer'
              }
            >
              {done ? 'Done' : timerIdleLabel}
            </button>
          )}
          {actionKind === 'timer' && isThisTimer && activeTimer?.status === 'running' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-today"
                disabled={busy}
                onClick={onTimerPause}
              >
                Pause
              </button>
              <button
                type="button"
                className="btn btn-primary btn-today"
                disabled={busy}
                onClick={onTimerStop}
              >
                Stop
              </button>
            </>
          )}
          {actionKind === 'timer' && isThisTimer && activeTimer?.status === 'paused' && (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-today"
                disabled={busy}
                onClick={onTimerResume}
              >
                Resume
              </button>
              <button
                type="button"
                className="btn btn-primary btn-today"
                disabled={busy}
                onClick={onTimerStop}
              >
                Stop
              </button>
            </>
          )}
        </span>
      </div>

      {isThisTimer && (
        <div
          className={`today-timer-elapsed ${timerPaused ? 'today-timer-elapsed-paused' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="today-timer-elapsed-value">
            {formatDuration(timerElapsedSeconds)}
          </span>
          {actionKind !== 'deadline' && (
            <div className="progress-bar today-timer-progress" aria-hidden>
              <div
                className={`progress-bar-fill ${done ? 'progress-bar-fill-done' : ''}`}
                style={{
                  width: `${Math.min(100, (current / Math.max(target, 1)) * 100)}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {actionKind === 'timer' && (
        <div className="timer-manual">
          {!showManual ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowManual(true)}
            >
              or enter minutes manually
            </button>
          ) : (
            <form
              className="metric-log-form"
              onSubmit={(e) => {
                e.preventDefault()
                const minutes = Number(manualMinutes)
                if (!minutes || minutes <= 0) return
                onManualMinutes(minutes)
                setManualMinutes('')
                setShowManual(false)
              }}
            >
              <input
                className="field-input field-input-sm"
                type="number"
                min={1}
                step={1}
                placeholder="min"
                value={manualMinutes}
                onChange={(e) => setManualMinutes(e.target.value)}
                aria-label={`Manual minutes for ${activity.name}`}
              />
              <button
                type="submit"
                className="btn btn-primary btn-today"
                disabled={busy || !manualMinutes}
              >
                Add
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowManual(false)}
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      )}
    </li>
  )
}

function StatusMark({
  live,
  paused,
}: {
  live: boolean
  paused: boolean
}) {
  if (live) {
    return (
      <span className="today-status today-status-live" aria-label="Timer running">
        ●
      </span>
    )
  }
  if (paused) {
    return (
      <span className="today-status today-status-paused" aria-label="Timer paused">
        ॥
      </span>
    )
  }
  return null
}

function MetricValueForm({
  metric,
  busy,
  onLog,
  initialValue = '',
  submitLabel = 'Log',
}: {
  metric: Metric
  busy: boolean
  onLog: (metricId: string, value: number) => void
  initialValue?: string
  submitLabel?: string
}) {
  const [value, setValue] = useState(initialValue)

  useEffect(() => {
    setValue(initialValue)
  }, [initialValue])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return
    onLog(metric.id, parsed)
  }

  return (
    <form className="metric-log-form" onSubmit={handleSubmit}>
      <input
        className="field-input field-input-sm"
        type="number"
        step="any"
        placeholder={metric.unit}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={`${metric.name} value`}
      />
      <button
        type="submit"
        className="btn btn-primary btn-today"
        disabled={busy || value === ''}
      >
        {submitLabel}
      </button>
    </form>
  )
}
