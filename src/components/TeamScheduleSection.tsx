import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../hooks/useLocale'
import { LIST_PHOTO_SIDE, listPhotoUrl } from '../lib/eventPhotoUrl'
import { loadGuestDraft } from '../lib/guestDraft'
import { importSharedList, removeImportedSharedList } from '../lib/importSharedList'
import { cricketTeamByName } from '../lib/cricketSearch'
import { leagueTeamByName } from '../lib/leagueTeams'
import { nflTeamByName } from '../lib/nflSearch'
import {
  acceptedSharedListItemIds,
  forgetAddedSchedule,
  listFollowedSchedules,
  rememberAddedSchedule,
  sharedListUrl,
  type SharedList,
} from '../lib/sharedLists'
import { whatsAppShareUrl } from '../lib/sharedEvents'
import { NflMark } from './NflMark'
import { EventPhoto } from './ReminderKindIcon'
import { WhatsAppIcon } from './Icon'
import { SectionFold } from './MonthFold'
import { DayBeforeChoice } from './DayBeforeChoice'
import { LeadMinutesChoice } from './LeadMinutesChoice'
import type { RemindLeadMinutes } from '../lib/reminderSchedule'

function listHasClock(list: SharedList): boolean {
  return list.items.some((item) => item.hour != null && item.minute != null)
}

