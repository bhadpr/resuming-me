import { formatClock, mealMessageKey } from '../lib/medicineFormat'
import { useLocale } from '../hooks/useLocale'
import { isDoseFinished, type DueDose } from '../lib/medicineSchedule'
import { MedicineThumb } from './MedicineThumb'
import { SkipLink, UndoSkipButton } from './TodaySkip'

/** One dose of one medicine on Today. A medicine taken three times a day shows three of these. */
export function MedicineDoseRow({
  dose,
  busy,
  onToggle,
  onSkip,
}: {
  dose: DueDose
  busy: boolean
  /** Marks the dose taken, or clears a taken or skipped dose. */
  onToggle: (dose: DueDose) => void
  onSkip: (dose: DueDose) => void
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
        <span className="today-actions today-actions-stack">
          {dose.skipped ? (
            <UndoSkipButton disabled={busy} onUndo={() => onToggle(dose)} />
          ) : (
            <button
              type="button"
              className={`btn btn-today ${finished ? 'btn-secondary' : 'btn-primary'}`}
              disabled={busy}
              onClick={() => onToggle(dose)}
            >
              {finished ? t('medicines.notTaken') : t('medicines.markTaken')}
            </button>
          )}
          {!finished && <SkipLink disabled={busy} onSkip={() => onSkip(dose)} />}
        </span>
      </div>
    </li>
  )
}
