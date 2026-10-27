import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import type { CommunityReminder } from '../lib/communityReminders'
import { navigateBack } from '../lib/navigation'
import { communityRegion } from '../lib/schoolZip'
import { INDIA_HOLIDAY_LIST_ID, US_HOLIDAY_LIST_ID, type SharedList } from '../lib/sharedLists'
import { CalendarImportDetail, CalendarImportSection, NflImportSection } from './CalendarImports'
import { HolidayCatalog } from './HolidayCatalog'
import { Icon } from './Icon'

/** Holiday lists, or school and sports schedules, on their own page. */
export function CommunityRemindersPage({
  today,
  section,
}: {
  today: string
  section: 'holidays' | 'schedules'
  addedIds: readonly string[]
  onAdd: (item: CommunityReminder) => Promise<'ok' | 'full'>
}) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const [opened, setOpened] = useState<SharedList | null>(null)
  const region = communityRegion()

  return (
    <div className="activity-list-screen">
      <button
        type="button"
        className="btn btn-ghost btn-sm back-btn"
        onClick={() => {
          if (opened) {
            setOpened(null)
            return
          }
          navigateBack(navigate, '/reminders')
        }}
      >
        <Icon name="back" />
        {t('reminders.back')}
      </button>
      <div className="screen-heading">
        <div>
          <h2>{opened ? opened.title : t(section === 'schedules' ? 'reminders.community.schedulesTitle' : 'reminders.community.holidaysTitle')}</h2>
          {!opened && (
            <p className="screen-sub">
              {t(section === 'schedules' ? 'reminders.community.schedulesSub' : 'reminders.community.sub')}
            </p>
          )}
        </div>
      </div>
      {opened ? (
        <CalendarImportDetail list={opened} />
      ) : section === 'schedules' ? (
        region === 'us' ? (
          <>
            <CalendarImportSection title={t('reminders.community.usSchool')} onOpen={setOpened} />
            <NflImportSection title={t('reminders.community.nfl')} onOpen={setOpened} />
          </>
        ) : (
          <section className="empty-state">
            <p>{t('reminders.community.schedulesEmpty')}</p>
          </section>
        )
      ) : (
        <>
          {region === 'us' && (
            <HolidayCatalog title={t('reminders.community.usHolidays2026')} listId={US_HOLIDAY_LIST_ID} today={today} />
          )}
          <HolidayCatalog title={t('reminders.community.inHolidays2026')} listId={INDIA_HOLIDAY_LIST_ID} today={today} />
        </>
      )}
    </div>
  )
}