function mergeAdded(current: readonly SharedList[], extra: readonly SharedList[]): SharedList[] {
  const map = new Map(current.map((list) => [list.id, list]))
  for (const list of extra) map.set(list.id, list)
  return [...map.values()].sort((a, b) => a.title.localeCompare(b.title))
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
    let live = true
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

/** One league's dropdown. Teams already added stay listed, and the menu can pick another. */
export function TeamScheduleSection({
  offered,
  title,
  teams,
  restore,
  remember,
  resolve,
  load,
  missing,
  onOpen,
}: {
  offered: boolean
  title: string
  teams: readonly { name: string }[]
  restore: () => string | null
  remember: (name: string) => void
  resolve: (name: string) => string | null
  load: (name: string) => Promise<SharedList[]>
  missing: (query: string) => string
  onOpen: (list: SharedList) => void
}) {
  const { user, loading: authLoading } = useAuth()
  const { t } = useLocale()
  const [query, setQuery] = useState<string | null>(restore)
  const [pick, setPick] = useState<SharedList[] | null>(null)
  const [added, setAdded] = useState<SharedList[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [dayBefore, setDayBefore] = useState<Record<string, boolean>>({})
  const [lead, setLead] = useState<Record<string, RemindLeadMinutes | null>>({})
  const dropped = useRef(new Set<string>())
  const loadRef = useRef(load)
  const rememberRef = useRef(remember)
  loadRef.current = load
  rememberRef.current = remember
  const titles = teams.map((team) => team.name).join('\n')
  const { saved, forget } = useSavedItemIds(pick?.flatMap((list) => list.items.map((item) => item.id)) ?? [])

  useEffect(() => {
    if (!offered || authLoading) return
    let live = true
    const names = new Set(titles ? titles.split('\n') : [])
    listFollowedSchedules(user?.id ?? null, names)
      .then((found) => {
        if (!live) return
        const kept = found.filter((list) => !dropped.current.has(list.id))
        for (const list of kept) rememberAddedSchedule(list.id)
        setAdded((current) => mergeAdded(kept, current ?? []))
      })
      .catch(() => {
        if (live) setAdded((current) => current ?? [])
      })
    return () => {
      live = false
    }
  }, [offered, authLoading, user?.id, titles])

  useEffect(() => {
    if (!offered || !query) return
    let live = true
    setPick(null)
    setLoadFailed(false)
    loadRef
      .current(query)
      .then((found) => {
        if (live) setPick(found)
      })
      .catch(() => {
        if (live) setLoadFailed(true)
      })
    return () => {
      live = false
    }
  }, [offered, query])

  useEffect(() => {
    if (!query || !added?.some((list) => list.title === query)) return
    setQuery(null)
    rememberRef.current('')
  }, [query, added])

  function chooseTeam(name: string) {
    const team = resolve(name)
    if (team && added?.some((list) => list.title === team)) {
      setQuery(null)
      remember('')
      setPick([])
      setMessage(null)
      return
    }
    remember(team ?? '')
    setQuery(team)
    setPick(team ? null : [])
    setLoadFailed(false)
    setMessage(null)
  }

  async function yes(list: SharedList) {
    if (authLoading || busyId || saved == null) return
    setBusyId(list.id)
    setMessage(null)
    try {
      const result = await importSharedList(
        list,
        user?.id ?? null,
        saved,
        dayBefore[list.id] ?? true,
        listHasClock(list) ? (lead[list.id] ?? null) : null,
      )
      if (result === 'full') {
        setMessage(t('sharedList.full'))
        return
      }
      dropped.current.delete(list.id)
      rememberAddedSchedule(list.id)
      setAdded((current) => mergeAdded(current ?? [], [list]))
      setQuery(null)
      remember('')
      setPick([])
    } catch (err) {
      const unavailable = err instanceof Error && err.message.includes('shared_list_unavailable')
      setMessage(t(unavailable ? 'sharedList.unavailable' : 'sharedList.addFailed'))
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
      dropped.current.add(list.id)
      forgetAddedSchedule(list.id)
      setAdded((current) => (current ?? []).filter((item) => item.id !== list.id))
      forget(list.items.map((item) => item.id))
    } catch {
      setMessage(t('reminders.community.removeFailed'))
    } finally {
      setBusyId(null)
    }
  }

  if (!offered) return null

  const pending = (pick ?? []).filter((list) => !added?.some((item) => item.id === list.id))
  const waiting = query != null && (pick === null || saved === null || added === null)

  return (
    <SectionFold title={title} defaultOpen={false}>
      <p className="analytics-stat-hint">{t('reminders.community.teamHint')}</p>
      <div className="school-zip team-select-wrap">
        <select
          className="field-input team-select"
          aria-label={t('reminders.community.teamLabel')}
          value={query ?? ''}
          onChange={(event) => chooseTeam(event.target.value)}
        >
          <option value="">{t('reminders.community.teamChoose')}</option>
          {teams.map((team) => (
            <option key={team.name} value={team.name}>
              {team.name}
            </option>
          ))}
        </select>
      </div>
      {query && loadFailed ? (
        <p className="error">{t('reminders.community.calendarsError')}</p>
      ) : waiting ? (
        <p className="muted-center">{t('reminders.loading')}</p>
      ) : query && pick !== null && pick.length === 0 ? (
        <p className="muted-center">{missing(query)}</p>
      ) : pending.length > 0 ? (
        <ul className="calendar-import-list">
          {pending.map((list) => (
            <TeamPickRow
              key={list.id}
              list={list}
              added={false}
              busy={busyId === list.id}
              disabled={busyId != null || authLoading}
              dayBefore={dayBefore[list.id] ?? true}
              lead={lead[list.id] ?? null}
              onOpen={onOpen}
              onDayBefore={(value) => setDayBefore((current) => ({ ...current, [list.id]: value }))}
              onLead={(value) => setLead((current) => ({ ...current, [list.id]: value }))}
              onAdd={() => void yes(list)}
              onRemove={() => void remove(list)}
            />
          ))}
        </ul>
      ) : null}
      {added && added.length > 0 && (
        <ul className="calendar-import-list calendar-import-added">
          {added.map((list) => (
            <TeamPickRow
              key={list.id}
              list={list}
              added
              busy={busyId === list.id}
              disabled={busyId != null || authLoading}
              dayBefore={false}
              lead={null}
              onOpen={onOpen}
              onDayBefore={() => {}}
              onLead={() => {}}
              onAdd={() => {}}
              onRemove={() => void remove(list)}
            />
          ))}
        </ul>
      )}
      {message && <p className="error">{message}</p>}
    </SectionFold>
  )
}

function TeamPickRow({
  list,
  added,
  busy,
  disabled,
  dayBefore,
  lead,
  onOpen,
  onDayBefore,
  onLead,
  onAdd,
  onRemove,
}: {
  list: SharedList
  added: boolean
  busy: boolean
  disabled: boolean
  dayBefore: boolean
  lead: RemindLeadMinutes | null
  onOpen: (list: SharedList) => void
  onDayBefore: (value: boolean) => void
  onLead: (value: RemindLeadMinutes | null) => void
  onAdd: () => void
  onRemove: () => void
}) {
  const { t } = useLocale()
  const count = list.items.length
  const team = nflTeamByName(list.title) ?? cricketTeamByName(list.title) ?? leagueTeamByName(list.title)
  const timed = listHasClock(list)
  return (
    <li className="calendar-import-row">
      <div className="calendar-import-main">
        <button type="button" className="calendar-import-link" onClick={() => onOpen(list)}>
          {team ? (
            <NflMark team={team} size="card" />
          ) : (
            <EventPhoto plain className="event-photo-thumb" src={listPhotoUrl(list.photoPath, undefined, LIST_PHOTO_SIDE)} alt="" />
          )}
          <span className="calendar-import-copy">
            <span className="calendar-import-title">{list.title}</span>
            <span className="calendar-import-count">
              {count === 1 ? t('reminders.community.day') : t('reminders.community.days', { count })}
            </span>
          </span>
        </button>
        <span className="calendar-import-actions">
          {added && (
            <a
              className="btn btn-secondary calendar-import-share"
              href={whatsAppShareUrl(t('sharedList.shareMessage', { title: list.title, url: sharedListUrl(list.code) }))}
              target="_blank"
              rel="noreferrer"
              aria-label={t('sharedEvent.share')}
            >
              <WhatsAppIcon />
            </a>
          )}
          <button
            type="button"
            className={`btn calendar-import-yes ${added ? 'btn-secondary' : 'btn-primary'}`}
            disabled={disabled}
            onClick={added ? onRemove : onAdd}
          >
            {busy
              ? t(added ? 'reminders.community.removing' : 'sharedList.accepting')
              : t(added ? 'reminders.community.remove' : 'reminders.community.add')}
          </button>
        </span>
      </div>
      {!added && timed && <LeadMinutesChoice minutes={lead} onChange={onLead} />}
      {!added && <DayBeforeChoice checked={dayBefore} onChange={onDayBefore} />}
    </li>
  )
}
