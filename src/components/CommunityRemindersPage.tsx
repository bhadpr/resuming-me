import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import type { CommunityReminder } from '../lib/communityReminders'
import { navigateBack } from '../lib/navigation'
import { communityRegion } from '../lib/schoolZip'
import {
  getSharedListById,
  INDIA_HOLIDAY_LIST_ID,
  listCricketTeamsForSearch,
  US_HOLIDAY_LIST_ID,
  type SharedList,
} from '../lib/sharedLists'
import { CalendarImportDetail, CalendarImportSection, CricketImportSection, LeagueImportSection, NflImportSection } from './CalendarImports'
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
  const [searchParams, setSearchParams] = useSearchParams()
  const { t } = useLocale()
  const [opened, setOpened] = useState<SharedList | null>(null)
  const [phase, setPhase] = useState<'idle' | 'loading' | 'ready' | 'miss'>('idle')
  const region = communityRegion()
  const listId = searchParams.get('list')
  const cricketTeam = searchParams.get('cricket')
  const waiting = Boolean(listId || cricketTeam) && opened == null && phase !== 'miss'

  useEffect(() => {
    if (!listId && !cricketTeam) {
      setPhase('idle')
      return
    }
    let live = true
    setPhase('loading')
    const load = listId
      ? getSharedListById(listId)
      : listCricketTeamsForSearch(cricketTeam ?? '').then(
          (lists) => lists.find((list) => list.title === cricketTeam) ?? lists[0] ?? null,
        )
    load
      .then((list) => {
        if (!live) return
        if (list) {
          setOpened(list)
          setPhase('ready')
          return
        }
        setPhase('miss')
      })
      .catch(() => {
        if (live) setPhase('miss')
      })
    return () => {
      live = false
    }
  }, [listId, cricketTeam])

  return (
    <div className="activity-list-screen">
      <button
        type="button"
        className="btn btn-ghost btn-sm back-btn"
        onClick={() => {
          if (opened) {
            setOpened(null)
            if (listId || cricketTeam) setSearchParams({}, { replace: true })
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
          <h2>
            {opened
              ? opened.title
              : waiting
                ? t('reminders.loading')
                : t(section === 'schedules' ? 'reminders.community.schedulesTitle' : 'reminders.community.holidaysTitle')}
          </h2>
          {!opened && !waiting && (
            <p className="screen-sub">
              {t(section === 'schedules' ? 'reminders.community.schedulesSub' : 'reminders.community.sub')}
            </p>
          )}
        </div>
      </div>
      {waiting ? null : opened ? (
        <CalendarImportDetail list={opened} />
      ) : section === 'schedules' ? (
        region === 'us' || region === 'in' ? (
          <section className="community-group">
            <h3 className="section-label">{t('reminders.community.sports')}</h3>
            <p className="community-group-note">{t('reminders.community.sportsNote')}</p>
            {region === 'us' && (
              <>
                <NflImportSection title={t('reminders.community.nfl')} onOpen={setOpened} />
                <LeagueImportSection league="nba" title={t('reminders.community.nba')} onOpen={setOpened} />
                <LeagueImportSection league="nhl" title={t('reminders.community.nhl')} onOpen={setOpened} />
                <LeagueImportSection league="mlb" title={t('reminders.community.mlb')} onOpen={setOpened} />
                <LeagueImportSection league="mls" title={t('reminders.community.mls')} onOpen={setOpened} />
              </>
            )}
            <CricketImportSection title={t('reminders.community.cricket')} onOpen={setOpened} />
          </section>
        ) : (
          <section className="empty-state">
            <p>{t('reminders.community.schedulesEmpty')}</p>
          </section>
        )
      ) : (
        <>
          <section className="community-group">
            <h3 className="section-label">{t('reminders.community.holidayGroup')}</h3>
            {region === 'us' && (
              <HolidayCatalog title={t('reminders.community.usHolidays2026')} listId={US_HOLIDAY_LIST_ID} today={today} />
            )}
            <HolidayCatalog title={t('reminders.community.inHolidays2026')} listId={INDIA_HOLIDAY_LIST_ID} today={today} />
          </section>
          {region === 'us' && (
            <section className="community-group">
              <h3 className="section-label">{t('reminders.community.schools')}</h3>
              <p className="community-group-note">{t('reminders.community.schoolsNote')}</p>
              <CalendarImportSection title={t('reminders.community.usSchool')} onOpen={setOpened} />
            </section>
          )}
        </>
      )}
    </div>
  )
}
