import { useEffect, useState } from 'react'
import { habitArtFor } from '../data/habitArt'
import { useLocale } from '../hooks/useLocale'
import { useThemedArt } from '../hooks/useThemedArt'
import { todayLocalDate } from '../lib/dates'
import { readPhoneSteps, requestPhoneSteps, type PhoneSteps } from '../lib/healthSteps'
import { formatStepCount } from '../lib/steps'

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
  const [phoneSteps, setPhoneSteps] = useState<number | null>(null)
  const [phoneState, setPhoneState] = useState<PhoneState>('unknown')
  const [asking, setAsking] = useState(false)

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
  const countLabel = fromPhone ? formatStepCount(phoneSteps, locale) : '—'
  const showPhoneButton = phoneState === 'needs-permission' || phoneState === 'denied'
  const art = habitArtFor({ templateId: 'steps' })

  return (
    <li className="today-row today-row-stack today-row-compact today-kind-activity">
      <div className="today-row-head">
        {art ? <img className="steps-card-art" src={themed(art)} alt="" /> : null}
        <span className="activity-name">{t('today.steps')}</span>
      </div>
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-desc">
            {fromPhone
              ? t('today.stepsToday', {
                  value: countLabel,
                  goal: formatStepCount(goal, locale),
                })
              : t('today.goalSteps', { goal: formatStepCount(goal, locale) })}
          </span>
          {phoneState === 'unavailable' && (
            <span className="activity-desc">{t('today.stepsFromPhone')}</span>
          )}
        </span>
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
    </li>
  )
}
