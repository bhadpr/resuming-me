import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from '../hooks/useAuth'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { useLocale } from '../hooks/useLocale'
import { todayLocalDate } from '../lib/dates'
import { addGuestReminder, ensureGuestDraft, loadGuestDraft } from '../lib/guestDraft'
import { askForReminderAlerts } from '../lib/reminderNotifications'
import type { ReminderInput } from '../lib/reminderSchedule'
import { ReminderCapError, addReminder } from '../lib/reminders'
import {
  SHARED_REPORT_REASONS,
  SharedEventError,
  followSharedEvent,
  formatSharedWhen,
  getSharedEvent,
  hasSharedEventReminder,
  isSharedEventCode,
  localEventTime,
  reportSharedEvent,
  sharedEventBlock,
  sharedEventInstallLink,
  type SharedEvent,
  type SharedEventIssue,
  type SharedReportReason,
} from '../lib/sharedEvents'
import { track } from '../lib/track'
import { ReminderKindMark } from './ReminderKindIcon'

type Load = { state: 'loading' } | { state: 'error' } | { state: 'ready'; event: SharedEvent | null }

function addIssueKey(issue: SharedEventIssue): string {
  if (issue === 'closed') return 'sharedEvent.closed'
  if (issue === 'ended') return 'sharedEvent.ended'
  if (issue === 'unavailable') return 'sharedEvent.unavailable'
  return 'sharedEvent.addFailed'
}

function isDuplicate(err: unknown): boolean {
  return typeof err === 'object' && err != null && (err as { code?: string }).code === '23505'
}

function isIphone(): boolean {
  return typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent)
}

