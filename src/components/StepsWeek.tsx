import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import { parseLocalDate, todayLocalDate } from '../lib/dates'
import {
  readPhoneStepsWeek,
  requestPhoneSteps,
  showAppleZeroWeekHint,
  summarizeStepWeek,
  type PhoneStepsWeek,
} from '../lib/healthSteps'
import { localeTag } from '../lib/i18n'
import { formatStepCount } from '../lib/steps'

/** Daily step totals from Health Connect against the goal. */
export function StepsWeek({
  goal,
  heading = true,
  days = 7,
}: {
  goal: number
  heading?: boolean
  days?: number
}) {
  const { t, locale } = useLocale()
  const [week, setWeek] = useState<PhoneStepsWeek | null>(null)
  const [asking, setAsking] = useState(false)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    void readPhoneStepsWeek(new Date(), days).then((next) => {
      if (!cancelled) setWeek(next)
    })
    const onVisible = () => {
      if (document.visibilityState === 'visible') setTick((n) => n + 1)
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tick, days])

  async function connect() {
    setAsking(true)
    try {
      await requestPhoneSteps()
      setTick((n) => n + 1)
    } finally {
      setAsking(false)
    }
  }

  if (!week) return null

  const title = heading ? <h3 className="section-label">{t('today.stepsWeek')}</h3> : null

  if (week.status !== 'days') {
    return (
      <section className="steps-week">
        {title}
        {week.status === 'needs-permission' || week.status === 'denied' ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={asking}
            onClick={() => void connect()}
          >
            {t('today.stepsPhone')}
          </button>
        ) : (
          <p className="activity-desc">{t('today.stepsFromPhone')}</p>
        )}
      </section>
    )
  }

  const today = todayLocalDate()
  const summary = summarizeStepWeek(week.days, goal, today)
  const scale = Math.max(goal, summary.best, 1) * 1.08
  const goalPct = (goal / scale) * 100
  const tag = localeTag(locale)
  const compact = new Intl.NumberFormat(tag, { notation: 'compact', maximumFractionDigits: 1 })
  const weekday = new Intl.DateTimeFormat(tag, { weekday: 'short' })

  return (
    <section className="steps-week">
      {title}
      <div
        className={`steps-week-chart${week.days.length > 7 ? ' steps-week-long' : ''}`}
        style={{ gridTemplateColumns: `repeat(${week.days.length}, minmax(0, 1fr))` }}
      >
        {week.days.map((day) => {
          const met = day.steps >= goal
          const parsed = parseLocalDate(day.date)
          const axis = week.days.length > 7 ? String(parsed.getDate()) : weekday.format(parsed)
          return (
            <div
              key={day.date}
              className={`steps-week-day ${day.date === today ? 'steps-week-today' : ''}`}
              aria-label={`${weekday.format(parsed)}: ${formatStepCount(day.steps, locale)}`}
            >
              <span className="steps-week-value">{day.steps > 0 ? compact.format(day.steps) : ''}</span>
              <span className="steps-week-track">
                <span className="steps-week-goal" style={{ bottom: `${goalPct}%` }} aria-hidden />
                <span
                  className={`steps-week-bar ${met ? 'steps-week-bar-met' : ''}`}
                  style={{ height: `${Math.min(100, (day.steps / scale) * 100)}%` }}
                />
              </span>
              <span className="steps-week-label">{axis}</span>
            </div>
          )
        })}
      </div>
      <p className="activity-desc steps-week-summary">
        {t('today.stepsWeekMet', { met: String(summary.metDays), days: String(week.days.length) })}
        {summary.average > 0 && (
          <> · {t('today.stepsWeekAverage', { value: formatStepCount(summary.average, locale) })}</>
        )}
      </p>
      {showAppleZeroWeekHint(Capacitor.getPlatform(), week.days) && (
        <p className="activity-desc">{t('today.stepsNone')}</p>
      )}
    </section>
  )
}
