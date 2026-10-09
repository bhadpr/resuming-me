import { useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import type { Locale } from '../lib/i18n'
import {
  formatReminderDay,
  formatReminderTime,
  isSharedEventGone,
  tomorrowOf,
  type Reminder,
} from '../lib/reminderSchedule'
import { isShareableReminder } from '../lib/sharedEvents'
import { Icon } from './Icon'
import { ReminderKindMark } from './ReminderKindIcon'
import { SkipLink, UndoSkipButton } from './TodaySkip'

/** Time, or any time, plus "From Tuesday" when an earlier day is still open. */
function reminderWhen(
  reminder: Reminder,
  today: string,
  locale: Locale,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const parts = [
    reminder.hour != null && reminder.minute != null
      ? formatReminderTime(reminder.hour, reminder.minute, locale)
      : t('reminders.anyTime'),
  ]
  if (reminder.day < today) parts.push(t('reminders.from', { day: formatReminderDay(reminder.day, today, locale) }))
  if (reminder.everyYear) parts.push(t('reminders.everyYear'))
  if (reminder.sharedStatus === 'cancelled') parts.push(t('sharedEvent.cancelledLine'))
  else if (reminder.sharedStatus === 'switched_off') parts.push(t('sharedEvent.switchedOffLine'))
  return parts.join(' · ')
}

interface ReminderRowProps {
  reminder: Reminder
  today: string
  busy: boolean
  onDone: () => void
  onSkip: () => void
  onMove: (day: string) => void
  onCancel: () => void
}

export function ReminderRow({ reminder, today, busy, onDone, onSkip, onMove, onCancel }: ReminderRowProps) {
  const { locale, t } = useLocale()
  const [confirmCancel, setConfirmCancel] = useState(false)

  return (
    <li className="today-row today-row-stack today-row-compact item-kind-reminder">
      <div className="today-row-head">
        <ReminderKindMark kind={reminder.kind} />
        <span className="activity-name reminder-text-line">{reminder.text}</span>
      </div>
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-desc">{reminderWhen(reminder, today, locale, t)}</span>
        </span>
        <span className="today-actions today-actions-stack">
          <button type="button" className="btn btn-primary btn-today" disabled={busy} onClick={onDone}>
            {t('reminders.done')}
          </button>
          <SkipLink disabled={busy} onSkip={onSkip} />
        </span>
      </div>
      <div className="today-extra">
        {!reminder.sharedEventId && (
          <button type="button" className="today-extra-btn" disabled={busy} onClick={() => onMove(tomorrowOf(today))}>
            {t('reminders.moveTomorrow')}
          </button>
        )}
        <button
          type="button"
          className="today-extra-btn"
          disabled={busy}
          aria-expanded={confirmCancel}
          onClick={() => setConfirmCancel((open) => !open)}
        >
          {t('reminders.cancel')}
        </button>
      </div>
      {confirmCancel && (
        <div className="today-more">
          <p className="today-more-note">{t('reminders.cancelAsk')}</p>
          <div className="today-skip-chips">
            <button type="button" className="today-skip-chip" disabled={busy} onClick={onCancel}>
              {t('reminders.cancelYes')}
            </button>
            <button type="button" className="today-skip-chip" onClick={() => setConfirmCancel(false)}>
              {t('reminders.keep')}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

export interface ReminderSectionProps {
  open: Reminder[]
  doneToday: Reminder[]
  today: string
  busyId: string | null
  onDone: (reminder: Reminder) => void
  onNotDone: (reminder: Reminder) => void
  onSkip: (reminder: Reminder) => void
  onMove: (reminder: Reminder, day: string) => void
  onCancel: (reminder: Reminder) => void
}

export function ReminderDoneRow({
  reminder,
  busy,
  skipped = false,
  onNotDone,
}: {
  reminder: Reminder
  busy: boolean
  skipped?: boolean
  onNotDone: () => void
}) {
  const { locale, t } = useLocale()
  return (
    <li className="today-row today-row-stack today-row-compact today-row-done item-kind-reminder">
      <div className="today-row-head">
        <ReminderKindMark kind={reminder.kind} />
        <span className="activity-name reminder-text-line reminder-struck">{reminder.text}</span>
      </div>
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-desc">
            {skipped ? t('today.skippedLine') : reminderWhen(reminder, reminder.day, locale, t)}
          </span>
        </span>
        <span className="today-actions">
          {skipped ? (
            <UndoSkipButton disabled={busy} onUndo={onNotDone} />
          ) : (
            <button type="button" className="btn btn-secondary btn-today" disabled={busy} onClick={onNotDone}>
              {t('reminders.notDone')}
            </button>
          )}
        </span>
      </div>
    </li>
  )
}

interface ReminderListSectionProps {
  /** Open reminders for today. Earlier days still open are dropped here; they stay on Today. */
  dueNow: Reminder[]
  /** Open reminders after today, by date. */
  later: Reminder[]
  today: string
  loading: boolean
  error: string | null
  onAdd: () => void
  onOpen: (reminder: Reminder) => void
  /** Signed in only: guests cannot make shared events. */
  onShare?: (reminder: Reminder) => void
}

/** Not yet shared, or shared by this account and still on. Copies from others are not shared on. */
function canShareFromList(reminder: Reminder, today: string): boolean {
  if (!isShareableReminder(reminder, today)) return false
  if (!reminder.sharedEventId) return true
  return reminder.sharedByMe === true && !isSharedEventGone(reminder)
}

/** The Reminders tab: open reminders from today on, grouped by day. Done and past ones are not listed. */
export function ReminderListSection({
  dueNow,
  later,
  today,
  loading,
  error,
  onAdd,
  onOpen,
  onShare,
}: ReminderListSectionProps) {
  const { locale, t } = useLocale()
  const tomorrow = tomorrowOf(today)
  const groups: { key: string; label: string; items: Reminder[] }[] = []
  const todays = dueNow.filter((reminder) => reminder.day >= today)
  if (todays.length > 0) groups.push({ key: 'today', label: t('reminders.today'), items: todays })
  for (const reminder of later) {
    const last = groups[groups.length - 1]
    if (last?.key === reminder.day) {
      last.items.push(reminder)
      continue
    }
    groups.push({
      key: reminder.day,
      label: reminder.day === tomorrow ? t('reminders.tomorrow') : formatReminderDay(reminder.day, today, locale),
      items: [reminder],
    })
  }

  return (
    <div className="activity-list-screen reminder-list-section">
      <div className="screen-heading">
        <div>
          <h2>{t('nav.reminders')}</h2>
          <p className="screen-sub">{t('reminders.sub')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" aria-label={t('reminders.add')} onClick={onAdd}>
          {t('list.add')}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && groups.length === 0 ? (
        <p className="muted-center">{t('reminders.loading')}</p>
      ) : groups.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon"><Icon name="reminders" size={24} /></span>
          <p>{t('reminders.empty')}</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            {t('reminders.add')}
          </button>
        </section>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="reminder-day-group">
            <p className="reminder-day-label">{group.label}</p>
            <ul className="activity-list">
              {group.items.map((reminder) => {
                const shareable = onShare != null && canShareFromList(reminder, today)
                return (
                  <li key={reminder.id} className="reminder-list-item">
                    <button
                      type="button"
                      className={`activity-row item-kind-reminder${shareable ? ' reminder-row-shareable' : ''}`}
                      onClick={() => onOpen(reminder)}
                    >
                      <ReminderKindMark kind={reminder.kind} />
                      <span className="activity-meta">
                        <span className="activity-name reminder-text-line">{reminder.text}</span>
                        <span className="activity-desc">{reminderWhen(reminder, today, locale, t)}</span>
                        {reminder.sharedEventId && (
                          <span className="reminder-tags">
                            <span className="badge badge-shared">{t('sharedEvent.sharedTag')}</span>
                          </span>
                        )}
                      </span>
                      <span className="activity-chevron" aria-hidden>
                        <Icon name="chevron" />
                      </span>
                    </button>
                    {shareable && (
                      <button
                        type="button"
                        className="reminder-row-share"
                        aria-label={t('sharedEvent.shareThis', { text: reminder.text })}
                        onClick={() => onShare(reminder)}
                      >
                        <Icon name="share" />
                        <span>{t('sharedEvent.shareShort')}</span>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          </div>
        ))
      )}
    </div>
  )
}
