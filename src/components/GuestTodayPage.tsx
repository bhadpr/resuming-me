import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { todayLocalDate } from '../lib/dates'
import { canLogPastGoal, stacksSessionMinutes } from '../lib/dayStatus'
import {
  FASTING_HOURS_NOTE,
  SLEEP_HOURS_NOTE,
  WATER_GLASS_NOTE,
  countTapLabel,
  isNumberEntryVital,
  isStepsHabit,
  playsVideoWithTimer,
  showsHabitVideo,
  stepCountLabel,
} from '../lib/onboardingFlow'
import { formatDuration } from '../lib/timer'
import { HabitMark } from './HabitMark'
import { HabitVideoPlaceholder } from './HabitVideoPlaceholder'
import {
  appendGuestCount,
  appendGuestLog,
  guestReadingOnDate,
  upsertGuestReading,
  guestCountProgress,
  guestCountsOnDate,
  guestSaveWarning,
  guestSessionSeconds,
  guestTimerProgress,
  loadGuestDraft,
  setGuestStep,
  type GuestActivity,
  type GuestDraft,
  type GuestReading,
} from '../lib/guestDraft'

/** Local Today for someone who has not saved an account yet — same chrome as signed-in. */
export function GuestTodayPage() {
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
  const alreadySeconds =
    draft && running
      ? guestSessionSeconds(draft, running.localId, today, running)
      : 0
  const goalSeconds = running ? guestTimerProgress(running, 0).targetSeconds : 0
  const sessionGoalSeconds = Math.max(0, goalSeconds - alreadySeconds)
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

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
      setNote(null)
    } else {
      setNote('No worries. Try again anytime.')
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

  if (!draft) return null

  const warning = guestSaveWarning(draft)

  return (
        <div className="today-screen">
          <div className="guest-save-widget">
            {warning ? <p className="guest-save-widget-warning">{warning}</p> : null}
            <Link
              className="btn btn-primary"
              to="/start?step=8"
              onClick={() => setGuestStep(draft, 8)}
            >
              Save your progress
            </Link>
            <p className="guest-save-widget-note">Stays on this device for 7 days.</p>
          </div>

          <div className="screen-heading">
            <div>
              <h2>Today</h2>
              <p className="screen-sub">{dateLabel}</p>
            </div>
          </div>

          {note && (
            <div className="notice">
              <p>{note}</p>
            </div>
          )}

          {draft.activities.length === 0 ? (
            <div className="today-empty">
              <p className="today-empty-title">Today is waiting</p>
              <p className="today-empty-copy">Add one habit. It isn&apos;t a list to finish.</p>
              <Link className="btn btn-primary" to="/start?step=1&add=1">
                Add a habit
              </Link>
            </div>
          ) : (
            <section className="today-section">
              <ul className="today-list today-guest-list">
                {draft.activities.map((activity) => {
                  if (isNumberEntryVital(activity) || isStepsHabit(activity)) {
                    return (
                      <NumberVitalRow
                        key={activity.localId}
                        activity={activity}
                        reading={guestReadingOnDate(draft, activity.localId, today)}
                        target={isStepsHabit(activity) ? activity.targetValue : null}
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
                  if (activity.trackingMode !== 'count') {
                    const stacking = stacksSessionMinutes(activity)
                    const loggedSeconds = guestSessionSeconds(
                      draft,
                      activity.localId,
                      today,
                      activity,
                    )
                    const progress = guestTimerProgress(activity, loggedSeconds)
                    const isRunning = runningId === activity.localId
                    const liveSeconds = isRunning ? loggedSeconds + elapsed : loggedSeconds
                    const liveProgress = guestTimerProgress(activity, liveSeconds)
                    const showVideo = videoId === activity.localId
                    const canShowVideo = showsHabitVideo(activity.templateId)
                    const partial = !progress.done && loggedSeconds > 0
                    const rowState = isRunning
                      ? paused
                        ? 'today-row-progress'
                        : 'today-row-live'
                      : progress.done
                        ? 'today-row-done'
                        : partial
                          ? 'today-row-progress'
                          : ''
                    return (
                      <li
                        key={activity.localId}
                        className={`today-row today-row-stack ${rowState}`}
                      >
                        <div className="today-row-main">
                          <StatusMark live={isRunning && !paused} paused={isRunning && paused} />
                          <HabitMark
                            templateId={activity.templateId}
                            name={activity.name}
                            emoji={activity.emoji}
                          />
                          <span className="activity-meta">
                            <span className="activity-name">{activity.name}</span>
                            <span className="activity-desc">
                              {isRunning
                                ? `${liveProgress.label}${paused ? ' · paused' : ' · running'}`
                                : progress.label}
                              {partial && !isRunning ? ' · partial' : ''}
                              {progress.done && !isRunning ? ' · done' : ''}
                            </span>
                            {!isRunning && (
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
                            {canShowVideo && (
                              <button
                                type="button"
                                className="btn btn-ghost today-video-btn"
                                aria-expanded={showVideo}
                                onClick={() =>
                                  setVideoId((current) =>
                                    current === activity.localId ? null : activity.localId,
                                  )
                                }
                              >
                                {showVideo ? 'Hide video' : 'Video'}
                              </button>
                            )}
                          </span>
                          <span className="today-actions">
                            {isRunning ? (
                              <>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-today"
                                  onClick={() => setPaused((value) => !value)}
                                >
                                  {paused ? 'Resume' : 'Pause'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-primary btn-today"
                                  onClick={() => finishTimer(elapsed)}
                                >
                                  Done
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className={`btn btn-today ${progress.done && !stacking ? 'btn-today-done' : 'btn-primary'}`}
                                disabled={Boolean(runningId) || (progress.done && !stacking)}
                                onClick={() => startTimer(activity.localId)}
                              >
                                {progress.done && !stacking ? 'Done' : partial ? 'Resume' : 'Start'}
                              </button>
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
                        {canShowVideo && showVideo && (
                          <HabitVideoPlaceholder
                            templateId={activity.templateId}
                            name={activity.name}
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
                  return (
                    <li
                      key={activity.localId}
                      className={`today-row today-row-stack ${progress.done ? 'today-row-done' : ''}`}
                    >
                      <div className="today-row-main">
                        <HabitMark
                          templateId={activity.templateId}
                          name={activity.name}
                          emoji={activity.emoji}
                        />
                        <span className="activity-meta">
                          <span className="activity-name">{activity.name}</span>
                          <span className="activity-desc">
                            {progress.label}
                            {progress.done ? ' · done' : ''}
                          </span>
                          {activity.targetUnit === 'glasses' && (
                            <span className="activity-desc">{WATER_GLASS_NOTE}</span>
                          )}
                          {activity.targetUnit === 'hours' && (
                            <span className="activity-desc">{FASTING_HOURS_NOTE}</span>
                          )}
                          {activity.targetUnit === 'hr' && (
                            <span className="activity-desc">{SLEEP_HOURS_NOTE}</span>
                          )}
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
                          <button
                            type="button"
                            className="btn btn-ghost today-video-btn"
                            aria-expanded={videoId === activity.localId}
                            onClick={() =>
                              setVideoId((current) =>
                                current === activity.localId ? null : activity.localId,
                              )
                            }
                          >
                            {videoId === activity.localId ? 'Hide video' : 'Video'}
                          </button>
                        </span>
                        <span className="today-actions">
                          <button
                            type="button"
                            className={`btn btn-today ${progress.done && !openEnded ? 'btn-today-done' : 'btn-primary'}`}
                            disabled={progress.done && !openEnded}
                            onClick={() => setDraft(appendGuestCount(draft, activity.localId, today))}
                          >
                            {countTapLabel(activity.targetUnit, progress.done)}
                          </button>
                        </span>
                      </div>
                      {videoId === activity.localId && (
                        <HabitVideoPlaceholder
                          templateId={activity.templateId}
                          name={activity.name}
                        />
                      )}
                    </li>
                  )
                })}
              </ul>
              <Link className="btn btn-secondary today-add" to="/start?step=1&add=1">
                Add a habit
              </Link>
            </section>
          )}
        </div>
  )
}

function NumberVitalRow({
  activity,
  reading,
  target = null,
  onSave,
}: {
  activity: GuestActivity
  reading: GuestReading | null
  target?: number | null
  onSave: (value: number, secondaryValue: number | null) => void
}) {
  const paired = activity.templateId === 'blood_pressure'
  const steps = activity.templateId === 'steps'
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
      return
    }
    const lower = Number(secondary)
    if (secondary === '' || Number.isNaN(lower)) return
    onSave(parsed, lower)
  }

  const summary = steps
    ? reading
      ? `${stepCountLabel(reading.value)} / ${stepCountLabel(target ?? 10000)} today`
      : `Goal ${stepCountLabel(target ?? 10000)}`
    : !reading
      ? paired
        ? 'Upper and lower'
        : 'Beats per minute'
      : paired && reading.secondaryValue != null
        ? `${reading.value}/${reading.secondaryValue} mmHg today`
        : `${reading.value} bpm today`

  return (
    <li className="today-row today-row-stack">
      <form className="today-row-main vital-entry" onSubmit={handleSubmit}>
        <HabitMark templateId={activity.templateId} name={activity.name} emoji={activity.emoji} />
        <span className="activity-meta">
          <span className="activity-name">{activity.name}</span>
          <span className="activity-desc">{summary}</span>
        </span>
        <span className="today-actions">
          <input
            className="field-input field-input-sm"
            type="number"
            step="any"
            inputMode="numeric"
            placeholder={paired ? 'Upper' : steps ? 'Steps' : 'bpm'}
            value={value}
            aria-label={paired ? 'Upper blood pressure' : steps ? 'Steps today' : 'Heart rate'}
            onChange={(event) => setValue(event.target.value)}
          />
          {paired && (
            <input
              className="field-input field-input-sm"
              type="number"
              step="any"
              inputMode="numeric"
              placeholder="Lower"
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
            {reading ? 'Update' : 'Log'}
          </button>
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
