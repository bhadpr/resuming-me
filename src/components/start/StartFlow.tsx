import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ACTIVITY_TEMPLATES, activityInputFromTemplate } from '../../data/activityTemplates'
import { EmailSignInForm } from '../EmailSignInForm'
import { AUTH_PROVIDERS } from '../../lib/authProviders'
import { addDays, todayLocalDate } from '../../lib/dates'
import {
  GUEST_NAME_MAX,
  appendGuestLog,
  removeGuestActivity,
  sanitizeActivityName,
  saveGuestDraft,
  setGuestStep,
  upsertGuestActivity,
  type GuestActivity,
  type GuestDraft,
} from '../../lib/guestDraft'
import {
  INSIGHTS_PREVIEW,
  ONBOARDING_TIMER_SECONDS,
  SLIP_OPTIONS,
  activitySizeControl,
  gapNote,
  glassesInGap,
  isWaterHabit,
  celebrationCopy,
  continueLabel,
  defaultReminderTime,
  gapHeading,
  gapOptionsFor,
  gapReassurance,
  onboardingSummary,
  smallestStep,
  toggleSlip,
} from '../../lib/onboardingFlow'
import { track } from '../../lib/track'

function newLocalId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `g-${Date.now()}`
}

function currentSize(activity: GuestActivity): number {
  const control = activitySizeControl(activity)
  const fallback = control?.steps[0] ?? 1
  if (activity.type === 'weekly_n' && activity.trackingMode !== 'timer') {
    return activity.weeklyTarget ?? fallback
  }
  return activity.targetValue ?? fallback
}

function withSize(activity: GuestActivity, value: number): GuestActivity {
  if (!activitySizeControl(activity)) return activity
  if (activity.type === 'weekly_n' && activity.trackingMode !== 'timer') {
    return { ...activity, weeklyTarget: value }
  }
  if (isWaterHabit(activity) || activity.targetUnit === 'glasses') {
    return { ...activity, targetValue: value, targetUnit: 'glasses' }
  }
  if (activity.trackingMode === 'count') return { ...activity, targetValue: value, targetUnit: null }
  return { ...activity, targetValue: value, targetUnit: 'minutes' }
}

function choiceCode(ids: string[]): string {
  return ids.slice(0, 8).join(',').slice(0, 80)
}

