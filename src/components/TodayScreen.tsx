import { useEffect, useState, type FormEvent } from 'react'
import type { ActivityTodayProgress } from '../lib/today'
import type { Metric } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import type { ActiveTimerState } from '../lib/timerStorage'
import { formatDuration } from '../lib/timer'
import { DeadlineOverduePrompt } from './DeadlineOverduePrompt'

interface TodayScreenProps {
  dateLabel: string
  rows: ActivityTodayProgress[]
  metricsNeedingLog: Metric[]
  loggedMetrics: Array<{ metric: Metric; entry: MetricEntry }>
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
}

export function TodayScreen({
  dateLabel,
  rows,
  metricsNeedingLog,
  loggedMetrics,
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
}: TodayScreenProps) {
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
      ) : (
        <>
          <section className="today-section">
            <h3 className="section-label">Activities</h3>
            {rows.length === 0 ? (
              <p className="muted-center">
                No active activities. Add some from the Activities tab.
              </p>
            ) : (
              <ul className="today-list">
                {rows.map((row) => (
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
            )}
          </section>

          <section className="today-section">
            <h3 className="section-label">Metrics</h3>
            {metricsNeedingLog.length === 0 && loggedMetrics.length === 0 ? (
              <p className="muted-center">No metrics yet. Add some from the Metrics tab.</p>
            ) : (
              <ul className="today-list">
                {metricsNeedingLog.map((metric) => (
                  <li key={metric.id} className="today-row">
                    <span className="today-status today-status-idle" aria-hidden />
                    <span className="activity-emoji" aria-hidden>
                      {metric.emoji}
                    </span>
                    <span className="activity-meta">
                      <span className="activity-name">{metric.name}</span>
                      <span className="activity-desc">Log today&apos;s {metric.unit}</span>
                    </span>
                    <MetricValueForm
                      metric={metric}
                      busy={busyId === metric.id}
                      onLog={onLogMetric}
                    />
                  </li>
                ))}
                {loggedMetrics.map(({ metric, entry }) => (
                  <li key={metric.id} className="today-row today-row-done">
                    <span className="today-status today-status-done" aria-label="Logged">
                      ✓
                    </span>
                    <span className="activity-emoji" aria-hidden>
                      {metric.emoji}
                    </span>
                    <span className="activity-meta">
                      <span className="activity-name">{metric.name}</span>
                      <span className="activity-desc">
                        {entry.value} {metric.unit} today
                      </span>
                    </span>
                    <MetricValueForm
                      metric={metric}
                      busy={busyId === metric.id}
                      onLog={onLogMetric}
                      initialValue={String(entry.value)}
                      submitLabel="Update"
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function TodayActivityRow({
  row,
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
  const [showManual, setShowManual] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')

  if (row.activity.type === 'deadline' && row.overdue) {
    return (
      <li className="today-row today-row-stack today-row-overdue">
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
      className={`today-row today-row-stack ${rowStateClass} ${row.overdue ? 'today-row-overdue' : ''}`}
    >
      <div className="today-row-main">
        <StatusMark
          done={done}
          live={timerLive}
          paused={timerPaused}
          partial={partial}
        />
        <span className="activity-emoji" aria-hidden>
          {activity.emoji}
        </span>
        <span className="activity-meta">
          <span className="activity-name">{activity.name}</span>
          <span className="activity-desc">
            {isThisTimer
              ? `${progressLabel} · live ${formatDuration(timerElapsedSeconds)}${timerPaused ? ' (paused)' : ''}`
              : progressLabel}
            {partial ? ' · in progress' : ''}
            {done ? ' · done' : ''}
          </span>
          {actionKind !== 'deadline' && (
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
              {done ? 'Done' : 'Start'}
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
  done,
  live,
  paused,
  partial,
}: {
  done: boolean
  live: boolean
  paused: boolean
  partial: boolean
}) {
  if (done) {
    return (
      <span className="today-status today-status-done" aria-label="Completed">
        ✓
      </span>
    )
  }
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
  if (partial) {
    return (
      <span className="today-status today-status-partial" aria-label="In progress">
        ◐
      </span>
    )
  }
  return <span className="today-status today-status-idle" aria-hidden />
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
