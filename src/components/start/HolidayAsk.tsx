import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../../hooks/useLocale'
import { holidayArtUrl } from '../CommunityReminderPicker'
import { DayBeforeChoice } from '../DayBeforeChoice'
import { holidayCopyText } from '../../lib/communityReminders'
import { localeTag, type Locale } from '../../lib/i18n'
import { getSharedListById, type SharedList } from '../../lib/sharedLists'

function shortDay(day: string, locale: Locale): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, date ?? 1).toLocaleDateString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

/**
 * Every upcoming day in one holiday list. The cards are pictures, not choices.
 * Yes adds the whole list. No adds nothing. An empty list moves on by itself.
 */
export function HolidayAsk({
  today,
  listId,
  onAccept,
  onSkip,
}: {
  today: string
  listId: string
  onAccept: (list: SharedList, remindBefore: boolean) => Promise<'ok' | 'full'>
  onSkip: () => void
}) {
  const { locale, t } = useLocale()
  const [list, setList] = useState<SharedList | null>(null)
  const [ready, setReady] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [dayBefore, setDayBefore] = useState(true)
  const skipRef = useRef(onSkip)
  skipRef.current = onSkip
  const visible = (list?.items ?? []).filter((item) => item.day >= today).sort((a, b) => a.day.localeCompare(b.day))

  useEffect(() => {
    let live = true
    setReady(false)
    setLoadFailed(false)
    setList(null)
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

  useEffect(() => {
    if (!ready || loadFailed) return
    if (list && visible.length > 0) return
    skipRef.current()
  }, [ready, loadFailed, list, visible.length])

  async function accept() {
    if (!list || busy || visible.length === 0) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await onAccept(list, dayBefore)
      if (result === 'full') setMessage(t('reminders.full'))
    } catch (err) {
      const unavailable = err instanceof Error && err.message.includes('shared_list_unavailable')
      setMessage(t(unavailable ? 'sharedList.unavailable' : 'sharedList.addFailed'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {loadFailed ? (
        <p className="error">{t('reminders.community.error')}</p>
      ) : !ready ? (
        <p className="muted-center">{t('reminders.loading')}</p>
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
                        <img
                          className="community-photo"
                          src={art}
                          alt=""
                          width={320}
                          height={320}
                          loading="lazy"
                          decoding="async"
                        />
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
      {message && <p className="error">{message}</p>}
      <div className="start-holiday-choice">
        <DayBeforeChoice checked={dayBefore} onChange={setDayBefore} />
      </div>
      <div className="start-yes-no">
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !ready || loadFailed || visible.length === 0}
          onClick={() => void accept()}
        >
          {busy ? t('sharedList.accepting') : t('landing.yes')}
        </button>
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onSkip}>
          {t('start.no')}
        </button>
      </div>
    </>
  )
}
