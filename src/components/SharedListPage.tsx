import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../hooks/useAuth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useLocale } from '../hooks/useLocale'
import { todayLocalDate } from '../lib/dates'
import { groupByMonth } from '../lib/monthFold'
import { MonthFold, useClosedMonths } from './MonthFold'
import { addGuestReminder, ensureGuestDraft, loadGuestDraft } from '../lib/guestDraft'
import { askForReminderAlerts } from '../lib/reminderNotifications'
import { ReminderCapError, addReminder } from '../lib/reminders'
import { formatReminderDay, formatReminderTime, readPartTimes, type ReminderInput } from '../lib/reminderSchedule'
import { EventPhoto } from './ReminderKindIcon'
import { listPhotoUrl } from '../lib/eventPhotoUrl'
import {
  acceptedSharedListItemIds,
  acceptSharedList,
  getSharedList,
  isSharedListCode,
  reportSharedList,
  sharedListInstallLink,
  type SharedList,
  type SharedListItem,
} from '../lib/sharedLists'
import { SHARED_REPORT_REASONS, type SharedReportReason } from '../lib/sharedEvents'
import { track } from '../lib/track'

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; list: SharedList | null }

function isDuplicate(err: unknown): boolean {
  return typeof err === 'object' && err != null && (err as { code?: string }).code === '23505'
}

function isIphone(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
}

function isAndroidDevice(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)
}

function whenLabel(item: SharedListItem, today: string, locale: Parameters<typeof formatReminderDay>[2]): string {
  const day = formatReminderDay(item.day, today, locale)
  if (item.hour == null || item.minute == null) return day
  return `${day} · ${formatReminderTime(item.hour, item.minute, locale)}`
}

function ListMonths({
  months,
  today,
  saved,
  picked,
  onToggle,
}: {
  months: { key: string; items: SharedListItem[] }[]
  today: string
  saved: Set<string>
  picked: Set<string>
  onToggle: (id: string) => void
}) {
  const { locale, t } = useLocale()
  const { isOpen, toggle } = useClosedMonths(
    months.map((month) => month.key),
    today,
  )
  return (
    <div className="month-folds">
      {months.map((month) => (
        <MonthFold
          key={month.key}
          monthKey={month.key}
          count={month.items.length}
          open={isOpen(month.key)}
          onToggle={() => toggle(month.key)}
        >
          <ul className="shared-list-items">
            {month.items.map((item) =>
              saved.has(item.id) ? (
                <li key={item.id} className="shared-list-item shared-list-item-saved">
                  <span>{item.text}</span>
                  <span className="analytics-stat-hint">
                    {whenLabel(item, today, locale)} · {t('sharedList.already')}
                  </span>
                </li>
              ) : (
                <li key={item.id} className="shared-list-item">
                  <label>
                    <input type="checkbox" checked={picked.has(item.id)} onChange={() => onToggle(item.id)} />
                    <span>{item.text}</span>
                    <span className="analytics-stat-hint">{whenLabel(item, today, locale)}</span>
                  </label>
                </li>
              ),
            )}
          </ul>
        </MonthFold>
      ))}
    </div>
  )
}

