import { useState } from 'react'
import type { Activity } from '../lib/activities'
import { tinyStartLine, tinyTimerMinutes, welcomeBackLine } from '../lib/comeback'
import type { ActivityTodayProgress } from '../lib/today'
import { track } from '../lib/track'
import { visibleName } from '../lib/catalogName'
import { t } from '../lib/i18n'
import { useLocale } from '../hooks/useLocale'

export type WelcomeBackModel = {
  gapDays: number
  suggestion: Activity
  alternatives: Activity[]
  why: string | null
  freshStart: { allowed: boolean; line: string | null }
}

export function WelcomeBackCard({
  model,
  busyId,
  rows,
  onStart,
  onDismiss,
  onFreshStart,
}: {
  model: WelcomeBackModel
  busyId: string | null
  rows: ActivityTodayProgress[]
  onStart: (row: ActivityTodayProgress, minutes: number | null) => void
  onDismiss: () => void
  onFreshStart: () => void
}) {
  const { locale } = useLocale()
  const [pickerOpen, setPickerOpen] = useState(false)
  const [freshNote, setFreshNote] = useState<string | null>(null)
  const rowFor = (activity: Activity) => rows.find((row) => row.activity.id === activity.id) ?? null

  function start(activity: Activity) {
    const row = rowFor(activity)
    if (!row) return
    track('welcome_back_started', { activity_type: activity.type })
    onStart(row, tinyTimerMinutes(activity))
  }

  const startMinutes = tinyTimerMinutes(model.suggestion) ?? 2
  const startLabel = t(startMinutes === 1 ? 'welcome.buttonMinute' : 'welcome.buttonMinutes', {
    minutes: startMinutes,
  })

  return (
    <div className="today-welcome">
      <p className="today-empty-title">{welcomeBackLine(model.gapDays)}</p>
      <p className="today-empty-copy">{tinyStartLine(model.suggestion)}</p>
      {model.why && <p className="onboarding-hint">“{model.why}”</p>}
      {pickerOpen ? (
        <div className="onboarding-chips">
          {model.alternatives.map((activity) => (
            <button
              key={activity.id}
              type="button"
              className="onboarding-chip"
              disabled={busyId === activity.id}
              onClick={() => start(activity)}
            >
              {activity.emoji} {visibleName(activity, locale)}
            </button>
          ))}
        </div>
      ) : (
        <div className="today-welcome-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busyId === model.suggestion.id || !rowFor(model.suggestion)}
            onClick={() => start(model.suggestion)}
          >
            {startLabel}
          </button>
          {model.alternatives.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={() => setPickerOpen(true)}>
              {t('welcome.else')}
            </button>
          )}
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              track('welcome_back_dismissed')
              onDismiss()
            }}
          >
            {t('welcome.looking')}
          </button>
        </div>
      )}
      {model.gapDays >= 7 && (
        <div className="today-welcome-actions">
          <p className="onboarding-hint">{t('welcome.freshHint')}</p>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (!model.freshStart.allowed) {
                setFreshNote(model.freshStart.line)
                return
              }
              track('fresh_start_used', { gap_days: model.gapDays })
              onFreshStart()
            }}
          >
            {t('welcome.fresh')}
          </button>
          {(freshNote || (!model.freshStart.allowed && model.freshStart.line)) && (
            <p className="onboarding-hint">{freshNote ?? model.freshStart.line}</p>
          )}
        </div>
      )}
    </div>
  )
}