/** resuming.me/e/<code>: the event, and one tap to add it. */
export function SharedEventPage({ code }: { code: string }) {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const { locale, t } = useLocale()
  const native = Capacitor.isNativePlatform()
  const [load, setLoad] = useState<Load>({ state: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const [already, setAlready] = useState(false)
  const [adding, setAdding] = useState(false)
  const [issueKey, setIssueKey] = useState<string | null>(null)
  const event = load.state === 'ready' ? load.event : null
  const today = todayLocalDate()
  const leaveTo = user || loadGuestDraft() ? '/today' : '/'

  useDocumentMeta({
    title: event?.text ? `${event.text} · Resuming` : 'Resuming',
    description: event?.text ? formatSharedWhen(event, locale) : undefined,
    noindex: true,
  })

  useEffect(() => {
    if (!isSharedEventCode(code)) {
      setLoad({ state: 'ready', event: null })
      return
    }
    let live = true
    setLoad({ state: 'loading' })
    getSharedEvent(code)
      .then((found) => {
        if (!live) return
        setLoad({ state: 'ready', event: found })
        track('shared_event_viewed', { status: sharedEventBlock(found, todayLocalDate()) ?? 'open', native })
      })
      .catch(() => {
        if (live) setLoad({ state: 'error' })
      })
    return () => {
      live = false
    }
  }, [code, attempt, native])

  useEffect(() => {
    if (!event || authLoading) return
    if (!user) {
      setAlready(Boolean(loadGuestDraft()?.reminders.some((item) => item.sharedEventId === event.id)))
      return
    }
    let live = true
    hasSharedEventReminder(event.id)
      .then((has) => {
        if (live) setAlready(has)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [event, user, authLoading])

  async function add(found: SharedEvent & { text: string }) {
    setIssueKey(null)
    setAdding(true)
    const local = localEventTime(found)
    const input: ReminderInput = {
      text: found.text,
      day: local?.day ?? found.day,
      hour: local?.hour ?? found.hour,
      minute: local?.minute ?? found.minute,
      kind: found.kind,
      sharedEventId: found.id,
    }
    try {
      await followSharedEvent(found.id)
      if (user) {
        try {
          await addReminder(user.id, input)
        } catch (err) {
          if (err instanceof ReminderCapError) {
            setIssueKey('reminders.full')
            return
          }
          if (isDuplicate(err)) {
            setAlready(true)
            return
          }
          throw err
        }
      } else {
        const draft = ensureGuestDraft()
        if (!draft.reminders.some((item) => item.sharedEventId === found.id) && !addGuestReminder(draft, input)) {
          setIssueKey('reminders.full')
          return
        }
      }
      track('shared_event_added', { signed_in: Boolean(user), native })
      void askForReminderAlerts(input)
      navigate('/today')
    } catch (err) {
      setIssueKey(addIssueKey(err instanceof SharedEventError ? err.issue : 'failed'))
    } finally {
      setAdding(false)
    }
  }

  if (load.state === 'loading') return <p className="muted-center">{t('sharedEvent.loading')}</p>

  if (load.state === 'error') {
    return (
      <section className="shared-event">
        <p className="shared-event-status">{t('sharedEvent.loadFailed')}</p>
        <button type="button" className="btn btn-primary" onClick={() => setAttempt((count) => count + 1)}>
          {t('sharedEvent.tryAgain')}
        </button>
      </section>
    )
  }

  const block = sharedEventBlock(event, today)
  if (!event || !event.text || block === 'unavailable') {
    return (
      <section className="shared-event">
        <p className="shared-event-status">{t('sharedEvent.unavailable')}</p>
        <Link className="btn btn-secondary" to="/">
          {t('sharedEvent.home')}
        </Link>
      </section>
    )
  }
  const found = { ...event, text: event.text }
  const local = localEventTime(found)

  return (
    <section className="shared-event">
      <p className="shared-event-intro">{t('sharedEvent.intro')}</p>
      <div className="shared-event-card">
        <ReminderKindMark kind={found.kind} />
        <div className="shared-event-body">
          <h1 className="shared-event-title">{found.text}</h1>
          {found.from && <p className="shared-event-from">{t('sharedEvent.fromLine', { from: found.from })}</p>}
          <p className="shared-event-when">{formatSharedWhen(local ?? found, locale)}</p>
          {local && (
            <p className="shared-event-from">
              {t('sharedEvent.eventTime', { when: formatSharedWhen(found, locale), zone: found.timeZone })}
            </p>
          )}
        </div>
      </div>

      {block ? (
        <p className="shared-event-status">{t(`sharedEvent.${block}`)}</p>
      ) : already ? (
        <>
          <p className="shared-event-status">{t('sharedEvent.already')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/today')}>
            {t('sharedEvent.openToday')}
          </button>
        </>
      ) : (
        <>
          {issueKey && <p className="error">{t(issueKey)}</p>}
          <button
            type="button"
            className="btn btn-primary"
            disabled={adding || authLoading}
            onClick={() => void add(found)}
          >
            {adding ? t('sharedEvent.adding') : t(native ? 'sharedEvent.addApp' : 'sharedEvent.addWeb')}
          </button>
          {native && (
            <button type="button" className="btn btn-ghost" disabled={adding} onClick={() => navigate(leaveTo)}>
              {t('sharedEvent.notNow')}
            </button>
          )}
          {!native && <p className="shared-event-note">{t('sharedEvent.webNoAlerts')}</p>}
          {!native && !isIphone() && (
            <a
              className="btn btn-secondary"
              href={sharedEventInstallLink(found.code)}
              onClick={() => track('get_app_clicked', { source: 'shared_event' })}
            >
              {t('sharedEvent.getPlay')}
            </a>
          )}
        </>
      )}
      <ReportSharedEvent eventId={found.id} />
    </section>
  )
}

/** A small link that opens three reasons. One tap sends. */
function ReportSharedEvent({ eventId }: { eventId: string }) {
  const { t } = useLocale()
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'sent' | 'failed' | null>(null)

  async function send(reason: SharedReportReason) {
    setSending(true)
    setResult(null)
    try {
      await reportSharedEvent(eventId, reason)
      track('shared_event_reported', { reason })
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
