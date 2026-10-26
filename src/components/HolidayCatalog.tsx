import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../hooks/useLocale'
import { holidayCopyText } from '../lib/communityReminders'
import { loadGuestDraft } from '../lib/guestDraft'
import { localeTag, type Locale } from '../lib/i18n'
import { importSharedList, removeImportedSharedList } from '../lib/importSharedList'
import { acceptedSharedListItemIds, getSharedListById, type SharedList } from '../lib/sharedLists'
import { holidayArtUrl } from './CommunityReminderPicker'
import { DayBeforeChoice } from './DayBeforeChoice'
import { SectionFold } from './MonthFold'

function shortDay(day: string, locale: Locale): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, date ?? 1).toLocaleDateString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
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

/** One holiday catalog. Adding copies the whole list, and the phone keeps following it. */
export function HolidayCatalog({ title, listId, today }: { title: string; listId: string; today: string }) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { locale, t } = useLocale()
  const [list, setList] = useState<SharedList | null>(null)
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [busyRemove, setBusyRemove] = useState(false)
  const [done, setDone] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dayBefore, setDayBefore] = useState(true)
  const { saved, forget } = useSavedItemIds(list?.items.map((item) => item.id) ?? [])
  const visible = (list?.items ?? []).filter((item) => item.day >= today).sort((a, b) => a.day.localeCompare(b.day))
  const already = saved != null && (list?.items.length ?? 0) > 0 && list!.items.every((item) => saved.has(item.id))
  const added = done || already

  useEffect(() => {
    let live = true
    getSharedListById(listId)
      .then((found) => {
        if (!live) return
        setList(found)
        setReady(true)
      })
      .catch(() => {
        if (live) setLoadFailed(true)
      })
    return () => {
      live = false
    }
  }, [listId])

  async function addAll() {
    if (!list || authLoading || busy || saved == null) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await importSharedList(list, user?.id ?? null, saved, dayBefore)
      if (result === 'full') {
        setMessage(t('reminders.full'))
        return
      }
      if (result === 'ok') {
        navigate('/reminders', { replace: true })
        return
      }
      setDone(true)
    } catch (err) {
      const unavailable = err instanceof Error && err.message.includes('shared_list_unavailable')
      setMessage(t(unavailable ? 'sharedList.unavailable' : 'sharedList.addFailed'))
    } finally {
      setBusy(false)
    }
  }

  async function removeAll() {
    if (!list || authLoading || busy || saved == null) return
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

  return (
    <SectionFold title={title} defaultOpen>
      {loadFailed ? (
        <p className="error">{t('reminders.community.error')}</p>
      ) : !ready ? (
        <p className="muted-center">{t('reminders.loading')}</p>
      ) : visible.length === 0 ? (
        <p className="muted-center">{t('reminders.community.empty')}</p>
      ) : (
        <div className="community-picker community-picker-open">
          <ul className="community-grid">
            {visible.map((item) => {
              const art = holidayArtUrl(item.text, item.day)
              return (
                <li key={item.id}>
                  <div className="community-card">
                    <span className="community-photo-frame">
                      {art ? (
                        <img className="community-photo" src={art} alt="" width={320} height={320} loading="lazy" decoding="async" />
                      ) : null}
                    </span>
                    <span className="community-name">{holidayCopyText(item.text, item.day, locale)}</span>
                    <span className="community-day">{shortDay(item.day, locale)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
      {list && list.items.length > 0 && (
        <>
          {!added && <DayBeforeChoice checked={dayBefore} onChange={setDayBefore} />}
          <button
            type="button"
            className={`btn community-continue ${added ? 'btn-secondary' : 'btn-primary'}`}
            disabled={busy || authLoading || saved == null}
            onClick={() => void (added ? removeAll() : addAll())}
          >
            {busy
              ? t(busyRemove || added ? 'reminders.community.removing' : 'sharedList.accepting')
              : t(added ? 'reminders.community.removeAll' : 'reminders.community.addAll')}
          </button>
        </>
      )}
      {message && <p className="error">{message}</p>}
    </SectionFold>
  )
}
