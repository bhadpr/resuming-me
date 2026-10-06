import { useLocale } from '../hooks/useLocale'
import { DAY_PERIODS, type DayPeriod } from '../lib/dayPeriod'

/** Which part of Today an activity or vital shows in. */
export function DayPeriodPicker({ value, onChange }: { value: DayPeriod; onChange: (period: DayPeriod) => void }) {
  const { t } = useLocale()
  return (
    <fieldset className="field">
      <legend className="field-label">{t('today.when')}</legend>
      <div className="onboarding-chips">
        {DAY_PERIODS.map((period) => (
          <button
            key={period}
            type="button"
            className={`onboarding-chip ${value === period ? 'onboarding-chip-selected' : ''}`}
            aria-pressed={value === period}
            onClick={() => onChange(period)}
          >
            {t(`today.${period}`)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}
