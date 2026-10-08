import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { todayLocalDate } from '../lib/dates'
import { canLogPastGoal, stacksSessionMinutes } from '../lib/dayStatus'
import {
  countTapLabel,
  isNumberEntryVital,
  isStepsHabit,
  playsVideoWithTimer,
  showsHabitVideo,
  stepCountLabel,
} from '../lib/onboardingFlow'
import { formatDuration } from '../lib/timer'
import { AppAlertsNote } from './AppAlertsNote'
import { HabitMark } from './HabitMark'
import { Toast } from './Toast'
import { useUndoToast } from '../hooks/useUndoToast'
import { formatCompletedUndoMessage, formatCountUndoMessage, formatSessionUndoMessage } from '../lib/undoMessages'
import { HabitVideoPlaceholder } from './HabitVideoPlaceholder'
import { MedicineDoseRow } from './MedicineDoses'
import { ReminderDoneRow, ReminderRow } from './ReminderSection'
import { StepsCard } from './StepsCard'
import { TodayByTime, type TodayTimedItem } from './TodayByTime'
import { activityPeriod, periodForHour } from '../lib/dayPeriod'
import { isDoseFinished, type DueDose } from '../lib/medicineSchedule'
import {
  REMINDERS_CHANGED,
  remindersDoneToday,
  remindersForToday,
  type Reminder,
} from '../lib/reminderSchedule'
import { catalogTrackId, visibleName } from '../lib/catalogName'
import { MEDICINE_REMINDER_CHANGED, clearSkip, rememberSkip } from '../lib/medicineReminderState'
import { MEDICINES_ENABLED } from '../config'
import { SkipLink, UndoSkipButton } from './TodaySkip'
import { useTodaySkips } from '../hooks/useTodaySkips'
import { track } from '../lib/track'
import { useLocale } from '../hooks/useLocale'
import { formatLongDate } from '../lib/i18n'
import {
  appendGuestCount,
  appendGuestLog,
  removeLastGuestLog,
  guestReadingOnDate,
  upsertGuestReading,
  guestCountProgress,
  guestCountsOnDate,
  guestDosesOnDate,
  guestSaveWarning,
  guestSessionSeconds,
  guestTapsDone,
  guestTimerProgress,
  loadGuestDraft,
  setGuestStep,
  toggleGuestDose,
  completeGuestReminder,
  removeGuestReminder,
  reopenGuestReminder,
  updateGuestReminder,
  type GuestActivity,
  type GuestDraft,
  type GuestReading,
} from '../lib/guestDraft'

/** Local Today for someone who has not saved an account yet — same chrome as signed-in. */
function trackGuestLog(
  activity: GuestActivity,
  kind: 'session' | 'count' | 'vital',
  minutes: number | null,
): void {
  track('log_created', {
    activity_type: activity.type,
    kind,
    minutes,
    was_partial: false,
    template_id: catalogTrackId(activity.templateId),
    signed_in: false,
  })
}

