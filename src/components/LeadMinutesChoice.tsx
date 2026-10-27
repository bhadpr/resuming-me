import { useId } from 'react'
import { useLocale } from '../hooks/useLocale'
import { REMIND_LEAD_MINUTES, type RemindLeadMinutes } from '../lib/reminderSchedule'

/** An extra ping before a clock time. Off until the person checks it, then 15 minutes. */
export function LeadMinutesChoice({
  minutes,
  onChange,
}: {
  minutes: RemindLeadMinutes | null
  onChange: (value: RemindLeadMinutes | null) => void
}) {
  const { t } = useLocale()
  const id = useId()
  const on = minutes != null
  return (
    <div className="reminder-switch lead-minutes">
      <input
        id={id}
        type="checkbox"
        checked={on}
        onChange={(event) => onChange(event.target.checked ? (minutes ?? 15) : null)}
      />
      <label htmlFor={id}>{t('reminders.leadBefore')}</label>
      <span className="lead-select">
        <select
          aria-label={t('reminders.leadChoice')}
          disabled={!on}
          value={minutes ?? 15}
          onChange={(event) => {
            const next = Number(event.target.value)
            onChange(next === 30 || next === 60 ? next : 15)
          }}
        >
          {REMIND_LEAD_MINUTES.map((choice) => (
            <option key={choice} value={choice}>
              {t('reminders.leadOption', { count: choice })}
            </option>
          ))}
        </select>
      </span>
    </div>
  )
}
