import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HabitMark } from './HabitMark'
import { MedicineThumb } from './MedicineThumb'
import { MEDICINES_ENABLED } from '../config'
import { useLocale } from '../hooks/useLocale'
import { groupTitle, visibleName } from '../lib/catalogName'
import { groupByHabitGroup } from '../data/activityTemplates'
import { habitTemplateId } from '../data/habitArt'
import { formatClock, mealMessageKey, systemMessageKey, weekdayShort } from '../lib/medicineFormat'
import {
  GUEST_MAX_MEDICINES,
  loadGuestDraft,
  removeGuestMedicine,
  saveGuestDraft,
  type GuestActivity,
  type GuestDraft,
  type GuestMedicine,
} from '../lib/guestDraft'
import { VITAL_GOAL_IDS, isGuestVital, standardVitalTarget } from '../lib/onboardingFlow'
import { Icon, type IconName } from './Icon'
import { GuestSaveWidget } from './GuestSaveWidget'

function useGuestDraft(): [GuestDraft | null, (next: GuestDraft) => void] {
  const [draft, setDraft] = useState<GuestDraft | null>(() => loadGuestDraft())
  useEffect(() => {
    const refresh = () => setDraft(loadGuestDraft())
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [])
  return [draft, (next) => setDraft(saveGuestDraft(next))]
}

function guestDetail(activity: GuestActivity, t: ReturnType<typeof useLocale>['t']): string {
  const standard = standardVitalTarget(activity.templateId)
  if (standard) return t(standard)
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
  kind,
  items,
  onAdd,
}: {
  title: string
  sub: string
  empty: string
  emptyIcon: IconName
  addLabel: string
  kind: 'activity' | 'vital'
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
        <div className="activity-groups">
          {(kind === 'activity'
            ? groupByHabitGroup(items, (activity) => habitTemplateId(activity))
            : [{ title: '', items }]
          ).map(({ title: groupName, items: list }) => (
            <section key={groupName || 'all'} className="activity-group">
              {groupName ? <h3 className="today-period-title">{groupTitle(groupName, locale)}</h3> : null}
              <ul className="activity-list">
                {list.map((activity) => {
                  const detail = guestDetail(activity, t)
                  return (
                    <li key={activity.localId}>
                      <div className={`activity-row item-kind-${kind}`}>
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
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

export function GuestActivitiesPage() {
  const { t } = useLocale()
  const navigate = useNavigate()
  const [draft] = useGuestDraft()
  const habits = (draft?.activities ?? []).filter(
    (activity) => !isGuestVital(activity) && !VITAL_GOAL_IDS.has(activity.templateId ?? ''),
  )
  return (
    <>
      {draft && <GuestSaveWidget draft={draft} />}
      <ItemList
        title={t('nav.abhyas')}
        sub={t('list.activitySub')}
        empty={t('list.activityEmpty')}
        emptyIcon="activities"
        addLabel={t('list.addHabit')}
        kind="activity"
        items={habits}
        onAdd={() => navigate('/start?step=1&add=1')}
      />
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
  const [draft, updateDraft] = useGuestDraft()
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const vitals = (draft?.activities ?? []).filter(
    (activity) => isGuestVital(activity) || VITAL_GOAL_IDS.has(activity.templateId ?? ''),
  )
  const medicines = draft?.medicines ?? []

  function addMedicine() {
    const current = loadGuestDraft()
    if (!current || current.medicines.length >= GUEST_MAX_MEDICINES) return
    saveGuestDraft({ ...current, medicineDaily: true })
    navigate('/start?step=1&medicine=1')
  }

  return (
    <>
      {draft && <GuestSaveWidget draft={draft} />}
      <ItemList
        title={t('nav.vitals')}
        sub={t('list.vitalSub')}
        empty={t('list.vitalEmpty')}
        emptyIcon="metrics"
        addLabel={t('list.addVital')}
        kind="vital"
        items={vitals}
        onAdd={() => navigate('/start?step=1&add=1&vital=1')}
      />
      {MEDICINES_ENABLED && (
        <section className="medicine-section">
          <div className="screen-heading">
            <div>
              <h2>{t('medicines.title')}</h2>
              <p className="screen-sub">{t('medicines.sub')}</p>
            </div>
            {medicines.length < GUEST_MAX_MEDICINES && (
              <button
                type="button"
                className="btn btn-primary btn-compact"
                aria-label={t('medicines.add')}
                onClick={addMedicine}
              >
                {t('list.add')}
              </button>
            )}
          </div>
          {medicines.length === 0 ? (
            <p className="medicine-empty">{t('medicines.empty')}</p>
          ) : (
            <ul className="activity-list">
              {medicines.map((medicine, index) => (
                <li key={`${medicine.name}-${index}`}>
                  <div className="activity-row item-kind-medicine">
                    <MedicineThumb photo={medicine.photo} system={medicine.system} />
                    <span className="activity-meta">
                      <span className="activity-name">{medicine.name}</span>
                      <span className="activity-desc">{medicineLine(medicine, locale, t)}</span>
                    </span>
                    {confirmDelete !== index && (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setConfirmDelete(index)}
                      >
                        {t('medicines.delete')}
                      </button>
                    )}
                  </div>
                  {confirmDelete === index && (
                    <div className="medicine-delete">
                      <button type="button" className="btn btn-secondary" onClick={() => setConfirmDelete(null)}>
                        {t('medicines.keep')}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={() => {
                          const current = loadGuestDraft()
                          if (current) updateDraft(removeGuestMedicine(current, index))
                          setConfirmDelete(null)
                        }}
                      >
                        {t('medicines.deleteForever')}
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </>
  )
}
