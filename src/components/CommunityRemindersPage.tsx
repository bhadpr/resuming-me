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

/** Community days on their own page. Holiday catalogs follow their list. */
export function CommunityRemindersPage({
  today,
}: {
  today: string
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
          <h2>{opened ? opened.title : t('reminders.community.title')}</h2>
          {!opened && <p className="screen-sub">{t('reminders.community.sub')}</p>}
        </div>
      </div>
      {opened ? (
        <CalendarImportDetail list={opened} />
      ) : (
        <>
          {region === 'us' && (
            <>
              <HolidayCatalog title={t('reminders.community.usHolidays2026')} listId={US_HOLIDAY_LIST_ID} today={today} />
              <CalendarImportSection title={t('reminders.community.usSchool')} onOpen={setOpened} />
              <NflImportSection title={t('reminders.community.nfl')} onOpen={setOpened} />
            </>
          )}
          <HolidayCatalog title={t('reminders.community.inHolidays2026')} listId={INDIA_HOLIDAY_LIST_ID} today={today} />
        </>
      )}
    </div>
  )
}