export function GuestTodayPage() {
  const { t, locale } = useLocale()
  const undoToast = useUndoToast()
  const [draft, setDraft] = useState<GuestDraft | null>(() => loadGuestDraft())
  const [runningId, setRunningId] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const [videoId, setVideoId] = useState<string | null>(null)
  const startedAt = useRef<string | null>(null)
  const tickAt = useRef<number | null>(null)
  const finished = useRef(false)
  const draftRef = useRef(draft)
  draftRef.current = draft

  const running = draft?.activities.find((item) => item.localId === runningId) ?? null
  const today = todayLocalDate()
  const skips = useTodaySkips(today)
  const alreadySeconds =
    draft && running
      ? guestSessionSeconds(draft, running.localId, today, running)
      : 0
  const goalSeconds = running ? guestTimerProgress(running, 0).targetSeconds : 0
  const sessionGoalSeconds = Math.max(0, goalSeconds - alreadySeconds)
  const dateLabel = formatLongDate(locale)

  useEffect(() => {
    const refresh = () => setDraft(loadGuestDraft())
    window.addEventListener(MEDICINE_REMINDER_CHANGED, refresh)
    window.addEventListener(REMINDERS_CHANGED, refresh)
    return () => {
      window.removeEventListener(MEDICINE_REMINDER_CHANGED, refresh)
      window.removeEventListener(REMINDERS_CHANGED, refresh)
    }
  }, [])

  useEffect(() => {
    if (!runningId || paused) return
    tickAt.current = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const delta = tickAt.current ? (now - tickAt.current) / 1000 : 0
      tickAt.current = now
      setElapsed((prev) => prev + delta)
    }, 250)
    return () => window.clearInterval(id)
  }, [runningId, paused])

  function finishTimer(seconds: number) {
    if (finished.current) return
    const current = draftRef.current
    const activityId = runningId
    const started = startedAt.current
    if (!current || !activityId || !started) return
    finished.current = true
    const whole = Math.max(0, Math.floor(seconds))
    if (whole >= 1) {
      setDraft(
        appendGuestLog(current, {
          localActivityId: activityId,
          startedAt: started,
          durationSeconds: whole,
          date: todayLocalDate(),
        }),
      )
      const activity = current.activities.find((item) => item.localId === activityId)
      if (activity) trackGuestLog(activity, 'session', Math.round(whole / 60))
      undoToast.show(formatSessionUndoMessage(activity?.name ?? '', whole), () => {
        const latest = draftRef.current
        if (!latest) return
        setDraft(removeLastGuestLog(latest, activityId, 'session'))
        track('log_undone', { kind: 'session', signed_in: false })
      })
      setNote(null)
    } else {
      setNote(t('today.tryAgain'))
    }
    setRunningId(null)
    setPaused(false)
    setElapsed(0)
  }

  useEffect(() => {
    if (!runningId || goalSeconds <= 0) return
    if (alreadySeconds + elapsed < goalSeconds) return
    finishTimer(elapsed)
    // finishTimer reads the latest draft from a ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, runningId, goalSeconds, alreadySeconds])

  function startTimer(localId: string) {
    finished.current = false
    startedAt.current = new Date().toISOString()
    setElapsed(0)
    setPaused(false)
    setNote(null)
    setRunningId(localId)
    const activity = draftRef.current?.activities.find((item) => item.localId === localId)
    if (activity && playsVideoWithTimer(activity.templateId)) setVideoId(localId)
  }

  function patchReminder(id: string, patch: Partial<Reminder>) {
    const latest = draftRef.current
    if (latest) setDraft(updateGuestReminder(latest, id, patch))
  }

  function skipReminder(reminder: Reminder) {
    const latest = draftRef.current
    if (!latest) return
    skips.skip(`reminder:${reminder.id}`)
    setDraft(completeGuestReminder(latest, reminder.id, new Date().toISOString()))
  }

  function cancelReminder(reminder: Reminder) {
    const latest = loadGuestDraft()
    if (latest) setDraft(removeGuestReminder(latest, reminder.id))
  }

  function reopenReminder(reminder: Reminder) {
    const latest = loadGuestDraft()
    if (latest) setDraft(reopenGuestReminder(latest, reminder.id))
  }

  function markReminderDone(reminder: Reminder) {
    const latest = draftRef.current
    if (!latest) return
    setDraft(completeGuestReminder(latest, reminder.id, new Date().toISOString()))
    track('reminder_done', { signed_in: false, every_year: reminder.everyYear })
    undoToast.show(t('reminders.doneToast', { text: reminder.text }), () => reopenReminder(reminder))
  }

  if (!draft) return null

  const warning = guestSaveWarning(draft)

  const activitySkipKey = (activity: GuestActivity) => `guest-activity:${activity.localId}`

  const isDoneToday = (activity: GuestActivity): boolean => {
    if (isStepsHabit(activity)) return false
    if (skips.isSkipped(activitySkipKey(activity))) return true
    if (isNumberEntryVital(activity)) return guestReadingOnDate(draft, activity.localId, today) != null
    if (activity.trackingMode !== 'count' && !guestTapsDone(activity)) {
      if (runningId === activity.localId) return false
      const seconds = guestSessionSeconds(draft, activity.localId, today, activity)
      return guestTimerProgress(activity, seconds).done
    }
    return guestCountProgress(activity, guestCountsOnDate(draft, activity.localId, today)).done
  }

  const toggleDose = (dose: DueDose) => {
    if (dose.skipped) {
      clearSkip({ medicineId: dose.medicineId, date: today, hour: dose.hour, minute: dose.minute })
      setDraft(loadGuestDraft())
      return
    }
    setDraft(toggleGuestDose(draft, dose, today))
  }

  const skipDose = (dose: DueDose) => {
    rememberSkip({ medicineId: dose.medicineId, date: today, hour: dose.hour, minute: dose.minute })
    setDraft(loadGuestDraft())
  }

  const reminderMinutes = (reminder: Reminder) =>
    reminder.hour == null ? null : reminder.hour * 60 + (reminder.minute ?? 0)

  const renderGuestActivity = (activity: GuestActivity) => {
    if (isStepsHabit(activity)) {
      return (
        <StepsCard
          key={activity.localId}
          goal={activity.targetValue ?? 10000}
          today={today}
        />
      )
    }
    if (isNumberEntryVital(activity)) {
      return (
        <NumberVitalRow
          key={activity.localId}
          activity={activity}
          reading={guestReadingOnDate(draft, activity.localId, today)}
          target={activity.targetValue}
          skipped={skips.isSkipped(activitySkipKey(activity))}
          onSkip={() => skips.skip(activitySkipKey(activity))}
          onUnskip={() => skips.unskip(activitySkipKey(activity))}
          onSave={(value, secondaryValue) =>
            setDraft(
              upsertGuestReading(draft, {
                localActivityId: activity.localId,
                date: today,
                value,
                secondaryValue,
              }),
            )
          }
        />
      )
    }
    if (activity.trackingMode !== 'count' && !guestTapsDone(activity)) {
      const stacking = stacksSessionMinutes(activity)
      const loggedSeconds = guestSessionSeconds(
        draft,
        activity.localId,
        today,
        activity,
      )
      const progress = guestTimerProgress(activity, loggedSeconds)
      const isRunning = runningId === activity.localId
      const skipped = !progress.done && !isRunning && skips.isSkipped(activitySkipKey(activity))
      const liveSeconds = isRunning ? loggedSeconds + elapsed : loggedSeconds
      const liveProgress = guestTimerProgress(activity, liveSeconds)
      const showVideo = videoId === activity.localId
      const canShowVideo = showsHabitVideo(activity.templateId)
      const partial = !progress.done && loggedSeconds > 0
      const rowState = isRunning
        ? paused
          ? 'today-row-progress'
          : 'today-row-live'
        : progress.done || skipped
          ? 'today-row-done'
          : partial
            ? 'today-row-progress'
            : ''
      return (
        <li
          key={activity.localId}
          className={`today-row today-row-stack today-row-compact item-kind-activity ${rowState}`}
        >
          <div className="today-row-head">
            <HabitMark
              templateId={activity.templateId}
              name={visibleName(activity, locale)}
              emoji={activity.emoji}
            />
            <span className="activity-name">{visibleName(activity, locale)}</span>
            <StatusMark live={isRunning && !paused} paused={isRunning && paused} />
          </div>
          <div className="today-row-main">
            <span className="activity-meta">
              <span className="activity-desc">
                {isRunning
                  ? `${liveProgress.label}${paused ? ` · ${t('today.paused')}` : ` · ${t('today.running')}`}`
                  : skipped
                    ? t('today.skippedLine')
                    : progress.label}
                {progress.done && !isRunning ? ` · ${t('today.done')}` : ''}
              </span>
              {!isRunning && loggedSeconds > 0 && (
                <div className="progress-bar" aria-hidden>
                  <div
                    className={`progress-bar-fill ${progress.done ? 'progress-bar-fill-done' : ''}`}
                    style={{
                      width: `${Math.min(
                        100,
                        (loggedSeconds / Math.max(progress.targetSeconds || 1, 1)) * 100,
                      )}%`,
                    }}
                  />
                </div>
              )}
            </span>
            <span className="today-actions today-actions-stack">
              {skipped ? (
                <UndoSkipButton onUndo={() => skips.unskip(activitySkipKey(activity))} />
              ) : isRunning ? (
                <>
                  <button
                    type="button"
                    className="btn btn-secondary btn-today"
                    onClick={() => setPaused((value) => !value)}
                  >
                    {paused ? t('today.resume') : t('today.pause')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-today"
                    onClick={() => finishTimer(elapsed)}
                  >
                    {t('today.done')}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={`btn btn-today ${progress.done && !stacking ? 'btn-today-done' : 'btn-primary'}`}
                  disabled={Boolean(runningId) || (progress.done && !stacking)}
                  onClick={() => startTimer(activity.localId)}
                >
                  {progress.done && !stacking ? t('today.done') : partial ? t('today.resume') : t('today.start')}
                </button>
              )}
              {!progress.done && !isRunning && !skipped && (
                <SkipLink
                  disabled={Boolean(runningId)}
                  onSkip={() => skips.skip(activitySkipKey(activity))}
                />
              )}
            </span>
          </div>
          {isRunning ? (
            <div
              className={`today-timer-elapsed ${paused ? 'today-timer-elapsed-paused' : ''}`}
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="today-timer-elapsed-value">
                {formatDuration(Math.floor(elapsed))}
                {sessionGoalSeconds > 0 ? (
                  <span className="today-timer-target-hint">
                    {' '}
                    / {formatDuration(sessionGoalSeconds)}
                  </span>
                ) : null}
              </span>
              {goalSeconds > 0 ? (
                <div className="progress-bar today-timer-progress" aria-hidden>
                  <div
                    className={`progress-bar-fill ${liveProgress.done ? 'progress-bar-fill-done' : ''}`}
                    style={{
                      width: `${Math.min(100, (liveSeconds / goalSeconds) * 100)}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}
          {canShowVideo && (
            <div className="today-extra">
              <button
                type="button"
                className="today-extra-btn today-watch"
                aria-expanded={showVideo}
                onClick={() =>
                  setVideoId((current) =>
                    current === activity.localId ? null : activity.localId,
                  )
                }
              >
                {showVideo ? t('today.hideVideo') : t('today.video')}
              </button>
            </div>
          )}
          {canShowVideo && showVideo && (
            <HabitVideoPlaceholder
              templateId={activity.templateId}
              name={visibleName(activity, locale)}
              playing={isRunning && !paused}
              paused={isRunning && paused}
            />
          )}
        </li>
      )
    }
    const progress = guestCountProgress(
      activity,
      guestCountsOnDate(draft, activity.localId, today),
    )
    const openEnded = canLogPastGoal(activity.targetUnit)
    const tick = guestTapsDone(activity)
    const countSkipped = !progress.done && skips.isSkipped(activitySkipKey(activity))
    return (
      <li
        key={activity.localId}
        className={`today-row today-row-stack today-row-compact item-kind-activity ${progress.done || countSkipped ? 'today-row-done' : ''}`}
      >
        <div className="today-row-head">
          <HabitMark
            templateId={activity.templateId}
            name={visibleName(activity, locale)}
            emoji={activity.emoji}
          />
          <span className="activity-name">{visibleName(activity, locale)}</span>
        </div>
        <div className="today-row-main">
          <span className="activity-meta">
            {(countSkipped || !tick) && (
              <span className="activity-desc">
                {countSkipped ? (
                  t('today.skippedLine')
                ) : (
                  <>
                    {progress.label}
                    {progress.done ? ` · ${t('today.done')}` : ''}
                  </>
                )}
              </span>
            )}
            {activity.targetUnit === 'glasses' && (
              <span className="activity-desc">{t('notes.waterGlass')}</span>
            )}
            {activity.targetUnit === 'hours' && (
              <span className="activity-desc">{t('notes.fasting')}</span>
            )}
            {activity.targetUnit === 'hr' && (
              <span className="activity-desc">{t('notes.sleep')}</span>
            )}
            {progress.value > 0 && !tick && (
              <div className="progress-bar" aria-hidden>
                <div
                  className={`progress-bar-fill ${progress.done ? 'progress-bar-fill-done' : ''}`}
                  style={{
                    width: `${Math.min(
                      100,
                      (progress.value / Math.max(progress.target || 1, 1)) * 100,
                    )}%`,
                  }}
                />
              </div>
            )}
          </span>
          <span className="today-actions today-actions-stack">
            {countSkipped ? (
              <UndoSkipButton onUndo={() => skips.unskip(activitySkipKey(activity))} />
            ) : (
              <button
                type="button"
                className={`btn btn-today ${progress.done && !openEnded ? 'btn-today-done' : 'btn-primary'}`}
                disabled={progress.done && !openEnded}
                onClick={() => {
                  setDraft(appendGuestCount(draft, activity.localId, today))
                  trackGuestLog(activity, 'count', null)
                  const name = visibleName(activity, locale)
                  undoToast.show(tick ? formatCompletedUndoMessage(name) : formatCountUndoMessage(name), () => {
                    const latest = draftRef.current
                    if (!latest) return
                    setDraft(removeLastGuestLog(latest, activity.localId, 'count'))
                    track('log_undone', { kind: 'count', signed_in: false })
                  })
                }}
              >
                {tick ? t('today.done') : countTapLabel(activity.targetUnit, progress.done)}
              </button>
            )}
            {!progress.done && !countSkipped && (
              <SkipLink onSkip={() => skips.skip(activitySkipKey(activity))} />
            )}
          </span>
        </div>
        {showsHabitVideo(activity.templateId) && (
          <div className="today-extra">
            <button
              type="button"
              className="today-extra-btn today-watch"
              aria-expanded={videoId === activity.localId}
              onClick={() =>
                setVideoId((current) =>
                  current === activity.localId ? null : activity.localId,
                )
              }
            >
              {videoId === activity.localId ? t('today.hideVideo') : t('today.video')}
            </button>
          </div>
        )}
        {showsHabitVideo(activity.templateId) && videoId === activity.localId && (
          <HabitVideoPlaceholder
            templateId={activity.templateId}
              name={visibleName(activity, locale)}
            />
        )}
      </li>
    )
  }

  const timedItems: TodayTimedItem[] = [
    ...(MEDICINES_ENABLED ? guestDosesOnDate(draft, today) : []).map((dose) => ({
      key: `dose-${dose.key}`,
      kind: 'medicine' as const,
      period: periodForHour(dose.hour),
      minutes: dose.hour * 60 + dose.minute,
      done: isDoseFinished(dose),
      node: <MedicineDoseRow dose={dose} busy={false} onToggle={toggleDose} onSkip={skipDose} />,
    })),
    ...draft.activities.map((activity) => ({
      key: `activity-${activity.localId}`,
      kind: isNumberEntryVital(activity) ? ('vital' as const) : ('activity' as const),
      period: activityPeriod(activity),
      done: isDoneToday(activity),
      node: renderGuestActivity(activity),
    })),
    ...remindersForToday(draft.reminders, today).map((reminder) => ({
      key: `reminder-${reminder.id}`,
      kind: 'reminder' as const,
      period: periodForHour(reminder.hour),
      minutes: reminderMinutes(reminder),
      done: false,
      node: (
        <ReminderRow
          reminder={reminder}
          today={today}
          busy={false}
          onDone={() => {
            skips.unskip(`reminder:${reminder.id}`)
            markReminderDone(reminder)
          }}
          onSkip={() => skipReminder(reminder)}
          onMove={(day) => patchReminder(reminder.id, { day })}
          onCancel={() => cancelReminder(reminder)}
        />
      ),
    })),
    ...remindersDoneToday(draft.reminders, today).map((reminder) => ({
      key: `reminder-${reminder.id}`,
      kind: 'reminder' as const,
      period: periodForHour(reminder.hour),
      minutes: reminderMinutes(reminder),
      done: true,
      node: (
        <ReminderDoneRow
          reminder={reminder}
          busy={false}
          skipped={skips.isSkipped(`reminder:${reminder.id}`)}
          onNotDone={() => {
            skips.unskip(`reminder:${reminder.id}`)
            reopenReminder(reminder)
          }}
        />
      ),
    })),
  ]

  return (
        <div className="today-screen">
          <div className="guest-save-widget">
            {warning ? <p className="guest-save-widget-warning">{warning}</p> : null}
            <Link
              className="btn btn-primary"
              to="/start?step=8"
              onClick={() => setGuestStep(draft, 8)}
            >
              {t('today.save')}
            </Link>
            <p className="guest-save-widget-note">{t('today.stays')}</p>
          </div>

          <div className="screen-heading today-heading">
            <h2>{t('nav.today')}</h2>
            <p className="screen-sub">{dateLabel}</p>
          </div>
          {timedItems.some((item) => !item.done && (item.kind === 'medicine' || item.kind === 'reminder')) && (
            <AppAlertsNote where="today" />
          )}

          {note && (
            <div className="notice">
              <p>{note}</p>
            </div>
          )}

          <TodayByTime items={timedItems} listClassName="today-list today-guest-list" />

          <div className="today-add-row">
            <Link className="btn btn-secondary today-add" to="/start?step=1&add=1">
              {t('today.add')}
            </Link>
            <Link className="btn btn-secondary today-add" to="/reminders/new">
              {t('reminders.add')}
            </Link>
          </div>
          {undoToast.toast && (
            <Toast message={undoToast.toast.message} onUndo={() => void undoToast.undo()} />
          )}
        </div>
  )
}

function NumberVitalRow({
  activity,
  reading,
  target = null,
  skipped: skippedToday,
  onSave,
  onSkip,
  onUnskip,
}: {
  activity: GuestActivity
  reading: GuestReading | null
  target?: number | null
  skipped: boolean
  onSave: (value: number, secondaryValue: number | null) => void
  onSkip: () => void
  onUnskip: () => void
}) {
  const { t, locale } = useLocale()
  const paired = activity.templateId === 'blood_pressure'
  const steps = activity.templateId === 'steps'
  const weight = activity.templateId === 'weight'
  const [value, setValue] = useState(reading ? String(reading.value) : '')
  const [secondary, setSecondary] = useState(
    reading?.secondaryValue == null ? '' : String(reading.secondaryValue),
  )

  useEffect(() => {
    setValue(reading ? String(reading.value) : '')
    setSecondary(reading?.secondaryValue == null ? '' : String(reading.secondaryValue))
  }, [reading])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const parsed = Number(value)
    if (value === '' || Number.isNaN(parsed)) return
    if (!paired) {
      onSave(parsed, null)
      trackGuestLog(activity, 'vital', null)
      return
    }
    const lower = Number(secondary)
    if (secondary === '' || Number.isNaN(lower)) return
    onSave(parsed, lower)
    trackGuestLog(activity, 'vital', null)
  }

  const summary = steps
    ? reading
      ? t('today.stepsToday', {
          value: stepCountLabel(reading.value),
          goal: stepCountLabel(target ?? 10000),
        })
      : t('today.goalSteps', { goal: stepCountLabel(target ?? 10000) })
    : weight
      ? reading
        ? t('today.kgToday', { value: reading.value })
        : target
          ? t('today.goalKg', { goal: target })
          : t('today.weighIn')
    : !reading
      ? paired
        ? t('today.upperLower')
        : t('today.beats')
      : paired && reading.secondaryValue != null
        ? t('today.mmHg', { value: `${reading.value}/${reading.secondaryValue}` })
        : t('today.bpmToday', { value: reading.value })

  const skipped = !reading && skippedToday

  return (
    <li
      className={`today-row today-row-stack today-row-compact item-kind-vital ${paired && !skipped ? 'today-row-entry' : ''} ${reading || skipped ? 'today-row-done' : ''}`}
    >
      <div className="today-row-head">
        <HabitMark templateId={activity.templateId} name={visibleName(activity, locale)} emoji={activity.emoji} />
        <span className="activity-name">{visibleName(activity, locale)}</span>
      </div>
      <form className={`today-row-main ${paired ? 'vital-entry' : ''}`} onSubmit={handleSubmit}>
        <span className="activity-meta">
          <span className="activity-desc">{skipped ? t('today.skippedLine') : summary}</span>
        </span>
        <span className="today-actions today-actions-stack">
          {skipped ? (
            <UndoSkipButton onUndo={onUnskip} />
          ) : (
            <span className="today-actions-row">
              <input
                className="field-input field-input-sm"
                type="number"
                step="any"
                inputMode={weight ? 'decimal' : 'numeric'}
                placeholder={
                  paired ? t('today.upper') : steps ? t('today.steps') : weight ? t('today.kg') : t('today.bpm')
                }
                value={value}
                aria-label={
                  paired ? 'Upper blood pressure' : steps ? 'Steps today' : weight ? 'Weight today' : 'Heart rate'
                }
                onChange={(event) => setValue(event.target.value)}
              />
              {paired && (
                <input
                  className="field-input field-input-sm"
                  type="number"
                  step="any"
                  inputMode="numeric"
                  placeholder={t('today.lower')}
                  value={secondary}
                  aria-label="Lower blood pressure"
                  onChange={(event) => setSecondary(event.target.value)}
                />
              )}
              <button
                type="submit"
                className="btn btn-primary btn-today"
                disabled={value === '' || (paired && secondary === '')}
              >
                {reading ? t('today.update') : t('today.log')}
              </button>
            </span>
          )}
          {!reading && !skipped && <SkipLink onSkip={onSkip} />}
        </span>
      </form>
    </li>
  )
}

function StatusMark({ live, paused }: { live: boolean; paused: boolean }) {
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
