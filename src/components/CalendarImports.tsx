import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../hooks/useLocale'
import { LIST_PHOTO_SIDE, listPhotoUrl } from '../lib/eventPhotoUrl'
import { loadGuestDraft } from '../lib/guestDraft'
import { importSharedList, messageForSharedListAdd, removeImportedSharedList } from '../lib/importSharedList'
import { reminderClock } from '../lib/listClock'
import {
  CRICKET_TEAMS,
  cricketTeamByName,
  cricketTeamName,
  readCricketSearch,
  writeCricketSearch,
} from '../lib/cricketSearch'
import {
  leagueTeamByName,
  leagueTeamName,
  leagueTeams,
  readLeagueSearch,
  writeLeagueSearch,
  type LeagueId,
} from '../lib/leagueTeams'
import { NFL_TEAMS, nflTeamByName, nflTeamName, readNflSearch, writeNflSearch } from '../lib/nflSearch'
import { NflMark } from './NflMark'
import { isIndiaTimeZone, isUsTimeZone, parseZipCodes, readSchoolZip, writeSchoolZip } from '../lib/schoolZip'
import { todayLocalDate } from '../lib/dates'
import { localeTag, type Locale } from '../lib/i18n'
import { groupByMonth } from '../lib/monthFold'
import { formatReminderTime } from '../lib/reminderSchedule'
import { MonthFold, SectionFold, useClosedMonths } from './MonthFold'
import { DayBeforeChoice } from './DayBeforeChoice'
import { LeadMinutesChoice } from './LeadMinutesChoice'
import type { RemindLeadMinutes } from '../lib/reminderSchedule'
import {
  acceptedSharedListItemIds,
  listCricketTeamsForSearch,
  listLeagueTeamsForSearch,
  listNflTeamsForSearch,
  listSchoolCalendarsForZip,
  sharedListUrl,
  type SharedList,
} from '../lib/sharedLists'
import { whatsAppShareUrl } from '../lib/sharedEvents'
import { EventPhoto } from './ReminderKindIcon'
import { WhatsAppIcon } from './Icon'
import { RemoveIconButton, TeamScheduleSection } from './TeamScheduleSection'

function listHasClock(list: SharedList): boolean {
  return list.items.some((item) => item.hour != null && item.minute != null)
}

function schoolDayLabel(day: string, locale: Locale): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, date ?? 1).toLocaleDateString(localeTag(locale), {
    weekday: 'short',
    day: 'numeric',
  })
}

function holidayParts(text: string): { name: string; type: string } {
  const split = text.split(' · ')
  if (split.length < 2) return { name: text, type: '' }
  return { name: split[0] ?? text, type: split.slice(1).join(' · ') }
}

