import { useState } from 'react'
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

function isFinished(dose: DueDose): boolean {
  return dose.taken || dose.skipped === true
}

/** Today's open doses by medicine, then the taken or skipped ones folded into one line. */
export function MedicineDoses({ doses, busyKey, onToggle }: MedicineDosesProps) {
  const { locale, t } = useLocale()
  const [doneOpen, setDoneOpen] = useState(false)
  const cards = groupByMedicine(doses.filter((dose) => !isFinished(dose)))
  const finished = doses.filter(isFinished)

  const when = (dose: DueDose) =>
    `${formatClock(dose, locale)}${mealMessageKey(dose.meal) ? ` · ${t(mealMessageKey(dose.meal)!)}` : ''}`

  return (
    <section className="today-section" aria-label={t('today.logMedicines')}>
      <h3 className="section-label">{t('today.logMedicines')}</h3>
      {doses.length === 0 && <p className="medicine-empty">{t('today.logMedicinesEmpty')}</p>}
      {cards.length > 0 && (
        <ul className="today-list">
          {cards.map((card) => {
            const single = card.doses.length === 1 ? card.doses[0] : null
            return (
              <li key={card.medicineId} className="today-row today-row-stack">
                <div className="today-row-main">
                  <MedicineThumb photo={card.photoUrl} system={card.system} className="medicine-card-photo" />
                  <span className="activity-meta">
                    <span className="activity-name">{card.name}</span>
                    {single && <span className="activity-desc">{when(single)}</span>}
                  </span>
                  {single && (
                    <span className="today-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-today"
                        disabled={busyKey === single.key}
                        onClick={() => onToggle(single)}
                      >
                        {t('medicines.markTaken')}
                      </button>
                    </span>
                  )}
                </div>
                {!single && (
                  <ol className="medicine-slot-list">
                    {card.doses.map((dose) => (
                      <li key={dose.key} className="medicine-slot">
                        <span className="medicine-slot-time">{when(dose)}</span>
                        <button
                          type="button"
                          className="btn btn-primary medicine-slot-btn"
                          disabled={busyKey === dose.key}
                          onClick={() => onToggle(dose)}
                        >
                          {t('medicines.markTaken')}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </li>
            )
          })}
        </ul>
      )}
      {finished.length > 0 && (
        <div className="reminder-done-today">
          <button
            type="button"
            className="today-extra-btn"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((value) => !value)}
          >
            {t('medicines.takenToday', { count: finished.length })}
          </button>
          {doneOpen && (
            <ul className="today-list">
              {finished.map((dose) => (
                <li key={dose.key} className="today-row today-row-done">
                  <div className="today-row-main">
                    <span className="activity-meta">
                      <span className="activity-name reminder-struck">{dose.name}</span>
                      <span className="activity-desc">
                        {when(dose)}
                        {dose.skipped ? ` · ${t('medicines.skipped')}` : ''}
                      </span>
                    </span>
                    <span className="today-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-today"
                        disabled={busyKey === dose.key}
                        onClick={() => onToggle(dose)}
                      >
                        {t('medicines.notTaken')}
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}
