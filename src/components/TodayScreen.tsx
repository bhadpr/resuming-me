import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { canLogPastGoal, stacksSessionMinutes } from '../lib/dayStatus'
import { FASTING_HOURS_NOTE, SLEEP_HOURS_NOTE, WATER_GLASS_NOTE, countTapLabel, isNumberEntryVital, playsVideoWithTimer, showsHabitVideo } from '../lib/onboardingFlow'
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
import { isDailyStepsMetric } from '../lib/steps'
import { visibleName } from '../lib/catalogName'
import { useLocale } from '../hooks/useLocale'
import type { MetricEntry } from '../lib/metricEntries'
import type { ActiveTimerState } from '../lib/timerStorage'
import { formatDuration } from '../lib/timer'
import { smallerChoiceProp, track } from '../lib/track'
import { DeadlineOverduePrompt } from './DeadlineOverduePrompt'
import { HabitMark } from './HabitMark'
import { HabitVideoPlaceholder } from './HabitVideoPlaceholder'
import { AppAlertsNote } from './AppAlertsNote'
import { Icon } from './Icon'
import { SkipLink, UndoSkipButton } from './TodaySkip'
import { useTodaySkips } from '../hooks/useTodaySkips'
import { todayLocalDate } from '../lib/dates'
import { StepsCard } from './StepsCard'
import { SessionDistanceLine } from './SessionDistance'
import { tracksDistance } from '../lib/healthDistance'
import { MedicineDoseRow } from './MedicineDoses'
import { TodayByTime, type TodayTimedItem } from './TodayByTime'
import { ReminderDoneRow, ReminderRow, type ReminderSectionProps } from './ReminderSection'
import { activityPeriod, periodForHour } from '../lib/dayPeriod'
import { isDoseFinished, type DueDose } from '../lib/medicineSchedule'
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
  onUnskip?: (row: ActivityTodayProgress) => void
  onTakeRestDay?: () => void
  onPauseHabit?: (row: ActivityTodayProgress, duration: PauseDuration) => void
  hasActivities?: boolean
  quietReentry?: boolean
  welcomeBack?: WelcomeBackModel | null
  onWelcomeStart?: (row: ActivityTodayProgress, minutes: number | null) => void
  onWelcomeDismiss?: () => void
  onFreshStart?: () => void
  onAddActivity?: () => void
  moment?: Moment | null
  onMomentStart?: (activityId: string, minutes: number | null) => void
  onMomentDismiss?: (id: string) => void
  reviewCard?: { weekStart: string; headline: string } | null
  onOpenReview?: (weekStart: string) => void
  focusActivityId?: string | null
  medicineDoses?: DueDose[]
  medicineBusyKey?: string | null
  medicineError?: string | null
  onToggleMedicineDose?: (dose: DueDose) => void
  onSkipMedicineDose?: (dose: DueDose) => void
  reminders?: ReminderSectionProps & { error: string | null }
  onAddReminder?: () => void
  onOpenInsights?: () => void
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
  onUnskip,
  onTakeRestDay,
  onPauseHabit,
  hasActivities = false,
  quietReentry = false,
  welcomeBack = null,
  onWelcomeStart,
  onWelcomeDismiss,
  onFreshStart,
  onAddActivity,
  moment = null,
  onMomentStart,
  onMomentDismiss,
  reviewCard = null,
  onOpenReview,
  focusActivityId = null,
  medicineDoses = [],
  medicineBusyKey = null,
  medicineError = null,
  onToggleMedicineDose,
  onSkipMedicineDose,
  reminders,
  onAddReminder,
  onOpenInsights,
}: TodayScreenProps) {
  const { t, locale } = useLocale()
  const skips = useTodaySkips(todayLocalDate())
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
  const stepsCardShown = rows.some((row) => row.activity.template_id === 'steps')
  const visibleMetrics = stepsCardShown
    ? metrics.filter(({ metric }) => !isDailyStepsMetric(metric))
    : metrics
  const emptyKind = todayEmptyKind({
    hasActivities,
    dueCount: rows.length,
  })
  const showWelcome = (quietReentry || reentryFollowUp) && emptyKind !== 'setup'
  const timingDone = done.filter((row) => row.activity.id === activeTimer?.activityId)
  const foldedDone = done.filter((row) => row.activity.id !== activeTimer?.activityId)
  const openRows = [...(hero ? [hero] : []), ...alsoDue, ...timingDone]

  function renderActivity(row: ActivityTodayProgress, heroRow = false) {
    return (
      <TodayActivityRow
        key={row.activity.id}
        row={row}
        hero={heroRow}
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
        onSkipToday={onSkipToday ? (reason) => onSkipToday(row, reason) : undefined}
        onUnskip={onUnskip ? () => onUnskip(row) : undefined}
        onTakeRestDay={onTakeRestDay}
        isRestDay={isRestDay}
        onPauseHabit={onPauseHabit ? (duration) => onPauseHabit(row, duration) : undefined}
      />
    )
  }

  function renderVital(metric: Metric, entry: MetricEntry | null) {
    const skipKey = `vital:${metric.id}`
    const skipped = !entry && skips.isSkipped(skipKey)
    return (
      <li
        key={metric.id}
        className={`today-row today-row-stack today-row-compact item-kind-vital ${isBloodPressure(metric) && !skipped ? 'today-row-entry' : ''} ${entry || skipped ? 'today-row-done' : ''}`}
      >
        <div className="today-row-head">
          <HabitMark name={visibleName(metric, locale)} templateId={metric.template_id} />
          <span className="activity-name">{visibleName(metric, locale)}</span>
        </div>
        <div className={`today-row-main ${isBloodPressure(metric) ? 'vital-entry' : ''}`}>
          <span className="activity-meta">
            <span className="activity-desc">
              {entry
                ? `${formatMetricReading(entry.value, metric.unit, entry.secondary_value)} today`
                : skipped
                  ? t('today.skippedLine')
                  : isBloodPressure(metric)
                    ? 'Upper and lower today'
                    : `Today’s ${metric.unit}`}
            </span>
          </span>
          <span className="today-actions today-actions-stack">
            {skipped ? (
              <UndoSkipButton onUndo={() => skips.unskip(skipKey)} />
            ) : (
              <MetricValueForm
                metric={metric}
                busy={busyId === metric.id}
                onLog={onLogMetric}
                initialValue={entry ? String(entry.value) : ''}
                initialSecondary={entry?.secondary_value == null ? '' : String(entry.secondary_value)}
                submitLabel={entry ? t('today.update') : t('today.log')}
              />
            )}
            {!entry && !skipped && <SkipLink onSkip={() => skips.skip(skipKey)} />}
          </span>
        </div>
      </li>
    )
  }

  const timedItems: TodayTimedItem[] = [
    ...(onToggleMedicineDose
      ? medicineDoses.map((dose) => ({
          key: `dose-${dose.key}`,
          kind: 'medicine' as const,
          period: periodForHour(dose.hour),
          minutes: dose.hour * 60 + dose.minute,
          done: isDoseFinished(dose),
          node: (
            <MedicineDoseRow
              dose={dose}
              busy={medicineBusyKey === dose.key}
              onToggle={onToggleMedicineDose}
              onSkip={(skipped) => onSkipMedicineDose?.(skipped)}
            />
          ),
        }))
      : []),
    ...openRows.map((row) => ({
      key: `activity-${row.activity.id}`,
      kind: 'activity' as const,
      period: activityPeriod(row.activity),
      done: false,
      node: renderActivity(row, hero?.activity.id === row.activity.id),
    })),
    ...foldedDone.map((row) => ({
      key: `activity-${row.activity.id}`,
      kind: 'activity' as const,
      period: activityPeriod(row.activity),
      done: true,
      node: renderActivity(row),
    })),
    ...(reminders
      ? [
          ...reminders.open.map((reminder) => ({
            key: `reminder-${reminder.id}`,
            kind: 'reminder' as const,
            period: periodForHour(reminder.hour),
            minutes: reminder.hour == null ? null : reminder.hour * 60 + (reminder.minute ?? 0),
            done: false,
            node: (
              <ReminderRow
                reminder={reminder}
                today={reminders.today}
                busy={reminders.busyId === reminder.id}
                onDone={() => {
                  skips.unskip(`reminder:${reminder.id}`)
                  reminders.onDone(reminder)
                }}
                onSkip={() => {
                  skips.skip(`reminder:${reminder.id}`)
                  reminders.onSkip(reminder)
                }}
                onMove={(day) => reminders.onMove(reminder, day)}
                onCancel={() => reminders.onCancel(reminder)}
              />
            ),
          })),
          ...reminders.doneToday.map((reminder) => ({
            key: `reminder-${reminder.id}`,
            kind: 'reminder' as const,
            period: periodForHour(reminder.hour),
            minutes: reminder.hour == null ? null : reminder.hour * 60 + (reminder.minute ?? 0),
            done: true,
            node: (
              <ReminderDoneRow
                reminder={reminder}
                busy={reminders.busyId === reminder.id}
                skipped={skips.isSkipped(`reminder:${reminder.id}`)}
                onNotDone={() => {
                  skips.unskip(`reminder:${reminder.id}`)
                  reminders.onNotDone(reminder)
                }}
              />
            ),
          })),
        ]
      : []),
    ...visibleMetrics.map(({ metric, entry }) => ({
      key: `vital-${metric.id}`,
      kind: 'vital' as const,
      period: 'anytime' as const,
      done: entry != null || skips.isSkipped(`vital:${metric.id}`),
      node: renderVital(metric, entry),
    })),
  ]

  return (
    <div className="today-screen">
      <div className="screen-heading today-heading">
        <h2>{t('nav.today')}</h2>
        <p className="screen-sub">{dateLabel}</p>
      </div>
      {timedItems.some((item) => !item.done && (item.kind === 'medicine' || item.kind === 'reminder')) && (
        <AppAlertsNote where="today" />
      )}

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
              className="today-week-bar"
              aria-label={`${reviewCard.headline} ${t('today.review')}`}
              onClick={() => onOpenReview(reviewCard.weekStart)}
            >
              <span>{reviewCard.headline}</span>
              <Icon name="chevron" />
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

          {hasActivities && onTakeRestDay && (isRestDay || rows.length === 0) && (
            <div className="today-rest-day">
              <p className="screen-sub">{t('today.restCopy')}</p>
              {isRestDay ? (
                <p className="today-rest-day-note">{t('today.restNote')}</p>
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

          {medicineError && <p className="error">{medicineError}</p>}
          {reminders?.error && <p className="error">{reminders.error}</p>}

          {emptyKind === 'clear' && !showWelcome && !isRestDay && timedItems.length === 0 && (
            <div className="today-empty">
              <p className="today-empty-title">{t('today.nothing')}</p>
              <p className="today-empty-copy">
                Weekly and monthly things will show up here when they’re open.
              </p>
            </div>
          )}

          <TodayByTime items={timedItems} />

          {emptyKind !== 'setup' && (onAddActivity || onAddReminder) && (
            <div className="today-add-row">
              {onAddActivity && (
                <button type="button" className="btn btn-secondary today-add" onClick={onAddActivity}>
                  {t('today.add')}
                </button>
              )}
              {onAddReminder && (
                <button type="button" className="btn btn-secondary today-add" onClick={onAddReminder}>
                  {t('reminders.add')}
                </button>
              )}
            </div>
          )}

          {hasActivities && onOpenInsights && (
            <div className="today-add-row today-progress-row">
              <button type="button" className="btn btn-secondary today-add" onClick={onOpenInsights}>
                {t('today.progress')}
              </button>
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
  onUnskip,
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
  onUnskip?: () => void
  onTakeRestDay?: () => void
  isRestDay?: boolean
  onPauseHabit?: (duration: PauseDuration) => void
}) {
  const { t, locale } = useLocale()
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
    ? `${progressLabel}${timerPaused ? ` · ${t('today.paused')}` : ` · ${t('today.running')}`}`
    : postponeNote
      ? `${progressLabel} · ${postponeNote}`
      : progressLabel
  const timerIdleLabel = postponeNote || partial ? t('today.resume') : t('today.start')
  const [showManual, setShowManual] = useState(false)
  const [manualMinutes, setManualMinutes] = useState('')
  const [moreOpen, setMoreOpen] = useState(false)
  const [moreChoice, setMoreChoice] = useState<
    null | 'rest' | 'pause' | 'shrink' | 'pauseTimer' | 'stop'
  >(null)
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
  const weighIn = isNumberEntryVital({ templateId })
  const showMore = !weighIn && (canRest || canPauseHabit || canShrinkRunning || timerPaused)

  if (row.activity.type === 'deadline' && row.overdue) {
    return (
      <li className={`today-row today-row-stack today-row-overdue item-kind-activity ${hero ? 'today-row-hero' : ''}`}>
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

  if (activity.template_id === 'steps') {
    return <StepsCard goal={activity.target_value ?? 10000} />
  }

  return (
    <li
      className={`today-row today-row-stack today-row-compact item-kind-activity ${hero ? 'today-row-hero' : ''} ${rowStateClass} ${row.overdue ? 'today-row-overdue' : ''}`}
    >
      <div className="today-row-head">
        <HabitMark name={visibleName(activity, locale)} emoji={activity.emoji} templateId={activity.template_id} />
        <span className="activity-name">{visibleName(activity, locale)}</span>
        <StatusMark live={timerLive} paused={timerPaused} />
      </div>
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-desc">
            {skipped && current === 0 ? (
              t('today.skippedLine')
            ) : (
              <>
                {desc}
                {done ? ` · ${t('today.done')}` : ''}
                {skipped ? ` · ${t('today.skipped')}` : ''}
              </>
            )}
          </span>
          {tracksDistance(templateId) && !isThisTimer && (
            <SessionDistanceLine
              entries={row.periodCompletedEntries.filter((entry) => entry.date === todayLocalDate())}
            />
          )}
          {activity.target_unit === 'glasses' && (
            <span className="activity-desc">{WATER_GLASS_NOTE}</span>
          )}
          {activity.target_unit === 'hours' && (
            <span className="activity-desc">{FASTING_HOURS_NOTE}</span>
          )}
          {activity.target_unit === 'hr' && (
            <span className="activity-desc">{SLEEP_HOURS_NOTE}</span>
          )}
          {actionKind !== 'deadline' && !isThisTimer && !skipped && current > 0 && (
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
        <span className="today-actions today-actions-stack">
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
          {skipped && onUnskip && <UndoSkipButton disabled={busy} onUndo={onUnskip} />}
          {canSkip && onSkipToday && <SkipLink disabled={busy} onSkip={() => onSkipToday('Other')} />}
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
      {(canShowVideo || (actionKind === 'timer' && !skipped) || showMore) && (
        <div className="today-extra">
          {canShowVideo && (
            <button
              type="button"
              className="today-extra-btn today-watch"
              aria-expanded={videoOpen}
              onClick={() => setVideoOpen((open) => !open)}
            >
              {videoOpen ? t('today.hideVideo') : t('today.video')}
            </button>
          )}
          {actionKind === 'timer' && !skipped && (
            <button
              type="button"
              className="today-extra-btn"
              aria-expanded={showManual}
              onClick={() => {
                setMoreOpen(false)
                setMoreChoice(null)
                setShowManual((open) => !open)
              }}
            >
              Log minutes
            </button>
          )}
          {showMore && (
            <button
              type="button"
              className="today-extra-btn"
              disabled={busy}
              aria-expanded={moreOpen}
              aria-label={`More options for ${activity.name}`}
              onClick={() => {
                setShowManual(false)
                setMoreChoice(null)
                setMoreOpen((open) => !open)
              }}
            >
              More
            </button>
          )}
        </div>
      )}
      {showManual && actionKind === 'timer' && !skipped && (
        <form
          className="metric-log-form today-log-form"
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
            placeholder="Minutes"
            value={manualMinutes}
            onChange={(e) => setManualMinutes(e.target.value)}
            aria-label={`Minutes for ${activity.name}`}
          />
          <button type="submit" className="btn btn-primary btn-today" disabled={busy || !manualMinutes}>
            Add
          </button>
          <button type="button" className="today-extra-btn" onClick={() => setShowManual(false)}>
            Cancel
          </button>
        </form>
      )}
      {moreOpen && showMore && (
        <div className="today-more">
          {!moreChoice && (
            <div className="today-more-menu">
              {canRest && (
                <button type="button" className="today-skip-chip" onClick={() => setMoreChoice('rest')}>
                  Rest today
                </button>
              )}
              {canPauseHabit && (
                <button type="button" className="today-skip-chip" onClick={() => setMoreChoice('pause')}>
                  Pause this habit
                </button>
              )}
              {canShrinkRunning && (
                <button type="button" className="today-skip-chip" onClick={() => setMoreChoice('shrink')}>
                  Make it smaller
                </button>
              )}
              {timerLive && (
                <button type="button" className="today-skip-chip" onClick={() => setMoreChoice('pauseTimer')}>
                  Pause timer
                </button>
              )}
              {timerPaused && (
                <button type="button" className="today-skip-chip" onClick={() => setMoreChoice('stop')}>
                  Stop and save
                </button>
              )}
            </div>
          )}
          {moreChoice === 'rest' && canRest && onTakeRestDay && (
            <>
              <p className="today-more-note">The whole day is off, and it is not a miss.</p>
              <button
                type="button"
                className="today-skip-chip"
                disabled={busy}
                onClick={() => {
                  onTakeRestDay()
                  setMoreOpen(false)
                  setMoreChoice(null)
                }}
              >
                Rest today
              </button>
            </>
          )}
          {moreChoice === 'pause' && canPauseHabit && onPauseHabit && (
            <>
              <p className="today-more-note">This habit stays hidden until you come back.</p>
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
                      setMoreChoice(null)
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}
          {moreChoice === 'shrink' && canShrinkRunning && (
            <>
              <p className="today-more-note">Two minutes still counts.</p>
              <div className="today-skip-chips">
                <button
                  type="button"
                  className="today-skip-chip"
                  disabled={busy}
                  onClick={() => {
                    onShrinkRunningTimer(1)
                    setMoreOpen(false)
                    setMoreChoice(null)
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
                    setMoreChoice(null)
                  }}
                >
                  2 minutes
                </button>
              </div>
            </>
          )}
          {moreChoice === 'pauseTimer' && timerLive && (
            <button
              type="button"
              className="today-skip-chip"
              disabled={busy}
              onClick={() => {
                onTimerPause()
                setMoreOpen(false)
                setMoreChoice(null)
              }}
            >
              Pause timer
            </button>
          )}
          {moreChoice === 'stop' && timerPaused && (
            <button
              type="button"
              className="today-skip-chip"
              disabled={busy}
              onClick={() => {
                onTimerStop()
                setMoreOpen(false)
                setMoreChoice(null)
              }}
            >
              Stop and save
            </button>
          )}
          <button
            type="button"
            className="today-extra-btn"
            onClick={() => {
              if (moreChoice) {
                setMoreChoice(null)
                return
              }
              setMoreOpen(false)
            }}
          >
            {moreChoice ? 'Back' : 'Close'}
          </button>
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
