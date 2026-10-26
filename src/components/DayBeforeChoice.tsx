import { useLocale } from '../hooks/useLocale'

/** The evening-before choice on a community list. Checked unless the person turns it off. */
export function DayBeforeChoice({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (value: boolean) => void
}) {
  const { t } = useLocale()
  return (
    <label className="reminder-switch community-day-before">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{t('reminders.community.dayBefore')}</span>
    </label>
  )
}