/** resuming.me/c/<code>: the reminders, and a tap to accept them. */
export function SharedListPage({ code }: { code: string }) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { locale, t } = useLocale()
  const native = Capacitor.isNativePlatform()
  const openingPlay = !native && isAndroidDevice() && isSharedListCode(code)
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [saved, setSaved] = useState<Set<string>>(new Set())
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [adding, setAdding] = useState(false)
  const [dayBeforeChoice, setDayBeforeChoice] = useState<boolean | null>(null)
  const [issueKey, setIssueKey] = useState<string | null>(null)
  const list = load.state === 'ready' ? load.list : null
  const today = todayLocalDate()

  useDocumentMeta({
    title: list ? `${list.title} · Resuming` : 'Resuming',
    description: list ? t('sharedList.intro') : undefined,
    noindex: true,
  })

  useEffect(() => {
    if (!openingPlay) return
    track('get_app_clicked', { source: 'shared_list' })
    window.location.replace(sharedListInstallLink(code))
  }, [openingPlay, code])

  useEffect(() => {
    if (openingPlay) return
    if (!isSharedListCode(code)) {
      setLoad({ state: 'ready', list: null })
      return
    }
    let live = true
    setLoad({ state: 'loading' })
    getSharedList(code)
      .then((found) => {
        if (!live) return
        setLoad({ state: 'ready', list: found })
        track('shared_list_viewed', { status: found ? 'open' : 'unavailable' })
      })
      .catch(() => {
        if (live) setLoad({ state: 'error' })
      })
    return () => {
      live = false
    }
  }, [code, attempt, openingPlay])

  useEffect(() => {
    if (!list || authLoading) return
    const ids = list.items.map((item) => item.id)
    if (!user) {
      const have = new Set(
        (loadGuestDraft()?.reminders ?? [])
          .map((item) => item.sharedListItemId)
          .filter((id): id is string => typeof id === 'string' && ids.includes(id)),
      )
      setSaved(have)
      setPicked(new Set(ids.filter((id) => !have.has(id))))
      return
    }
    let live = true
    acceptedSharedListItemIds(ids)
      .then((have) => {
        if (!live) return
        const savedIds = new Set(have)
        setSaved(savedIds)
        setPicked(new Set(ids.filter((id) => !savedIds.has(id))))
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [list, user, authLoading])

  function toggle(id: string) {
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function accept(found: SharedList) {
    const chosen = found.items.filter((item) => picked.has(item.id) && !saved.has(item.id))
    if (chosen.length === 0) {
      setIssueKey('sharedList.noneChosen')
      return
    }
    setIssueKey(null)
    setAdding(true)
    const newlySaved = new Set(saved)
    let created = 0
    let capped = false
    let timed: ReminderInput | null = null
    try {
      await acceptSharedList(found.id)
      for (const item of chosen) {
        const input: ReminderInput = {
          text: item.text,
          day: item.day,
          hour: item.hour,
          minute: item.minute,
          kind: 'event',
          sharedListItemId: item.id,
          sharedListId: found.id,
          listPhotoPath: found.photoPath,
          remindBefore: dayBeforeChoice ?? found.remindBefore,
        }
        if (input.hour != null || input.remindBefore) timed = input
        if (user) {
          try {
            await addReminder(user.id, input)
            created += 1
            newlySaved.add(item.id)
          } catch (err) {
            if (err instanceof ReminderCapError) {
              setIssueKey('sharedList.full')
              capped = true
              break
            }
            if (isDuplicate(err)) newlySaved.add(item.id)
            else throw err
          }
        } else {
          const draft = ensureGuestDraft()
          const existing = draft.reminders.find((reminder) => reminder.sharedListItemId === item.id)
          if (existing) {
            newlySaved.add(item.id)
            continue
          }
          const next = addGuestReminder(draft, input)
          if (!next) {
            setIssueKey('sharedList.full')
            capped = true
            break
          }
          created += 1
          newlySaved.add(item.id)
        }
      }
      setSaved(newlySaved)
      setPicked((current) => new Set([...current].filter((id) => !newlySaved.has(id))))
      if (created > 0) {
        track('shared_list_added', { count: created, signed_in: Boolean(user) })
        if (timed) void askForReminderAlerts(timed)
      }
      if (created > 0 && !capped) navigate('/reminders')
    } catch (err) {
      const unavailable = err instanceof Error && err.message.includes('shared_list_unavailable')
      setIssueKey(unavailable ? 'sharedList.unavailable' : 'sharedList.addFailed')
    } finally {
      setAdding(false)
    }
  }

  if (openingPlay) {
    return (
      <section className="shared-event">
        <p className="shared-event-status">{t('sharedList.openingPlay')}</p>
        <a className="btn btn-primary" href={sharedListInstallLink(code)}>
          {t('sharedList.getPlay')}
        </a>
      </section>
    )
  }

  if (load.state === 'loading') return <p className="muted-center">{t('sharedList.loading')}</p>

  if (load.state === 'error') {
    return (
      <section className="shared-event">
        <p className="shared-event-status">{t('sharedList.loadFailed')}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((count) => count + 1)}>
          {t('sharedList.tryAgain')}
        </button>
      </section>
    )
  }

  if (!list) {
    return (
      <section className="shared-event">
        <p className="shared-event-status">{t('sharedList.unavailable')}</p>
        <Link className="btn btn-secondary" to="/">
          {t('sharedList.home')}
        </Link>
      </section>
    )
  }

  const open = list.items.filter((item) => !saved.has(item.id))
  const allPicked = open.length > 0 && open.every((item) => picked.has(item.id))
  const evening = readPartTimes().evening
  const months = groupByMonth(list.items)

  return (
    <section className="shared-event">
      <p className="shared-event-intro">{t('sharedList.intro')}</p>
      <EventPhoto src={listPhotoUrl(list.photoPath)} alt={list.title} />
      <h1 className="screen-heading">{list.title}</h1>
      <ListMonths
        months={months}
        today={today}
        saved={saved}
        picked={picked}
        onToggle={toggle}
      />
      {open.length === 0 ? (
        <p className="shared-event-status">{t('sharedList.allSaved')}</p>
      ) : (
        <>
          <label className="reminder-switch">
            <input
              type="checkbox"
              checked={dayBeforeChoice ?? list.remindBefore}
              onChange={(event) => setDayBeforeChoice(event.target.checked)}
            />
            <span>
              {t('reminders.dayBefore')}
              <span className="reminder-switch-hint">
                {t('reminders.dayBeforeHint', {
                  time: formatReminderTime(evening.hour, evening.minute, locale),
                })}
              </span>
            </span>
          </label>
          <button type="button" className="btn btn-primary" disabled={adding} onClick={() => void accept(list)}>
            {adding ? t('sharedList.accepting') : allPicked ? t('sharedList.acceptAll') : t('sharedList.acceptSelected')}
          </button>
        </>
      )}
      {native && open.length > 0 && (
        <button
          type="button"
          className="btn btn-ghost"
          disabled={adding}
          onClick={() => navigate(user || loadGuestDraft() ? '/today' : '/')}
        >
          {t('sharedList.notNow')}
        </button>
      )}
      {!native && !user && open.length > 0 && <p className="analytics-stat-hint">{t('sharedList.webNoAlerts')}</p>}
      {!native && !isIphone() && open.length > 0 && (
        <a
          className="btn btn-secondary"
          href={sharedListInstallLink(code)}
          onClick={() => track('get_app_clicked', { source: 'shared_list' })}
        >
          {t('sharedList.getPlay')}
        </a>
      )}
      {issueKey === 'sharedList.full' && <p className="error">{t('sharedList.full')}</p>}
      {issueKey === 'sharedList.addFailed' && <p className="error">{t('sharedList.addFailed')}</p>}
      {issueKey === 'sharedList.noneChosen' && <p className="error">{t('sharedList.noneChosen')}</p>}
      {issueKey === 'sharedList.unavailable' && <p className="error">{t('sharedList.unavailable')}</p>}
      <Link className="btn btn-secondary" to={user || loadGuestDraft() ? '/reminders' : '/'}>
        {user || loadGuestDraft() ? t('sharedList.openReminders') : t('sharedList.home')}
      </Link>
      <ReportSharedList listId={list.id} />
    </section>
  )
}

/** A small link that opens three reasons. One tap sends. The same control is on the website and in the app. */
function ReportSharedList({ listId }: { listId: string }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'sent' | 'failed' | null>(null)

  async function send(reason: SharedReportReason) {
    setSending(true)
    setResult(null)
    try {
      await reportSharedList(listId, reason)
      track('shared_list_reported', { reason })
      setResult('sent')
    } catch {
      setResult('failed')
    } finally {
      setSending(false)
    }
  }

  if (result === 'sent') return <p className="shared-event-note">{t('sharedEvent.reportSent')}</p>
  if (!open) {
    return (
      <button type="button" className="shared-event-report" onClick={() => setOpen(true)}>
        {t('sharedEvent.report')}
      </button>
    )
  }
  return (
    <div className="shared-event-report-box">
      <p className="shared-event-note">{t('sharedEvent.reportTitle')}</p>
      <div className="today-skip-chips">
        {SHARED_REPORT_REASONS.map((reason) => (
          <button
            key={reason}
            type="button"
            className="today-skip-chip"
            disabled={sending}
            onClick={() => void send(reason)}
          >
            {t(
              reason === 'spam'
                ? 'sharedEvent.reportSpam'
                : reason === 'harmful'
                  ? 'sharedEvent.reportHarmful'
                  : 'sharedEvent.reportOther',
            )}
          </button>
        ))}
      </div>
      {result === 'failed' && <p className="error">{t('sharedEvent.manageFailed')}</p>}
    </div>
  )
}
