import { formatClock, mealMessageKey, systemMessageKey, weekdayShort } from '../lib/medicineFormat'
import { MedicineThumb } from './MedicineThumb'
import { useLocale } from '../hooks/useLocale'
import type { MedicineRecord } from '../lib/medicines'
import { Icon } from './Icon'

interface MedicineSectionProps {
  medicines: MedicineRecord[]
  loading: boolean
  error: string | null
  onAdd: () => void
  onOpen: (medicine: MedicineRecord) => void
}

export function MedicineSection({ medicines, loading, error, onAdd, onOpen }: MedicineSectionProps) {
  const { locale, t } = useLocale()

  return (
    <section className="medicine-section">
      <div className="screen-heading">
        <div>
          <h2>{t('medicines.title')}</h2>
          <p className="screen-sub">{t('medicines.sub')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          {t('medicines.add')}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">{t('medicines.loading')}</p>
      ) : medicines.length === 0 ? (
        <p className="medicine-empty">{t('medicines.empty')}</p>
      ) : (
        <ul className="activity-list">
          {medicines.map((medicine) => {
            const kindKey = systemMessageKey(medicine.system)
            const days =
              medicine.weekdays.length === 7
                ? t('medicines.everyDay')
                : medicine.weekdays.map((day) => weekdayShort(day, locale)).join(', ')
            const times = medicine.times
              .map((time) => {
                const key = mealMessageKey(time.meal)
                const clock = formatClock(time, locale)
                return key ? `${clock} · ${t(key)}` : clock
              })
              .join(', ')
            return (
              <li key={medicine.id}>
                <button type="button" className="activity-row" onClick={() => onOpen(medicine)}>
                  <MedicineThumb photo={medicine.photoUrl} system={medicine.system} />
                  <span className="activity-meta">
                    <span className="activity-name">{medicine.name}</span>
                    <span className="activity-desc">
                      {kindKey ? `${t(kindKey)} · ` : ''}
                      {days} · {times}
                    </span>
                  </span>
                  <span className="activity-chevron" aria-hidden>
                    <Icon name="chevron" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