export function StartFlow({
  draft,
  onDraft,
  onGoogle,
}: {
  draft: GuestDraft
  onDraft: (draft: GuestDraft) => void
  onGoogle: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [customOpen, setCustomOpen] = useState(false)
  const [customName, setCustomName] = useState('')
  const [gapIndex, setGapIndex] = useState(0)
  const [reassurance, setReassurance] = useState<string | null>(null)
  const [focus, setFocus] = useState(0)
  const [timing, setTiming] = useState(false)
  const [paused, setPaused] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [googleBusy, setGoogleBusy] = useState(false)
  const startedAt = useRef<string | null>(null)
  const tickAt = useRef<number | null>(null)
  const finished = useRef(false)
  const gapTimer = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (gapTimer.current != null) window.clearTimeout(gapTimer.current)
    }
  }, [])

  useEffect(() => {
    const key = `resuming-onboarding-started-${draft.guestId}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch {
      /* ignore */
    }
    track('onboarding_started')
  }, [draft.guestId])

  useEffect(() => {
    if (draft.step !== 8) return
    track('signin_shown')
  }, [draft.step])

  useEffect(() => {
    if (!timing || paused) return
    let lock: { release: () => Promise<void> } | null = null
    let cancelled = false
    const wake = navigator.wakeLock
    if (wake) {
      void wake.request('screen').then((sentinel) => {
        if (cancelled) void sentinel.release()
        else lock = sentinel
      }).catch(() => {})
    }
    tickAt.current = Date.now()
    const id = window.setInterval(() => {
      const now = Date.now()
      const delta = tickAt.current ? (now - tickAt.current) / 1000 : 0
      tickAt.current = now
      setElapsed((prev) => {
        const next = prev + delta
        if (next >= ONBOARDING_TIMER_SECONDS) {
          window.clearInterval(id)
        }
        return next
      })
    }, 250)
    return () => {
      cancelled = true
      window.clearInterval(id)
      void lock?.release()
    }
  }, [timing, paused])

  function persist(next: GuestDraft) {
    onDraft(next)
  }

  function finishStep(step: number, choices: string, next: GuestDraft) {
    track('onboarding_step_completed', { step, choices })
    persist(next)
  }

  function go(step: number, base: GuestDraft = draft) {
    persist(setGuestStep(base, step))
  }

  const activity = draft.activities[Math.min(focus, Math.max(draft.activities.length - 1, 0))]
  const gapActivity = draft.activities[gapIndex]

  function toggleTemplate(id: string) {
    const existing = draft.activities.find((item) => item.templateId === id)
    if (existing) {
      persist(removeGuestActivity(draft, existing.localId))
      return
    }
    if (draft.activities.length >= 3) return
    const template = ACTIVITY_TEMPLATES.find((item) => item.id === id)
    if (!template) return
    const input = activityInputFromTemplate(template, 'tiny')
    const deadline = template.type === 'deadline' ? addDays(todayLocalDate(), 14) : null
    persist(
      upsertGuestActivity(draft, {
        localId: newLocalId(),
        name: input.name,
        emoji: input.emoji,
        type: input.type,
        trackingMode: input.trackingMode,
        targetValue: input.targetValue,
        targetUnit: input.targetUnit,
        weeklyTarget: input.weeklyTarget,
        deadline,
        templateId: template.id,
        why: null,
        usuallyWhen: null,
      }),
    )
  }

  function addCustom() {
    const name = sanitizeActivityName(customName)
    if (!name || draft.activities.length >= 3) return
    persist(
      upsertGuestActivity(draft, {
        localId: newLocalId(),
        name,
        emoji: '✨',
        type: 'daily',
        trackingMode: 'timer',
        targetValue: 2,
        targetUnit: 'minutes',
        weeklyTarget: null,
        deadline: null,
        templateId: null,
        why: null,
        usuallyWhen: null,
      }),
    )
    setCustomName('')
    setCustomOpen(false)
  }

  function stepAfterGap(base: GuestDraft): number {
    return base.activities.some((item) => activitySizeControl(item)) ? 3 : 4
  }

  function pickGap(id: string) {
    if (!gapActivity) return
    const glasses = glassesInGap(id)
    const activities =
      glasses == null
        ? draft.activities
        : draft.activities.map((item) =>
            item.localId === gapActivity.localId
              ? { ...item, targetValue: glasses, targetUnit: 'glasses' as const }
              : item,
          )
    const next = saveGuestDraft({
      ...draft,
      activities,
      gapAnswer: { ...draft.gapAnswer, [gapActivity.localId]: id },
    })
    persist(next)
    setReassurance(gapReassurance(id))
    if (gapTimer.current != null) window.clearTimeout(gapTimer.current)
    gapTimer.current = window.setTimeout(() => {
      gapTimer.current = null
      setReassurance(null)
      if (gapIndex + 1 < next.activities.length) setGapIndex((index) => index + 1)
      else finishStep(2, choiceCode(Object.values(next.gapAnswer)), setGuestStep(next, stepAfterGap(next)))
    }, 1200)
  }

  function setActivitySize(localId: string, value: number) {
    const current = draft.activities.find((item) => item.localId === localId)
    if (!current) return
    persist(upsertGuestActivity(draft, withSize(current, value)))
  }

  function beginTimer() {
    if (!activity) return
    startedAt.current = new Date().toISOString()
    setElapsed(0)
    setPaused(false)
    setTiming(true)
    track('onboarding_timer_started')
  }

  function completeTimer(seconds: number) {
    if (finished.current) return
    finished.current = true
    if (!activity || !startedAt.current) {
      go(6)
      return
    }
    const whole = Math.floor(seconds)
    let next = saveGuestDraft({ ...draft, timerSkipped: false })
    if (whole >= 30) {
      next = appendGuestLog(next, {
        localActivityId: activity.localId,
        startedAt: startedAt.current,
        durationSeconds: whole,
        date: todayLocalDate(),
      })
      track('onboarding_timer_completed', { seconds: whole })
    }
    setTiming(false)
    finishStep(5, whole >= 30 ? 'done' : 'short', setGuestStep(next, 6))
  }

  useEffect(() => {
    if (timing && elapsed >= ONBOARDING_TIMER_SECONDS) completeTimer(elapsed)
    // completeTimer closes over the latest draft via the render that crossed the line.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, timing])

  function skipTimer() {
    const next = saveGuestDraft({ ...draft, timerSkipped: true })
    track('onboarding_timer_skipped')
    setTiming(false)
    finishStep(5, 'later', setGuestStep(next, 6))
  }

  const remaining = Math.max(0, ONBOARDING_TIMER_SECONDS - Math.floor(elapsed))
  const mm = String(Math.floor(remaining / 60))
  const ss = String(remaining % 60).padStart(2, '0')
  const celebrate = celebrationCopy(draft)

  if (timing && activity) {
    return (
      <div className="start-timer">
        <p className="onboarding-kicker">{activity.emoji} {activity.name}</p>
        <p className="start-timer-clock" aria-live="polite">
          {mm}:{ss}
        </p>
        <div className="form-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setPaused((value) => !value)}>
            {paused ? 'Resume' : 'Pause'}
          </button>
          <button type="button" className="btn btn-primary" onClick={() => completeTimer(elapsed)}>
            Done
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="start-flow">
      <div className="onboarding-dots" aria-label={`Step ${draft.step} of 8`}>
        {Array.from({ length: 8 }, (_, index) => (
          <span
            key={index}
            className={index + 1 === draft.step ? 'onboarding-dot onboarding-dot-active' : 'onboarding-dot'}
          />
        ))}
      </div>

      {draft.step > 1 && (
        <button
          type="button"
          className="btn btn-ghost start-back"
          onClick={() => {
            const previous = draft.step - 1
            if (previous === 3 && !draft.activities.some((item) => activitySizeControl(item))) go(2)
            else go(previous)
          }}
        >
          Back
        </button>
      )}

      {draft.step === 1 && (
        <>
          <h1 className="screen-heading">What have you been meaning to get back to?</h1>
          <p className="screen-sub">Pick up to three habits. You can change these later.</p>
          <div className="onboarding-chips">
            {ACTIVITY_TEMPLATES.map((template) => {
              const selected = draft.activities.some((item) => item.templateId === template.id)
              const full = draft.activities.length >= 3 && !selected
              return (
                <button
                  key={template.id}
                  type="button"
                  className={`onboarding-chip ${selected ? 'onboarding-chip-selected' : ''}`}
                  disabled={full}
                  onClick={() => toggleTemplate(template.id)}
                >
                  {template.emoji} {template.label}
                </button>
              )
            })}
            <button
              type="button"
              className={`onboarding-chip ${customOpen ? 'onboarding-chip-selected' : ''}`}
              onClick={() => setCustomOpen(true)}
              disabled={draft.activities.length >= 3}
            >
              Something else…
            </button>
          </div>
          {customOpen && (
            <label className="field">
              <span className="field-label">Name</span>
              <input
                className="field-input"
                maxLength={GUEST_NAME_MAX}
                value={customName}
                onChange={(event) => setCustomName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addCustom()
                  }
                }}
              />
              <button type="button" className="btn btn-secondary" onClick={addCustom}>
                Add
              </button>
            </label>
          )}
          <button
            type="button"
            className="btn btn-primary"
            disabled={draft.activities.length === 0}
            onClick={() =>
              finishStep(
                1,
                choiceCode(draft.activities.map((item) => item.templateId ?? 'custom')),
                setGuestStep(draft, 2),
              )
            }
          >
            {continueLabel(draft.activities.length)}
          </button>
        </>
      )}

      {draft.step === 2 && gapActivity && (
        <>
          <h1 className="screen-heading">{gapHeading(gapActivity)}</h1>
          <p className="screen-sub">
            {gapActivity.emoji} {gapActivity.name}
          </p>
          {gapNote(gapActivity) && <p className="screen-sub">{gapNote(gapActivity)}</p>}
          <div className="onboarding-chips">
            {gapOptionsFor(gapActivity).map((option) => {
              const saved = draft.gapAnswer[gapActivity.localId]
              const selected = isWaterHabit(gapActivity)
                ? saved === option.id || (saved == null && 'glasses' in option && option.glasses === gapActivity.targetValue)
                : saved === option.id
              return (
              <button
                key={option.id}
                type="button"
                className={`onboarding-chip ${selected ? 'onboarding-chip-selected' : ''}`}
                onClick={() => pickGap(option.id)}
              >
                {option.label}
              </button>
              )
            })}
          </div>
          {reassurance && <p className="onboarding-hint">{reassurance}</p>}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => finishStep(2, 'skip', setGuestStep(draft, stepAfterGap(draft)))}
          >
            Skip
          </button>
        </>
      )}

      {draft.step === 3 && (
        <>
          <h1 className="screen-heading">Let's make it small enough to actually do.</h1>
          <p className="screen-sub">Small is the point. You can raise it any time.</p>
          {draft.activities.map((item) => {
            const control = activitySizeControl(item)
            if (!control) {
              if (isWaterHabit(item)) return null
              return (
                <fieldset key={item.localId} className="field">
                  <legend className="field-label">
                    {item.emoji} {item.name}
                  </legend>
                  <p className="screen-sub">Checking it off is enough.</p>
                </fieldset>
              )
            }
            const size = currentSize(item)
            return (
              <fieldset key={item.localId} className="field">
                <legend className="field-label">
                  {item.emoji} {item.name}
                </legend>
                <div className="onboarding-chips">
                  {control.steps.map((step) => (
                    <button
                      key={step}
                      type="button"
                      className={`onboarding-chip ${size === step ? 'onboarding-chip-selected' : ''}`}
                      onClick={() => setActivitySize(item.localId, step)}
                    >
                      {step}
                      {control.suffix}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setActivitySize(item.localId, smallestStep(control.steps))}
                >
                  That's still too big?
                </button>
              </fieldset>
            )
          })}
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => finishStep(3, 'sized', setGuestStep(draft, 4))}
          >
            Continue
          </button>
        </>
      )}

      {draft.step === 4 && (
        <>
          <h1 className="screen-heading">When does it usually slip?</h1>
          <p className="screen-sub">This helps Insights spot your pattern sooner.</p>
          <div className="onboarding-chips">
            {SLIP_OPTIONS.map((chip) => {
              const selected = draft.slipAnswer.includes(chip)
              const full = draft.slipAnswer.length >= 2 && !selected
              return (
                <button
                  key={chip}
                  type="button"
                  className={`onboarding-chip ${selected ? 'onboarding-chip-selected' : ''}`}
                  disabled={full}
                  onClick={() => persist(saveGuestDraft({ ...draft, slipAnswer: toggleSlip(draft.slipAnswer, chip) }))}
                >
                  {chip}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => finishStep(4, choiceCode(draft.slipAnswer), setGuestStep(draft, 5))}
          >
            Continue
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => finishStep(4, 'skip', setGuestStep(draft, 5))}>
            Skip
          </button>
        </>
      )}

      {draft.step === 5 && activity && (
        <>
          <h1 className="screen-heading">Want to start right now?</h1>
          <p className="screen-sub">Two minutes of {activity.name}. That's all this takes.</p>
          <button type="button" className="btn btn-primary" onClick={beginTimer}>
            Start 2 minutes
          </button>
          {draft.activities.length > 1 && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setFocus((index) => (index + 1) % draft.activities.length)}
            >
              Pick a different one
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={skipTimer}>
            I'll start later
          </button>
        </>
      )}

      {draft.step === 6 && (
        <>
          <h1 className="screen-heading">{celebrate.title}</h1>
          <p className="screen-sub">{celebrate.body}</p>
          <p className="onboarding-hint">{INSIGHTS_PREVIEW}</p>
          <button type="button" className="btn btn-primary" onClick={() => finishStep(6, 'seen', setGuestStep(draft, 7))}>
            Continue
          </button>
        </>
      )}

      {draft.step === 7 && (
        <>
          <h1 className="screen-heading">One quiet nudge a day?</h1>
          <p className="screen-sub">We'll only ping if something's still open. Nothing if you're done.</p>
          <p className="onboarding-hint">Suggested time {defaultReminderTime(draft.slipAnswer)}</p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              const time = defaultReminderTime(draft.slipAnswer)
              track('onboarding_reminder_set', { time })
              finishStep(7, time, setGuestStep(saveGuestDraft({ ...draft, reminderTime: time, reminderDeclined: false }), 8))
            }}
          >
            Yes, remind me
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              track('onboarding_reminder_set', { time: 'none' })
              finishStep(
                7,
                'none',
                setGuestStep(saveGuestDraft({ ...draft, reminderTime: null, reminderDeclined: true }), 8),
              )
            }}
          >
            No thanks
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => finishStep(7, 'skip', setGuestStep(draft, 8))}>
            Skip
          </button>
        </>
      )}

      {draft.step === 8 && (
        <>
          <h1 className="screen-heading">Save what you just set up.</h1>
          <p className="screen-sub">{onboardingSummary(draft)}</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={googleBusy}
            onClick={() => {
              track('signin_method_clicked', { method: 'google' })
              setGoogleBusy(true)
              void onGoogle().finally(() => setGoogleBusy(false))
            }}
          >
            {AUTH_PROVIDERS[0].label}
          </button>
          <EmailSignInForm onClick={() => track('signin_method_clicked', { method: 'email' })} />
          <button type="button" className="btn btn-ghost" disabled>
            {AUTH_PROVIDERS[2].label}
          </button>
          <p className="screen-sub">Coming later.</p>
          <p className="onboarding-hint">Free. No ads. Your data stays yours.</p>
          <button type="button" className="btn btn-ghost" onClick={() => navigate('/today')}>
            Not now
          </button>
        </>
      )}
    </div>
  )
}