function useSavedItemIds(ids: readonly string[]): {
  saved: Set<string> | null
  forget: (drop: readonly string[]) => void
} {
  const { user, loading } = useAuth()
  const [saved, setSaved] = useState<Set<string> | null>(null)
  const key = ids.join(',')
  const forget = useCallback((drop: readonly string[]) => {
    setSaved((current) => {
      if (!current) return current
      const next = new Set(current)
      for (const id of drop) next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    if (loading) return
    const wanted = key ? key.split(',') : []
    setSaved(null)
    if (!user) {
      const have = new Set(
        (loadGuestDraft()?.reminders ?? [])
          .map((item) => item.sharedListItemId)
          .filter((id): id is string => typeof id === 'string' && wanted.includes(id)),
      )
      setSaved(have)
      return
    }
    let live = true
    acceptedSharedListItemIds(wanted)
      .then((have) => {
        if (live) setSaved(new Set(have))
      })
      .catch(() => {
        if (live) setSaved(new Set())
      })
    return () => {
      live = false
    }
  }, [key, user, loading])

  return { saved, forget }
}

/** School calendars for a US time zone. A ZIP code chooses which lists appear. */
export function CalendarImportSection({
  onOpen,
  title,
}: {
  onOpen: (list: SharedList) => void
  title?: string
}) {
  const us = isUsTimeZone()
  const { user, loading: authLoading } = useAuth()
  const { t } = useLocale()
  const navigate = useNavigate()
  const [zip, setZip] = useState<string | null>(() => readSchoolZip())
  const [draft, setDraft] = useState(() => readSchoolZip() ?? '')
  const [editing, setEditing] = useState(() => readSchoolZip() == null)
  const [zipError, setZipError] = useState<string | null>(null)
  const [lists, setLists] = useState<SharedList[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [imported, setImported] = useState<string[]>([])
  const [dayBefore, setDayBefore] = useState<Record<string, boolean>>({})
  const { saved, forget } = useSavedItemIds(lists?.flatMap((list) => list.items.map((item) => item.id)) ?? [])

  useEffect(() => {
    if (!us || !zip) return
    let live = true
    setLists(null)
    setLoadFailed(false)
    listSchoolCalendarsForZip(zip)
      .then((found) => {
        if (live) setLists(found)
      })
      .catch(() => {
        if (live) setLoadFailed(true)
      })
    return () => {
      live = false
    }
  }, [us, zip])

  function saveZip() {
    const parsed = parseZipCodes(draft)
    if (!parsed.ok || parsed.zipCodes.length !== 1) {
      setZipError(t('reminders.community.zipInvalid'))
      return
    }
    const next = parsed.zipCodes[0]
    writeSchoolZip(next)
    setZip(next)
    setDraft(next)
    setEditing(false)
    setZipError(null)
  }

  async function yes(list: SharedList) {
    if (authLoading || busyId) return
    setBusyId(list.id)
    setMessage(null)
    try {
      const result = await importSharedList(list, user?.id ?? null, saved ?? new Set(), dayBefore[list.id] ?? true)
      if (result === 'full') {
        setMessage(t('sharedList.full'))
        return
      }
      if (result === 'ok') {
        navigate('/reminders', { replace: true })
        return
      }
      setImported((current) => [...current, list.id])
    } catch (err) {
      setMessage(messageForSharedListAdd(err, t('sharedList.addFailed'), t('sharedList.unavailable')))
    } finally {
      setBusyId(null)
    }
  }

  async function remove(list: SharedList) {
    if (authLoading || busyId) return
    setBusyId(list.id)
    setMessage(null)
    try {
      await removeImportedSharedList(list, user?.id ?? null)
      setImported((current) => current.filter((id) => id !== list.id))
      forget(list.items.map((item) => item.id))
    } catch {
      setMessage(t('reminders.community.removeFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (!us) return null
  const matched = zip && lists ? lists.filter((list) => list.zipCodes.includes(zip)) : null

  return (
    <SectionFold title={title ?? t('reminders.community.calendars')} defaultOpen={false}>
      <p className="analytics-stat-hint">{t('reminders.community.zipHint')}</p>
      {editing ? (
        <form
          className="school-zip"
          onSubmit={(event) => {
            event.preventDefault()
            saveZip()
          }}
        >
          <input
            className="field-input"
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={5}
            aria-label={t('reminders.community.zipLabel')}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            {t('reminders.community.zipSave')}
          </button>
        </form>
      ) : (
        <div className="school-zip">
          <span className="school-zip-saved">{zip}</span>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setDraft(zip ?? '')
              setEditing(true)
              setZipError(null)
            }}
          >
            {t('reminders.community.zipChange')}
          </button>
        </div>
      )}
      {zipError && <p className="error">{zipError}</p>}
      {!zip ? null : loadFailed ? (
        <p className="error">{t('reminders.community.calendarsError')}</p>
      ) : matched === null || saved === null ? (
        <p className="muted-center">{t('reminders.loading')}</p>
      ) : matched.length === 0 ? (
        <p className="muted-center">{t('reminders.community.zipNone', { zip })}</p>
      ) : (
        <ul className="calendar-import-list">
          {matched.map((list) => {
            const done = imported.includes(list.id) || list.items.every((item) => saved.has(item.id))
            const count = list.items.length
            return (
              <li key={list.id} className="calendar-import-row">
                <div className="calendar-import-main">
                  <button type="button" className="calendar-import-link" onClick={() => onOpen(list)}>
                    <EventPhoto plain className="event-photo-thumb" src={listPhotoUrl(list.photoPath, undefined, LIST_PHOTO_SIDE)} alt="" />
                    <span className="calendar-import-copy">
                      <span className="calendar-import-title">{list.title}</span>
                      <span className="calendar-import-count">
                        {count === 1 ? t('reminders.community.day') : t('reminders.community.days', { count })}
                      </span>
                    </span>
                  </button>
                  {done ? (
                    <RemoveIconButton
                      label={
                        busyId === list.id
                          ? t('reminders.community.removing')
                          : t('reminders.community.remove')
                      }
                      disabled={busyId != null || authLoading}
                      onClick={() => void remove(list)}
                    />
                  ) : (
                    <button
                      type="button"
                      className="btn btn-primary calendar-import-yes"
                      disabled={busyId != null || authLoading}
                      onClick={() => void yes(list)}
                    >
                      {busyId === list.id ? t('sharedList.accepting') : t('reminders.community.add')}
                    </button>
                  )}
                </div>
                {!done && (
                  <DayBeforeChoice
                    checked={dayBefore[list.id] ?? true}
                    onChange={(value) => setDayBefore((current) => ({ ...current, [list.id]: value }))}
                  />
                )}
              </li>
            )
          })}
        </ul>
      )}
      {message && <p className="error">{message}</p>}
    </SectionFold>
  )
}

/** The days in one list, and Yes to copy them all. */
export function CalendarImportDetail({ list }: { list: SharedList }) {
  const { user, loading: authLoading } = useAuth()
  const { locale, t } = useLocale()
  const navigate = useNavigate()
  const { saved, forget } = useSavedItemIds(list.items.map((item) => item.id))
  const [busy, setBusy] = useState(false)
  const [busyRemove, setBusyRemove] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dayBefore, setDayBefore] = useState(true)
  const [lead, setLead] = useState<RemindLeadMinutes | null>(null)
  const timed = listHasClock(list)
  const already = saved != null && list.items.every((item) => saved.has(item.id))

  async function yes() {
    if (authLoading || busy || saved == null) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await importSharedList(list, user?.id ?? null, saved, dayBefore, timed ? lead : null)
      if (result === 'full') {
        setMessage(t('sharedList.full'))
        return
      }
      if (result === 'ok') {
        navigate('/reminders', { replace: true })
        return
      }
      setDone(true)
    } catch (err) {
      setMessage(messageForSharedListAdd(err, t('sharedList.addFailed'), t('sharedList.unavailable')))
    } finally {
      setBusy(false)
    }
  }

  async function remove() {
    if (authLoading || busy || saved == null) return
    setBusy(true)
    setBusyRemove(true)
    setMessage(null)
    try {
      await removeImportedSharedList(list, user?.id ?? null)
      forget(list.items.map((item) => item.id))
      setDone(false)
    } catch {
      setMessage(t('reminders.community.removeFailed'))
    } finally {
      setBusy(false)
      setBusyRemove(false)
    }
  }

  const added = done || already
  const shown = list.items.map((item) => ({ ...item, ...reminderClock(item, list.timeZone) }))
  const showType = shown.some((item) => holidayParts(item.text).type)
  const months = groupByMonth(shown)
  const { isOpen, toggle } = useClosedMonths(
    months.map((month) => month.key),
    todayLocalDate(),
  )

  const team = nflTeamByName(list.title) ?? cricketTeamByName(list.title) ?? leagueTeamByName(list.title)
  return (
    <div className="calendar-import-detail">
      {team ? (
        <NflMark team={team} size="hero" />
      ) : (
        <EventPhoto className="school-days-logo" src={listPhotoUrl(list.photoPath, undefined, LIST_PHOTO_SIDE)} alt="" />
      )}
      <a
        className="btn btn-secondary community-continue"
        href={whatsAppShareUrl(
          t(team ? 'sharedList.shareMessage' : 'sharedList.shareSchoolMessage', {
            title: list.title,
            url: sharedListUrl(list.code),
          }),
        )}
        target="_blank"
        rel="noreferrer"
      >
        <WhatsAppIcon />
        {t('sharedEvent.share')}
      </a>
      <div className="month-folds">
        {months.map((month) => (
          <MonthFold
            key={month.key}
            monthKey={month.key}
            count={month.items.length}
            open={isOpen(month.key)}
            onToggle={() => toggle(month.key)}
          >
            <div className="school-days-wrap">
              <table className="school-days">
                <thead>
                  <tr>
                    <th scope="col">{t('reminders.community.date')}</th>
                    <th scope="col">{t('reminders.community.holiday')}</th>
                    {showType && <th scope="col">{t('reminders.community.type')}</th>}
                  </tr>
                </thead>
                <tbody>
                  {month.items.map((item) => {
                    const parts = holidayParts(item.text)
                    const time =
                      item.hour != null && item.minute != null ? formatReminderTime(item.hour, item.minute, locale) : ''
                    return (
                      <tr key={item.id}>
                        <td className="school-days-date">
                          {schoolDayLabel(item.day, locale)}
                          {time && <span className="school-days-time">{time}</span>}
                        </td>
                        <td>{parts.name}</td>
                        {showType && <td className="school-days-type">{parts.type}</td>}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </MonthFold>
        ))}
      </div>
      {!added && timed && <LeadMinutesChoice minutes={lead} onChange={setLead} />}
      {!added && <DayBeforeChoice checked={dayBefore} onChange={setDayBefore} />}
      {added ? (
        <RemoveIconButton
          label={busyRemove || busy ? t('reminders.community.removing') : t('reminders.community.remove')}
          disabled={busy || authLoading || saved == null}
          onClick={() => void remove()}
        />
      ) : (
        <button
          type="button"
          className="btn btn-primary community-continue"
          disabled={busy || authLoading || saved == null}
          onClick={() => void yes()}
        >
          {busy ? t('sharedList.accepting') : t('reminders.community.add')}
        </button>
      )}
      {message && <p className="error">{message}</p>}
    </div>
  )
}

/** NFL teams for a US time zone. Added teams stay listed while the menu picks another. */
export function NflImportSection({
  onOpen,
  title,
}: {
  onOpen: (list: SharedList) => void
  title?: string
}) {
  const { t } = useLocale()
  return (
    <TeamScheduleSection
      offered={isUsTimeZone()}
      title={title ?? t('reminders.community.nfl')}
      teams={NFL_TEAMS}
      restore={() => nflTeamName(readNflSearch())}
      remember={writeNflSearch}
      resolve={nflTeamName}
      load={listNflTeamsForSearch}
      missing={(query) => t('reminders.community.teamNone', { query })}
      onOpen={onOpen}
    />
  )
}

/** Cricket teams on a US or India clock. Added teams stay listed while the menu picks another. */
export function CricketImportSection({
  onOpen,
  title,
}: {
  onOpen: (list: SharedList) => void
  title?: string
}) {
  const { t } = useLocale()
  return (
    <TeamScheduleSection
      offered={isUsTimeZone() || isIndiaTimeZone()}
      title={title ?? t('reminders.community.cricket')}
      teams={CRICKET_TEAMS}
      restore={() => cricketTeamName(readCricketSearch())}
      remember={writeCricketSearch}
      resolve={cricketTeamName}
      load={listCricketTeamsForSearch}
      missing={(query) => t('reminders.community.cricketNone', { query })}
      onOpen={onOpen}
    />
  )
}

/** NBA, NHL, MLB, or MLS. Added teams stay listed while the menu picks another. */
export function LeagueImportSection({
  league,
  title,
  onOpen,
}: {
  league: LeagueId
  title: string
  onOpen: (list: SharedList) => void
}) {
  const { t } = useLocale()
  return (
    <TeamScheduleSection
      offered={isUsTimeZone()}
      title={title}
      teams={leagueTeams(league)}
      restore={() => leagueTeamName(league, readLeagueSearch(league))}
      remember={(name) => writeLeagueSearch(league, name)}
      resolve={(name) => leagueTeamName(league, name)}
      load={(name) => listLeagueTeamsForSearch(league, name)}
      missing={(query) => t('reminders.community.leagueNone', { query })}
      onOpen={onOpen}
    />
  )
}

