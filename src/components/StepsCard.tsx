import { Capacitor } from '@capacitor/core'
import { useEffect, useId, useState, type FormEvent } from 'react'
import { habitArtFor } from '../data/habitArt'
import { useLocale } from '../hooks/useLocale'
import { useThemedArt } from '../hooks/useThemedArt'
import { todayLocalDate } from '../lib/dates'
import { readPhoneSteps, requestPhoneSteps, showAppleZeroStepsHint, type PhoneSteps } from '../lib/healthSteps'
import { formatStepCount, loadTypedSteps, parseStepAmount, saveTypedSteps } from '../lib/steps'
import { StepsWeek } from './StepsWeek'
import { TaggedName } from './TodayKindTag'
import { TodayPop } from './TodayPop'

type PhoneState = PhoneSteps['status'] | 'unknown'

/** Today's step count from Health Connect, next to the goal chosen in setup. */
export function StepsCard({
  goal,
  today = todayLocalDate(),
}: {
  goal: number
  today?: string
}) {
  const { t, locale } = useLocale()
  const themed = useThemedArt()
  const fieldId = useId()
  const [phoneSteps, setPhoneSteps] = useState<number | null>(null)
  const [phoneState, setPhoneState] = useState<PhoneState>('unknown')
  const [asking, setAsking] = useState(false)
  const [weekOpen, setWeekOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [typed, setTyped] = useState<number | null>(() => loadTypedSteps(today))
  const [draft, setDraft] = useState('')
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    void readPhoneSteps().then((result) => {
      if (cancelled) return
      applyPhone(result)
    })
    return () => {
      cancelled = true
    }
  }, [today])

  useEffect(() => {
    setTyped(loadTypedSteps(today))
    setDraft('')
  }, [today])

  function saveTyped(event: FormEvent) {
    event.preventDefault()
    const amount = parseStepAmount(draft)
    if (amount == null) return
    saveTypedSteps(today, amount)
    setTyped(amount)
    setDraft('')
    setLogOpen(false)
    setRevision((value) => value + 1)
  }

  function applyPhone(result: PhoneSteps) {
    if (result.status === 'count') {
      setPhoneSteps(result.steps)
      setPhoneState('count')
      return
    }
    setPhoneSteps(null)
    setPhoneState(result.status)
  }

  async function connect() {
    setAsking(true)
    try {
      applyPhone(await requestPhoneSteps())
    } finally {
      setAsking(false)
    }
  }

  const fromPhone = phoneState === 'count' && phoneSteps != null
  const onWebsite = phoneState === 'unavailable'
  const shown = fromPhone ? phoneSteps : typed
  const countLabel = shown == null ? '—' : formatStepCount(shown, locale)
  const showPhoneButton = phoneState === 'needs-permission' || phoneState === 'denied'
  const canOpen = fromPhone || onWebsite
  const art = habitArtFor({ templateId: 'steps' })

  return (
    <li className="today-row today-row-stack today-row-compact item-kind-activity">
      <div className="today-row-head">
        {art ? <img className="steps-card-art" src={themed(art)} alt="" /> : null}
        <TaggedName kind="habit">{t('today.steps')}</TaggedName>
      </div>
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-desc">
            {shown == null
              ? t('today.goalSteps', { goal: formatStepCount(goal, locale) })
              : t('today.stepsToday', {
                  value: countLabel,
                  goal: formatStepCount(goal, locale),
                })}
          </span>
          {onWebsite && typed == null && !weekOpen && (
            <span className="activity-desc">{t('today.stepsFromPhone')}</span>
          )}
          {fromPhone && !weekOpen && showAppleZeroStepsHint(Capacitor.getPlatform(), phoneSteps) && (
            <span className="activity-desc">{t('today.stepsNone')}</span>
          )}
        </span>
        {onWebsite && (
          <span className="today-actions">
            <button type="button" className="btn btn-primary btn-today" onClick={() => setLogOpen(true)}>
              {typed == null ? t('today.log') : t('today.update')}
            </button>
          </span>
        )}
        {showPhoneButton && (
          <span className="today-actions">
            <button
              type="button"
              className="btn btn-secondary btn-today"
              disabled={asking}
              onClick={() => void connect()}
            >
              {t('today.stepsPhone')}
            </button>
          </span>
        )}
      </div>
      {canOpen && (
        <div className="today-extra">
          <button
            type="button"
            className="today-extra-btn"
            aria-expanded={weekOpen}
            onClick={() => setWeekOpen((open) => !open)}
          >
            {t('today.stepsWeek')}
          </button>
        </div>
      )}
      {canOpen && weekOpen && (
        <StepsWeek goal={goal} heading={false} typed={onWebsite} revision={revision} />
      )}
      {logOpen && (
        <TodayPop title={t('today.stepsType')} onClose={() => setLogOpen(false)}>
          <form className="today-pop-form" onSubmit={saveTyped}>
            <input
              id={fieldId}
              className="field-input"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              aria-label={t('today.stepsType')}
              enterKeyHint="done"
            />
            <div className="today-pop-actions">
              <button type="submit" className="btn btn-primary" disabled={parseStepAmount(draft) == null}>
                {t('today.stepsSave')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => setLogOpen(false)}>
                {t('today.cancel')}
              </button>
            </div>
          </form>
        </TodayPop>
      )}
    </li>
  )
}
