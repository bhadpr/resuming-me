import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { canLogPastGoal, stacksSessionMinutes } from '../lib/dayStatus'
import { FASTING_HOURS_NOTE, SLEEP_HOURS_NOTE, WATER_GLASS_NOTE, countTapLabel, playsVideoWithTimer, showsHabitVideo } from '../lib/onboardingFlow'
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
import { formatMetricReading, isBloodPressure, type Metric } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import type { ActiveTimerState } from '../lib/timerStorage'
import { formatDuration } from '../lib/timer'
import { smallerChoiceProp, track } from '../lib/track'
import { DeadlineOverduePrompt } from './DeadlineOverduePrompt'
import { HabitMark } from './HabitMark'
import { HabitVideoPlaceholder } from './HabitVideoPlaceholder'
import { habitTemplateId } from '../data/habitArt'
import { WelcomeBackCard, type WelcomeBackModel } from './WelcomeBackCard'
import type { Moment } from '../lib/moments'
import type { PauseDuration } from '../lib/activityPauses'

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
  onLogMetric: (metricId: string, value: number, secondaryValue?: number | null) => void
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
  onPauseHabit?: (row: ActivityTodayProgress, duration: PauseDuration) => void
  hasActivities?: boolean
  quietReentry?: boolean
  welcomeBack?: WelcomeBackModel | null
  onWelcomeStart?: (row: ActivityTodayProgress, minutes: number | null) => void
  onWelcomeDismiss?: () => void
  onFreshStart?: () => void
  onEmptySetup?: () => void
  onAddActivity?: () => void
  moment?: Moment | null
  onMomentStart?: (activityId: string, minutes: number | null) => void
  onMomentDismiss?: (id: string) => void
  reviewCard?: { weekStart: string; headline: string } | null
  onOpenReview?: (weekStart: string) => void
  focusActivityId?: string | null
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
  onPauseHabit,
  hasActivities = false,
  quietReentry = false,
  welcomeBack = null,
  onWelcomeStart,
  onWelcomeDismiss,
  onFreshStart,
  onEmptySetup,
  onAddActivity,
  moment = null,
  onMomentStart,
  onMomentDismiss,
  reviewCard = null,
  onOpenReview,
  focusActivityId = null,
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
        suggested?.activity.id ?? focusActivityId,
      ),
    [rows, activeTimer?.activityId, suggested?.activity.id, focusActivityId],
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
        <TodaySkeleton />
      ) : (
        <>
          {emptyKind === 'setup' && (
            <div className="today-empty">
              <p className="today-empty-title">Today is waiting</p>
              <p className="today-empty-copy">
                Add one habit. It isn't a list to finish.
              </p>
              {onEmptySetup && (
                <button type="button" className="btn btn-primary" onClick={onEmptySetup}>
                  Get started
                </button>
              )}
            </div>
          )}

          {welcomeBack && onWelcomeStart && onWelcomeDismiss && onFreshStart && (
            <WelcomeBackCard
              model={welcomeBack}
              busyId={busyId}
              rows={rows}
              onStart={onWelcomeStart}
              onDismiss={onWelcomeDismiss}
              onFreshStart={onFreshStart}
            />
          )}

          {moment && onMomentStart && onMomentDismiss && (
            <section className="notice moment-banner">
              <p>{moment.line}</p>
              <div className="detail-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busyId != null}
                  onClick={() => onMomentStart(moment.activityId, moment.minutes)}
                >
                  Start {moment.activityName}
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => onMomentDismiss(moment.id)}>
                  Not now
                </button>
              </div>
            </section>
          )}

          {reviewCard && onOpenReview && (
            <button
              type="button"
              className="insights-summary review-card"
              onClick={() => onOpenReview(reviewCard.weekStart)}
            >
              <p>{reviewCard.headline}</p>
              <p className="screen-sub">Open this week’s review</p>
            </button>
          )}

          {showWelcome && !welcomeBack && (
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
              <p className="today-empty-title">Nothing open today</p>
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
                      : focusActivityId === hero.activity.id
                        ? "This week's focus"
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
                      onTakeRestDay={onTakeRestDay}
                      isRestDay={isRestDay}
                      onPauseHabit={
                        onPauseHabit
                          ? (duration) => onPauseHabit(hero, duration)
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
                        onTakeRestDay={onTakeRestDay}
                        isRestDay={isRestDay}
                        onPauseHabit={
                          onPauseHabit
                            ? (duration) => onPauseHabit(row, duration)
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
                        onTakeRestDay={onTakeRestDay}
                        isRestDay={isRestDay}
                        onPauseHabit={
                          onPauseHabit
                            ? (duration) => onPauseHabit(row, duration)
                            : undefined
                        }
                      />
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}

          {emptyKind !== 'setup' && onAddActivity && (
            <button type="button" className="btn btn-secondary today-add" onClick={onAddActivity}>
              Add a habit
            </button>
          )}

          {metrics.length > 0 && (
            <section className="today-section today-checkin">
              <h3 className="section-label">Vitals</h3>
              <ul className="today-list">
                {[...pendingMetrics, ...loggedMetrics].map(({ metric, entry }) => (
                  <li
                    key={metric.id}
                    className={`today-row ${isBloodPressure(metric) ? 'vital-entry' : ''} ${entry ? 'today-row-done' : ''}`}
                  >
                    <HabitMark name={metric.name} />
                    <span className="activity-meta">
                      <span className="activity-name">{metric.name}</span>
                      <span className="activity-desc">
                        {entry
                          ? `${formatMetricReading(entry.value, metric.unit, entry.secondary_value)} today`
                          : isBloodPressure(metric)
                            ? 'Upper and lower today'
                            : `Today’s ${metric.unit}`}
                      </span>
                    </span>
                    <MetricValueForm
                      metric={metric}
                      busy={busyId === metric.id}
                      onLog={onLogMetric}
                      initialValue={entry ? String(entry.value) : ''}
                      initialSecondary={entry?.secondary_value == null ? '' : String(entry.secondary_value)}
                      submitLabel={entry ? 'Update' : 'Log'}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}

          {hasActivities && onTakeRestDay && (isRestDay || rows.length === 0) && (
            <div className="today-rest-day">
              <p className="screen-sub">Rest. The whole day is off, and it isn't a miss.</p>
              {isRestDay ? (
                <p className="today-rest-day-note">Today is a rest day.</p>
              ) : (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm today-rest-day-btn"
                  onClick={onTakeRestDay}
                  disabled={busyId === 'rest-day'}
                >
                  Rest today
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
              track('smaller_chosen', { choice: smallerChoiceProp(minutes) })
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
                onClick={() => {
                  setSmallerOpen(true)
                  track('smaller_opened')
                }}
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
  if (row.overdue) return 'Still open'
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
  onTakeRestDay,
  isRestDay = false,
  onPauseHabit,
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
  onTakeRestDay?: () => void
  isRestDay?: boolean
  onPauseHabit?: (duration: PauseDuration) => void
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
        ? 'Quiet last week'
        : row.activity.type === 'monthly'
          ? 'Quiet last month'
          : 'Quiet yesterday'
      : null
  const desc = isThisTimer
    ? `${progressLabel}${timerPaused ? ' · paused' : ' · running'}`
    : postponeNote
      ? `${progressLabel} · ${postponeNote}`
      : progressLabel
  const timerIdleLabel = postponeNote || partial ? 'Resume' : 'Start'
  const [showManual, setShowManual] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [videoOpen, setVideoOpen] = useState(false)
  const templateId = habitTemplateId(activity)
  const canShowVideo = showsHabitVideo(templateId)
  const followAlong = canShowVideo && playsVideoWithTimer(templateId)
  useEffect(() => {
    if (followAlong && isThisTimer) setVideoOpen(true)
  }, [followAlong, isThisTimer])

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
  const canPauseHabit = Boolean(onPauseHabit) && !done && activity.type !== 'deadline'
  const canRest = Boolean(onTakeRestDay) && !isRestDay && !done
  const showMore = canSkip || canRest || canPauseHabit || canShrinkRunning || timerPaused

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
        <HabitMark name={activity.name} emoji={activity.emoji} />
        <span className="activity-meta">
          <span className="activity-name">{activity.name}</span>
          <span className="activity-desc">
            {desc}
            {partial ? ' · partial' : ''}
            {done ? ' · done' : ''}
            {skipped ? ' · skipped' : ''}
          </span>
          {activity.target_unit === 'glasses' && (
            <span className="activity-desc">{WATER_GLASS_NOTE}</span>
          )}
          {activity.target_unit === 'hours' && (
            <span className="activity-desc">{FASTING_HOURS_NOTE}</span>
          )}
          {activity.target_unit === 'hr' && (
            <span className="activity-desc">{SLEEP_HOURS_NOTE}</span>
          )}
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
          {canShowVideo && (
            <button
              type="button"
              className="btn btn-ghost today-video-btn"
              aria-expanded={videoOpen}
              onClick={() => setVideoOpen((open) => !open)}
            >
              {videoOpen ? 'Hide video' : 'Video'}
            </button>
          )}
        </span>
        <span className="today-actions">
          {showMore && (
            <button
              type="button"
              className="btn btn-ghost btn-today-more"
              disabled={busy}
              aria-expanded={moreOpen}
              aria-label={`More options for ${activity.name}`}
              onClick={() => setMoreOpen((open) => !open)}
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
              className={`btn btn-today ${done && !canLogPastGoal(activity.target_unit) ? 'btn-today-done' : 'btn-primary'}`}
              disabled={busy || (done && !canLogPastGoal(activity.target_unit))}
              onClick={onIncrement}
            >
              {countTapLabel(activity.target_unit, done)}
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
              className={`btn btn-today ${done && !stacksSessionMinutes(activity) ? 'btn-today-done' : 'btn-primary'}`}
              disabled={busy || Boolean(activeTimer) || (done && !stacksSessionMinutes(activity))}
              onClick={onTimerStart}
              title={
                done && !stacksSessionMinutes(activity)
                  ? 'Target met'
                  : activeTimer
                    ? 'Stop the other timer first'
                    : 'Start timer'
              }
            >
              {done && !stacksSessionMinutes(activity) ? 'Done' : timerIdleLabel}
            </button>
          )}
          {actionKind === 'timer' && isThisTimer && activeTimer?.status === 'running' && (
            <button
              type="button"
              className="btn btn-primary btn-today"
              disabled={busy}
              onClick={onTimerStop}
            >
              Stop
            </button>
          )}
          {actionKind === 'timer' && isThisTimer && activeTimer?.status === 'paused' && (
            <button
              type="button"
              className="btn btn-primary btn-today"
              disabled={busy}
              onClick={onTimerResume}
            >
              Resume
            </button>
          )}
        </span>
      </div>

      {moreOpen && showMore && (
        <div className="today-skip-sheet">
          {canSkip && onSkipToday && (
            <>
              <p className="today-skip-label">Skip today</p>
              <p className="screen-sub">Skip. This day stays quiet, and it isn't a miss.</p>
              <div className="today-skip-chips" role="group" aria-label="Skip reason">
                {SKIP_REASONS.map((reason) => (
                  <button
                    key={reason}
                    type="button"
                    className="today-skip-chip"
                    disabled={busy}
                    onClick={() => {
                      onSkipToday(reason)
                      setMoreOpen(false)
                    }}
                  >
                    {reason}
                  </button>
                ))}
              </div>
            </>
          )}
          {canRest && onTakeRestDay && (
            <>
              <p className="screen-sub">Rest. The whole day is off, and it isn't a miss.</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  onTakeRestDay()
                  setMoreOpen(false)
                }}
              >
                Rest today
              </button>
            </>
          )}
          {canPauseHabit && onPauseHabit && (
            <>
              <p className="screen-sub">Pause. This habit stays hidden until you come back.</p>
              <div className="today-skip-chips">
                {(
                  [
                    ['1_week', '1 week'],
                    ['2_weeks', '2 weeks'],
                    ['until_resume', 'Until I resume'],
                  ] as const
                ).map(([duration, label]) => (
                  <button
                    key={duration}
                    type="button"
                    className="today-skip-chip"
                    disabled={busy}
                    onClick={() => {
                      onPauseHabit(duration)
                      setMoreOpen(false)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {canShrinkRunning && (
            <>
              <p className="screen-sub">Make it smaller. Two minutes still counts.</p>
              <div className="today-skip-chips">
                <button
                  type="button"
                  className="today-skip-chip"
                  disabled={busy}
                  onClick={() => {
                    onShrinkRunningTimer(1)
                    setMoreOpen(false)
                  }}
                >
                  1 minute
                </button>
                <button
                  type="button"
                  className="today-skip-chip"
                  disabled={busy}
                  onClick={() => {
                    onShrinkRunningTimer(2)
                    setMoreOpen(false)
                  }}
                >
                  2 minutes
                </button>
              </div>
            </>
          )}
          {timerLive && (
            <>
              <p className="screen-sub">Pause the timer. It keeps the minutes you already did.</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  onTimerPause()
                  setMoreOpen(false)
                }}
              >
                Pause timer
              </button>
            </>
          )}
          {timerPaused && (
            <>
              <p className="screen-sub">Stop. This saves the minutes you already did.</p>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={busy}
                onClick={() => {
                  onTimerStop()
                  setMoreOpen(false)
                }}
              >
                Stop
              </button>
            </>
          )}
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoreOpen(false)}>
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
      {canShowVideo && videoOpen && (
        <HabitVideoPlaceholder
          templateId={templateId}
          name={activity.name}
          playing={followAlong && timerLive}
          paused={followAlong && timerPaused}
        />
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
  initialSecondary = '',
  submitLabel = 'Log',
}: {
  metric: Metric
  busy: boolean
  onLog: (metricId: string, value: number, secondaryValue?: number | null) => void
  initialValue?: string
  initialSecondary?: string
  submitLabel?: string
}) {
  const paired = isBloodPressure(metric)
  const [value, setValue] = useState(initialValue)
  const [secondary, setSecondary] = useState(initialSecondary)

  useEffect(() => {
    setValue(initialValue)
    setSecondary(initialSecondary)
  }, [initialValue, initialSecondary])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = Number(value)
    if (Number.isNaN(parsed)) return
    if (!paired) {
      onLog(metric.id, parsed)
      return
    }
    const lower = Number(secondary)
    if (Number.isNaN(lower) || secondary === '') return
    onLog(metric.id, parsed, lower)
  }

  return (
    <form className="metric-log-form" onSubmit={handleSubmit}>
      <input
        className="field-input field-input-sm"
        type="number"
        step="any"
        placeholder={paired ? 'Upper' : metric.unit}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label={paired ? 'Upper blood pressure' : `${metric.name} value`}
      />
      {paired && (
        <input
          className="field-input field-input-sm"
          type="number"
          step="any"
          placeholder="Lower"
          value={secondary}
          onChange={(e) => setSecondary(e.target.value)}
          aria-label="Lower blood pressure"
        />
      )}
      <button
        type="submit"
        className="btn btn-primary btn-today"
        disabled={busy || value === '' || (paired && secondary === '')}
      >
        {submitLabel}
      </button>
    </form>
  )
}

function TodaySkeleton() {
  return (
    <div className="today-skeleton" aria-busy="true" aria-label="Loading today">
      <div className="today-section">
        <div className="today-skeleton-label" />
        <ul className="today-list">
          {[0, 1, 2].map((i) => (
            <li key={i} className="today-row today-skeleton-row">
              <div className="today-skeleton-emoji" />
              <div className="today-row-stack">
                <div className="today-skeleton-line today-skeleton-line-title" />
                <div className="today-skeleton-line today-skeleton-line-sub" />
              </div>
              <div className="today-skeleton-action" />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
