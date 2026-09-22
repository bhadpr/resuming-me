import { useEffect, useMemo, useState, type FormEvent } from 'react'
import type { ActivityTodayProgress } from '../lib/today'
import { partitionTodayRows, todayEmptyKind } from '../lib/today'
import {
  canShrinkToday,
  pickEasiestReentryRow,
  pickFollowUpReentryRow,
  reentryPrimaryLabel,
  reentrySuggestLine,
  SMALLER_CHOICES,
  SMALLER_ONE_MINUTE,
  SMALLER_TODAY_MINUTES,
  smallerChoiceCopy,
  type SmallerChoiceMinutes,
} from '../lib/reentry'
import type { Metric } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import type { ActiveTimerState } from '../lib/timerStorage'
import { formatDuration } from '../lib/timer'
import { DeadlineOverduePrompt } from './DeadlineOverduePrompt'

export type ReentryFollowUp = {
  activityName: string
  maxTargetMinutes: number
  excludeActivityId: string
}

export const SKIP_REASONS = [
  'Too tired',
  'No time',
  "Didn't feel like it",
  'Other',
] as const

export type SkipReason = (typeof SKIP_REASONS)[number]

interface TodayScreenProps {
  dateLabel: string
  rows: ActivityTodayProgress[]
  metrics: Array<{ metric: Metric; entry: MetricEntry | null }>
  loading: boolean
  busyId: string | null
  error: string | null
  offlineNotice?: string | null
  softNotice?: string | null
  activeTimer: ActiveTimerState | null
  timerElapsedSeconds: number
  reentryFollowUp?: ReentryFollowUp | null
  isRestDay?: boolean
  onCheckOff: (row: ActivityTodayProgress) => void
  onUncheck: (row: ActivityTodayProgress) => void
  onIncrement: (row: ActivityTodayProgress) => void
  onLogMetric: (metricId: string, value: number) => void
  onTimerStart: (
    row: ActivityTodayProgress,
    options?: { fromReentry?: boolean },
  ) => void
  onTimerPause: () => void
  onTimerResume: () => void
  onTimerStop: () => void
  onManualMinutes: (row: ActivityTodayProgress, minutes: number) => void
  onRescheduleDeadline: (row: ActivityTodayProgress, newDeadline: string) => void
  onStartSmallerSession: (
    row: ActivityTodayProgress,
    minutes: SmallerChoiceMinutes,
  ) => void
  onShrinkRunningTimer: (minutes: SmallerChoiceMinutes) => void
  onSkipToday?: (row: ActivityTodayProgress, reason: SkipReason) => void
  onTakeRestDay?: () => void
  hasActivities?: boolean
  quietReentry?: boolean
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
  softNotice = null,
  activeTimer,
  timerElapsedSeconds,
  reentryFollowUp = null,
  isRestDay = false,
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
  onStartSmallerSession,
  onShrinkRunningTimer,
  onSkipToday,
  onTakeRestDay,
  hasActivities = false,
  quietReentry = false,
  onEmptySetup,
}: TodayScreenProps) {
  const quietSuggested = quietReentry ? pickEasiestReentryRow(rows) : null
  const followUpSuggested = reentryFollowUp
    ? pickFollowUpReentryRow(
        rows,
        reentryFollowUp.maxTargetMinutes,
        reentryFollowUp.excludeActivityId,
      )
    : null
  const suggested = quietSuggested ?? followUpSuggested
  const { hero, alsoDue, done } = useMemo(
    () =>
      partitionTodayRows(
        rows,
        activeTimer?.activityId ?? null,
        suggested?.activity.id ?? null,
      ),
    [rows, activeTimer?.activityId, suggested?.activity.id],
  )
  const pendingMetrics = metrics.filter(({ entry }) => !entry)
  const loggedMetrics = metrics.filter(({ entry }) => entry)
  const emptyKind = todayEmptyKind({
    hasActivities,
    dueCount: rows.length,
  })
  const showWelcome = (quietReentry || reentryFollowUp) && emptyKind !== 'setup'

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
      {softNotice && (
        <div className="notice">
          <p>{softNotice}</p>
        </div>
      )}
      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : (
        <>
          {emptyKind === 'setup' && (
            <div className="today-empty">
              <p className="today-empty-title">Today is waiting</p>
              <p className="today-empty-copy">
                Add one thing you’ve been putting off. It isn’t a list to finish.
              </p>
              {onEmptySetup && (
                <button type="button" className="btn btn-primary" onClick={onEmptySetup}>
                  Get started
                </button>
              )}
            </div>
          )}

          {showWelcome && (
            <ReentryWelcomeCard
              followUp={reentryFollowUp}
              suggested={suggested}
              busyId={busyId}
              activeTimer={activeTimer}
              onCheckOff={onCheckOff}
              onIncrement={onIncrement}
              onTimerStart={onTimerStart}
              onStartSmallerSession={onStartSmallerSession}
            />
          )}

          {emptyKind === 'clear' && !showWelcome && (
            <div className="today-empty">
              <p className="today-empty-title">Nothing due today</p>
              <p className="today-empty-copy">
                Weekly and monthly things will show up here when they’re open.
              </p>
            </div>
          )}

          {emptyKind === null && (
            <>
              {hero && (
                <section className="today-section">
                  <h3 className="section-label">
                    {suggested?.activity.id === hero.activity.id
                      ? 'Start here'
                      : heroKicker(hero, activeTimer)}
                  </h3>
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
                      onShrinkRunningTimer={onShrinkRunningTimer}
                      onSkipToday={
                        onSkipToday
                          ? (reason) => onSkipToday(hero, reason)
                          : undefined
                      }
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
                        onShrinkRunningTimer={onShrinkRunningTimer}
                        onSkipToday={
                          onSkipToday
                            ? (reason) => onSkipToday(row, reason)
                            : undefined
                        }
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
                        onShrinkRunningTimer={onShrinkRunningTimer}
                        onSkipToday={
                          onSkipToday
                            ? (reason) => onSkipToday(row, reason)
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </details>
              )}
            </>
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

          {hasActivities && onTakeRestDay && (
            <div className="today-rest-day">
              {isRestDay ? (
                <p className="today-rest-day-note">Rest day · nothing due.</p>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm today-rest-day-btn"
                  onClick={onTakeRestDay}
                  disabled={busyId === 'rest-day'}
                >
                  Take a rest day
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ReentryWelcomeCard({
  followUp,
  suggested,
  busyId,
  activeTimer,
  onCheckOff,
  onIncrement,
  onTimerStart,
  onStartSmallerSession,
}: {
  followUp: ReentryFollowUp | null
  suggested: ActivityTodayProgress | null
  busyId: string | null
  activeTimer: ActiveTimerState | null
  onCheckOff: (row: ActivityTodayProgress) => void
  onIncrement: (row: ActivityTodayProgress) => void
  onTimerStart: (
    row: ActivityTodayProgress,
    options?: { fromReentry?: boolean },
  ) => void
  onStartSmallerSession: (
    row: ActivityTodayProgress,
    minutes: SmallerChoiceMinutes,
  ) => void
}) {
  const [smallerOpen, setSmallerOpen] = useState(false)
  const [chosenCopy, setChosenCopy] = useState<string | null>(null)
  const [selectedMinutes, setSelectedMinutes] =
    useState<SmallerChoiceMinutes>(SMALLER_TODAY_MINUTES)

  useEffect(() => {
    setSmallerOpen(false)
    setChosenCopy(null)
    setSelectedMinutes(SMALLER_TODAY_MINUTES)
  }, [suggested?.activity.id, followUp?.excludeActivityId])

  const title = followUp
    ? `You resumed ${followUp.activityName}.`
    : 'It’s been a few days — that’s okay.'

  if (followUp && !suggested) {
    return (
      <div className="today-welcome">
        <p className="today-empty-title">{title}</p>
        <p className="today-empty-copy">That&apos;s enough for today. Nice.</p>
      </div>
    )
  }

  if (!suggested || suggested.done) {
    return (
      <div className="today-welcome">
        <p className="today-empty-title">{title}</p>
        <p className="today-empty-copy">Want to pick one small thing today?</p>
      </div>
    )
  }

  const activeSuggestion = suggested
  const timerRunningHere = activeTimer?.activityId === activeSuggestion.activity.id

  function startPrimary() {
    runReentryPrimary(activeSuggestion, {
      onCheckOff,
      onIncrement,
      onTimerStart: (row) => onTimerStart(row, { fromReentry: true }),
    })
  }

  return (
    <div className="today-welcome">
      <p className="today-empty-title">{title}</p>
      {chosenCopy ? (
        <p className="today-empty-copy">{chosenCopy}</p>
      ) : (
        <p className="today-empty-copy">{reentrySuggestLine(activeSuggestion)}</p>
      )}
      <div className="today-welcome-actions">
        {activeSuggestion.actionKind === 'timer' && timerRunningHere ? (
          <p className="today-empty-copy">
            Timer is running below. Stop it when you&apos;re finished.
          </p>
        ) : smallerOpen ? (
          <SmallerChoiceSheet
            selected={selectedMinutes}
            onPick={(minutes) => {
              setSelectedMinutes(minutes)
              setChosenCopy(
                smallerChoiceCopy(activeSuggestion.activity.name, minutes),
              )
              setSmallerOpen(false)
              onStartSmallerSession(activeSuggestion, minutes)
            }}
            onCancel={() => setSmallerOpen(false)}
            disabled={busyId === activeSuggestion.activity.id}
          />
        ) : (
          <>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyId === activeSuggestion.activity.id}
              onPointerDown={(event) => {
                if (event.button !== 0) return
                event.preventDefault()
                startPrimary()
              }}
              onClick={startPrimary}
            >
              {reentryPrimaryLabel(activeSuggestion)}
            </button>
            {canShrinkToday(activeSuggestion) && (
              <button
                type="button"
                className="btn btn-ghost"
                disabled={busyId === activeSuggestion.activity.id}
                onClick={() => setSmallerOpen(true)}
              >
                Make it even smaller today
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SmallerChoiceSheet({
  selected,
  onPick,
  onCancel,
  disabled,
}: {
  selected: SmallerChoiceMinutes
  onPick: (minutes: SmallerChoiceMinutes) => void
  onCancel: () => void
  disabled?: boolean
}) {
  return (
    <div className="smaller-choice-sheet" role="group" aria-label="Make it even smaller">
      <div className="smaller-choice-options">
        {SMALLER_CHOICES.map((choice) => (
          <button
            key={choice.label}
            type="button"
            className={`btn btn-sm smaller-choice ${
              selected === choice.minutes ? 'smaller-choice-selected' : 'btn-ghost'
            }`}
            disabled={disabled}
            aria-pressed={selected === choice.minutes}
            onClick={() => onPick(choice.minutes)}
          >
            {choice.label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={disabled}
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  )
}

function runReentryPrimary(
  row: ActivityTodayProgress,
  actions: {
    onCheckOff: (row: ActivityTodayProgress) => void
    onIncrement: (row: ActivityTodayProgress) => void
    onTimerStart: (row: ActivityTodayProgress) => void
  },
): void {
  if (row.actionKind === 'timer' || row.activity.tracking_mode === 'timer') {
    actions.onTimerStart(row)
    return
  }
  if (row.actionKind === 'count') actions.onIncrement(row)
  else actions.onCheckOff(row)
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
  onShrinkRunningTimer,
  onSkipToday,
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
  onShrinkRunningTimer: (minutes: SmallerChoiceMinutes) => void
  onSkipToday?: (reason: SkipReason) => void
}) {
  const { activity, actionKind, done, progressLabel, current, target, status } = row
  const isThisTimer = activeTimer?.activityId === activity.id
  const timerLive = isThisTimer && activeTimer?.status === 'running'
  const timerPaused = isThisTimer && activeTimer?.status === 'paused'
  const skipped = status === 'skipped'
  const partial = !done && !skipped && !isThisTimer && status === 'partial'
  const postponeNote =
    !done && !skipped && row.recentlyPostponed
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
  const [shrinkOpen, setShrinkOpen] = useState(false)
  const [selectedMinutes, setSelectedMinutes] =
    useState<SmallerChoiceMinutes>(SMALLER_TODAY_MINUTES)
  const [skipOpen, setSkipOpen] = useState(false)

  const sessionTarget =
    isThisTimer && activeTimer && 'sessionTargetSeconds' in activeTimer
      ? activeTimer.sessionTargetSeconds
      : undefined
  const progressTarget =
    typeof sessionTarget === 'number' && sessionTarget > 0 ? sessionTarget : target
  const progressCurrent = isThisTimer
    ? Math.max(current, timerElapsedSeconds)
    : current
  const canShrinkRunning =
    isThisTimer &&
    row.actionKind === 'timer' &&
    row.activity.type !== 'weekly_n' &&
    !done &&
    (sessionTarget === undefined ||
      sessionTarget === null ||
      sessionTarget > SMALLER_ONE_MINUTE * 60)
  const canSkip =
    Boolean(onSkipToday) &&
    !done &&
    !skipped &&
    !isThisTimer &&
    activity.type !== 'deadline'

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

  const rowStateClass = done || skipped
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
            {partial ? ' · partial' : ''}
            {done ? ' · done' : ''}
            {skipped ? ' · skipped' : ''}
          </span>
          {actionKind !== 'deadline' && !isThisTimer && !skipped && (
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
          {canSkip && (
            <button
              type="button"
              className="btn btn-ghost btn-today-more"
              disabled={busy}
              aria-expanded={skipOpen}
              aria-label={`More options for ${activity.name}`}
              onClick={() => setSkipOpen((v) => !v)}
            >
              ···
            </button>
          )}
          {actionKind === 'checkbox' && !skipped && (
            <button
              type="button"
              className={`btn btn-today ${done ? 'btn-today-done' : 'btn-primary'}`}
              disabled={busy}
              onClick={() => (done ? onUncheck() : onCheckOff())}
            >
              {done ? 'Undo' : 'Done'}
            </button>
          )}
          {actionKind === 'count' && !skipped && (
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
          {actionKind === 'timer' && !isThisTimer && !skipped && (
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

      {skipOpen && canSkip && onSkipToday && (
        <div className="today-skip-sheet">
          <p className="today-skip-label">Skip today</p>
          <div className="today-skip-chips" role="group" aria-label="Skip reason">
            {SKIP_REASONS.map((reason) => (
              <button
                key={reason}
                type="button"
                className="today-skip-chip"
                disabled={busy}
                onClick={() => {
                  onSkipToday(reason)
                  setSkipOpen(false)
                }}
              >
                {reason}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setSkipOpen(false)}
          >
            Cancel
          </button>
        </div>
      )}

      {isThisTimer && (
        <div
          className={`today-timer-elapsed ${timerPaused ? 'today-timer-elapsed-paused' : ''}`}
          aria-live="polite"
          aria-atomic="true"
        >
          <span className="today-timer-elapsed-value">
            {formatDuration(timerElapsedSeconds)}
            {typeof sessionTarget === 'number' && (
              <span className="today-timer-target-hint">
                {' '}
                / {formatDuration(sessionTarget)}
              </span>
            )}
            {sessionTarget === null && (
              <span className="today-timer-target-hint"> · no target</span>
            )}
          </span>
          {actionKind !== 'deadline' && sessionTarget !== null && (
            <div className="progress-bar today-timer-progress" aria-hidden>
              <div
                className={`progress-bar-fill ${done ? 'progress-bar-fill-done' : ''}`}
                style={{
                  width: `${Math.min(
                    100,
                    (progressCurrent / Math.max(progressTarget, 1)) * 100,
                  )}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {canShrinkRunning && (
        <div className="timer-manual">
          {!shrinkOpen ? (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShrinkOpen(true)}
            >
              Make it even smaller
            </button>
          ) : (
            <SmallerChoiceSheet
              selected={selectedMinutes}
              onPick={(minutes) => {
                setSelectedMinutes(minutes)
                onShrinkRunningTimer(minutes)
                setShrinkOpen(false)
              }}
              onCancel={() => setShrinkOpen(false)}
              disabled={busy}
            />
          )}
        </div>
      )}

      {actionKind === 'timer' && !skipped && (
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
