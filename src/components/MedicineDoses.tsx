import { formatClock, mealMessageKey } from '../lib/medicineFormat'
import { useLocale } from '../hooks/useLocale'
import { isDoseFinished, type DueDose } from '../lib/medicineSchedule'
import { MedicineThumb } from './MedicineThumb'

/** One dose of one medicine on Today. A medicine taken three times a day shows three of these. */
export function MedicineDoseRow({
  dose,
  busy,
  onToggle,
}: {
  dose: DueDose
  busy: boolean
  onToggle: (dose: DueDose) => void
}) {
  const { locale, t } = useLocale()
  const finished = isDoseFinished(dose)
  const mealKey = mealMessageKey(dose.meal)
  const when = `${formatClock(dose, locale)}${mealKey ? ` · ${t(mealKey)}` : ''}`

  return (
    <li
      className={`today-row today-row-stack today-row-compact item-kind-medicine ${finished ? 'today-row-done' : ''}`.trim()}
    >
      <div className="today-row-head">
        <MedicineThumb photo={dose.photoUrl} system={dose.system ?? null} className="medicine-card-photo" />
        <span className={`activity-name ${finished ? 'reminder-struck' : ''}`.trim()}>{dose.name}</span>
      </div>
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-desc">
            {when}
            {dose.skipped ? ` · ${t('medicines.skipped')}` : ''}
          </span>
        </span>
        <span className="today-actions">
          <button
            type="button"
            className={`btn btn-today ${finished ? 'btn-secondary' : 'btn-primary'}`}
            disabled={busy}
            onClick={() => onToggle(dose)}
          >
            {finished ? t('medicines.notTaken') : t('medicines.markTaken')}
          </button>
        </span>
      </div>
    </li>
  )
}
