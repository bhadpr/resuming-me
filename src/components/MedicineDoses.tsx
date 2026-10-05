import { formatClock, mealMessageKey } from '../lib/medicineFormat'
import { useLocale } from '../hooks/useLocale'
import type { DueDose, MedicineSystem } from '../lib/medicineSchedule'
import { MedicineThumb } from './MedicineThumb'

interface MedicineDosesProps {
  doses: DueDose[]
  busyKey: string | null
  onToggle: (dose: DueDose) => void
}

interface MedicineTodayCard {
  medicineId: string
  name: string
  photoUrl: string | null
  system: MedicineSystem | null
  doses: DueDose[]
}

function groupByMedicine(doses: readonly DueDose[]): MedicineTodayCard[] {
  const cards: MedicineTodayCard[] = []
  const byId = new Map<string, MedicineTodayCard>()
  for (const dose of doses) {
    const existing = byId.get(dose.medicineId)
    if (existing) {
      existing.doses.push(dose)
      continue
    }
    const card = {
      medicineId: dose.medicineId,
      name: dose.name,
      photoUrl: dose.photoUrl,
      system: dose.system ?? null,
      doses: [dose],
    }
    byId.set(dose.medicineId, card)
    cards.push(card)
  }
  return cards
}

export function MedicineDoses({ doses, busyKey, onToggle }: MedicineDosesProps) {
  const { locale, t } = useLocale()
  const cards = groupByMedicine(doses)

  return (
    <section className="today-section" aria-label={t('today.logMedicines')}>
      <h3 className="section-label">{t('today.logMedicines')}</h3>
      {cards.length === 0 ? (
        <p className="medicine-empty">{t('today.logMedicinesEmpty')}</p>
      ) : (
      <ul className="today-list">
        {cards.map((card) => {
          const allTaken = card.doses.every((dose) => dose.taken || dose.skipped)
          return (
            <li
              key={card.medicineId}
              className={`today-row today-row-stack ${allTaken ? 'today-row-done' : ''}`}
            >
              <div className="today-row-main">
                <MedicineThumb
                  photo={card.photoUrl}
                  system={card.system}
                  className="medicine-card-photo"
                />
                <span className="activity-name">{card.name}</span>
              </div>
              <ol className="medicine-slot-list">
                {card.doses.map((dose, index) => (
                  <li
                    key={dose.key}
                    className={dose.taken || dose.skipped ? 'medicine-slot medicine-slot-taken' : 'medicine-slot'}
                  >
                    <span className="medicine-slot-index">{index + 1},</span>
                    <span className="medicine-slot-time">
                      {formatClock(dose, locale)}
                      {mealMessageKey(dose.meal) ? ` · ${t(mealMessageKey(dose.meal)!)}` : ''}
                    </span>
                    <button
                      type="button"
                      className={`btn medicine-slot-btn ${dose.taken || dose.skipped ? 'btn-secondary' : 'btn-primary'}`}
                      aria-pressed={dose.taken || dose.skipped}
                      disabled={busyKey === dose.key}
                      onClick={() => onToggle(dose)}
                    >
                      {dose.skipped ? t('medicines.skipped') : dose.taken ? t('medicines.taken') : t('medicines.markTaken')}
                    </button>
                  </li>
                ))}
              </ol>
            </li>
          )
        })}
      </ul>
      )}
    </section>
  )
}
