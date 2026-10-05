import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HabitMark } from './HabitMark'
import { MedicineThumb } from './MedicineThumb'
import { useLocale } from '../hooks/useLocale'
import { visibleName } from '../lib/catalogName'
import { formatClock, mealMessageKey, systemMessageKey, weekdayShort } from '../lib/medicineFormat'
import {
  GUEST_MAX_MEDICINES,
  loadGuestDraft,
  saveGuestDraft,
  type GuestActivity,
  type GuestDraft,
  type GuestMedicine,
} from '../lib/guestDraft'
import { isLoggedVital, isNumberEntryVital, isStepsHabit } from '../lib/onboardingFlow'
import { Icon, type IconName } from './Icon'
import { GuestComingUp } from './GuestReminders'

function useGuestDraft(): GuestDraft | null {
  const [draft, setDraft] = useState<GuestDraft | null>(() => loadGuestDraft())
  useEffect(() => {
    const refresh = () => setDraft(loadGuestDraft())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  return draft
}

function isGuestVital(activity: GuestActivity): boolean {
  return isNumberEntryVital(activity) || isLoggedVital(activity) || isStepsHabit(activity)
}

function guestDetail(activity: GuestActivity): string {
  if (activity.type === 'deadline' && activity.deadline) return activity.deadline
  if (activity.type === 'weekly_n' && activity.weeklyTarget) return `${activity.weeklyTarget}× / week`
  if (activity.targetValue == null) return ''
  return activity.targetUnit ? `${activity.targetValue} ${activity.targetUnit}` : String(activity.targetValue)
}

function ItemList({
  title,
  sub,
  empty,
  emptyIcon,
  addLabel,
  items,
  onAdd,
}: {
  title: string
  sub: string
  empty: string
  emptyIcon: IconName
  addLabel: string
  items: GuestActivity[]
  onAdd: () => void
}) {
  const { locale, t } = useLocale()
  return (
    <div className="activity-list-screen">
      <div className="screen-heading">
        <div>
          <h2>{title}</h2>
          <p className="screen-sub">{sub}</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          {t('list.add')}
        </button>
      </div>
      {items.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon"><Icon name={emptyIcon} size={24} /></span>
          <h2>{t('list.empty')}</h2>
          <p>{empty}</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            {addLabel}
          </button>
        </section>
      ) : (
        <ul className="activity-list">
          {items.map((activity) => {
            const detail = guestDetail(activity)
            return (
              <li key={activity.localId}>
                <div className="activity-row">
                  <HabitMark name={visibleName(activity, locale)} templateId={activity.templateId} />
                  <span className="activity-meta">
                    <span className="activity-name">{visibleName(activity, locale)}</span>
                    {detail ? <span className="activity-desc">{detail}</span> : null}
                  </span>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export function GuestActivitiesPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const draft = useGuestDraft()
  const habits = (draft?.activities ?? []).filter((activity) => !isGuestVital(activity))
  return (
    <>
      <ItemList
        title={t('nav.abhyas')}
        sub={t('list.activitySub')}
        empty={t('list.activityEmpty')}
        emptyIcon="activities"
        addLabel={t('list.addHabit')}
        items={habits}
        onAdd={() => navigate('/start?step=1&add=1')}
      />
      <GuestComingUp />
    </>
  )
}

function medicineLine(medicine: GuestMedicine, locale: ReturnType<typeof useLocale>['locale'], t: ReturnType<typeof useLocale>['t']): string {
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
  return `${kindKey ? `${t(kindKey)} · ` : ''}${days} · ${times}`
}

export function GuestVitalsPage() {
  const { locale, t } = useLocale()
  const navigate = useNavigate()
  const draft = useGuestDraft()
  const vitals = (draft?.activities ?? []).filter(isGuestVital)
  const medicines = draft?.medicines ?? []

  function addMedicine() {
    const current = loadGuestDraft()
    if (!current || current.medicines.length >= GUEST_MAX_MEDICINES) return
    saveGuestDraft({ ...current, medicineDaily: true })
    navigate('/start?step=1&medicine=1')
  }

  return (
    <>
      <ItemList
        title={t('nav.vitals')}
        sub={t('list.vitalSub')}
        empty={t('list.vitalEmpty')}
        emptyIcon="metrics"
        addLabel={t('list.addVital')}
        items={vitals}
        onAdd={() => navigate('/start?step=1&add=1')}
      />
      <section className="medicine-section">
        <div className="screen-heading">
          <div>
            <h2>{t('medicines.title')}</h2>
            <p className="screen-sub">{t('medicines.sub')}</p>
          </div>
          {medicines.length < GUEST_MAX_MEDICINES && (
            <button type="button" className="btn btn-primary btn-compact" onClick={addMedicine}>
              {t('medicines.add')}
            </button>
          )}
        </div>
        {medicines.length === 0 ? (
          <p className="medicine-empty">{t('medicines.empty')}</p>
        ) : (
          <ul className="activity-list">
            {medicines.map((medicine, index) => (
              <li key={`${medicine.name}-${index}`}>
                <div className="activity-row">
                  <MedicineThumb photo={medicine.photo} system={medicine.system} />
                  <span className="activity-meta">
                    <span className="activity-name">{medicine.name}</span>
                    <span className="activity-desc">{medicineLine(medicine, locale, t)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
