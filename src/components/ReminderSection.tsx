import { useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import type { Locale } from '../lib/i18n'
import {
  formatReminderDay,
  formatReminderTime,
  tomorrowOf,
  type Reminder,
} from '../lib/reminderSchedule'
import { Icon } from './Icon'

/** Time, or any time, plus "From Tuesday" when an earlier day is still open. */
function reminderWhen(
  reminder: Reminder,
  today: string,
  locale: Locale,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string {
  const when =
    reminder.hour != null && reminder.minute != null
      ? formatReminderTime(reminder.hour, reminder.minute, locale)
      : t('reminders.anyTime')
  if (reminder.day >= today) return when
  return `${when} · ${t('reminders.from', { day: formatReminderDay(reminder.day, today, locale) })}`
}

interface ReminderRowProps {
  reminder: Reminder
  today: string
  busy: boolean
  onDone: () => void
  onMove: (day: string) => void
  onEdit: () => void
}

function ReminderRow({ reminder, today, busy, onDone, onMove, onEdit }: ReminderRowProps) {
  const { locale, t } = useLocale()
  const [picking, setPicking] = useState(false)

  return (
    <li className="today-row today-row-stack">
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-name reminder-text-line">{reminder.text}</span>
          <span className="activity-desc">{reminderWhen(reminder, today, locale, t)}</span>
        </span>
        <span className="today-actions">
          <button type="button" className="btn btn-primary btn-today" disabled={busy} onClick={onDone}>
            {t('reminders.done')}
          </button>
        </span>
      </div>
      <div className="today-extra">
        <button type="button" className="today-extra-btn" disabled={busy} onClick={() => onMove(tomorrowOf(today))}>
          {t('reminders.moveTomorrow')}
        </button>
        <button
          type="button"
          className="today-extra-btn"
          disabled={busy}
          aria-expanded={picking}
          onClick={() => setPicking((open) => !open)}
        >
          {t('reminders.pickDay')}
        </button>
        <button type="button" className="today-extra-btn" disabled={busy} onClick={onEdit}>
          {t('reminders.change')}
        </button>
      </div>
      {picking && (
        <input
          className="field-input field-input-sm reminder-pick-day"
          type="date"
          min={today}
          defaultValue={reminder.day < today ? today : reminder.day}
          aria-label={t('reminders.pickDay')}
          onChange={(event) => {
            const day = event.target.value
            if (!day || day < today) return
            setPicking(false)
            if (day !== reminder.day) onMove(day)
          }}
        />
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
  onMove: (reminder: Reminder, day: string) => void
  onEdit: (reminder: Reminder) => void
}

/** Today's reminders, then the ones finished today folded into one line. */
export function ReminderSection({
  open,
  doneToday,
  today,
  busyId,
  onDone,
  onNotDone,
  onMove,
  onEdit,
}: ReminderSectionProps) {
  const { t } = useLocale()
  const [doneOpen, setDoneOpen] = useState(false)
  if (open.length === 0 && doneToday.length === 0) return null

  return (
    <section className="today-section" aria-label={t('reminders.title')}>
      <h3 className="section-label">{t('reminders.title')}</h3>
      {open.length > 0 && (
        <ul className="today-list">
          {open.map((reminder) => (
            <ReminderRow
              key={reminder.id}
              reminder={reminder}
              today={today}
              busy={busyId === reminder.id}
              onDone={() => onDone(reminder)}
              onMove={(day) => onMove(reminder, day)}
              onEdit={() => onEdit(reminder)}
            />
          ))}
        </ul>
      )}
      {doneToday.length > 0 && (
        <div className="reminder-done-today">
          <button
            type="button"
            className="today-extra-btn"
            aria-expanded={doneOpen}
            onClick={() => setDoneOpen((value) => !value)}
          >
            {t('reminders.doneToday', { count: doneToday.length })}
          </button>
          {doneOpen && (
            <ul className="today-list">
              {doneToday.map((reminder) => (
                <li key={reminder.id} className="today-row today-row-done">
                  <div className="today-row-main">
                    <span className="activity-name reminder-text-line reminder-struck">{reminder.text}</span>
                    <span className="today-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-today"
                        disabled={busyId === reminder.id}
                        onClick={() => onNotDone(reminder)}
                      >
                        {t('reminders.notDone')}
                      </button>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

interface ReminderListSectionProps {
  /** Open reminders for today, including earlier days still open. */
  dueNow: Reminder[]
  /** Open reminders after today, by date. */
  later: Reminder[]
  today: string
  loading: boolean
  error: string | null
  onAdd: () => void
  onOpen: (reminder: Reminder) => void
}

/** Every open reminder on the Activity tab, grouped by day. Done ones are not listed. */
export function ReminderListSection({
  dueNow,
  later,
  today,
  loading,
  error,
  onAdd,
  onOpen,
}: ReminderListSectionProps) {
  const { locale, t } = useLocale()
  const tomorrow = tomorrowOf(today)
  const groups: { key: string; label: string; items: Reminder[] }[] = []
  if (dueNow.length > 0) groups.push({ key: 'today', label: t('reminders.today'), items: dueNow })
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
    <section className="medicine-section reminder-list-section">
      <div className="screen-heading">
        <div>
          <h2>{t('reminders.title')}</h2>
          <p className="screen-sub">{t('reminders.sub')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          {t('reminders.add')}
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading && groups.length === 0 ? (
        <p className="muted-center">{t('reminders.loading')}</p>
      ) : groups.length === 0 ? (
        <p className="medicine-empty">{t('reminders.empty')}</p>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="reminder-day-group">
            <p className="reminder-day-label">{group.label}</p>
            <ul className="activity-list">
              {group.items.map((reminder) => (
                <li key={reminder.id}>
                  <button type="button" className="activity-row" onClick={() => onOpen(reminder)}>
                    <span className="activity-meta">
                      <span className="activity-name reminder-text-line">{reminder.text}</span>
                      <span className="activity-desc">{reminderWhen(reminder, today, locale, t)}</span>
                    </span>
                    <span className="activity-chevron" aria-hidden>
                      <Icon name="chevron" />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </section>
  )
}
