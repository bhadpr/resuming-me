import { useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import {
  formatReminderDay,
  formatReminderTime,
  tomorrowOf,
  type Reminder,
} from '../lib/reminderSchedule'

interface ReminderRowProps {
  reminder: Reminder
  today: string
  busy: boolean
  onDone?: () => void
  onMove: (day: string) => void
  onEdit: () => void
}

function ReminderRow({ reminder, today, busy, onDone, onMove, onEdit }: ReminderRowProps) {
  const { locale, t } = useLocale()
  const [picking, setPicking] = useState(false)
  const tomorrow = tomorrowOf(today)
  const when =
    reminder.hour != null && reminder.minute != null
      ? formatReminderTime(reminder.hour, reminder.minute, locale)
      : t('reminders.anyTime')
  const from = reminder.day < today ? t('reminders.from', { day: formatReminderDay(reminder.day, today, locale) }) : null

  return (
    <li className="today-row today-row-stack">
      <div className="today-row-main">
        <span className="activity-meta">
          <span className="activity-name reminder-text-line">{reminder.text}</span>
          <span className="activity-desc">{from ? `${when} · ${from}` : when}</span>
        </span>
        {onDone && (
          <span className="today-actions">
            <button type="button" className="btn btn-primary btn-today" disabled={busy} onClick={onDone}>
              {t('reminders.done')}
            </button>
          </span>
        )}
      </div>
      <div className="today-extra">
        {onDone && (
          <button type="button" className="today-extra-btn" disabled={busy} onClick={() => onMove(tomorrow)}>
            {t('reminders.moveTomorrow')}
          </button>
        )}
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

interface ComingUpListProps {
  reminders: Reminder[]
  today: string
  busyId: string | null
  onMove: (reminder: Reminder, day: string) => void
  onEdit: (reminder: Reminder) => void
}

/** Open reminders after today, grouped by day. Done ones are not listed. */
export function ComingUpList({ reminders, today, busyId, onMove, onEdit }: ComingUpListProps) {
  const { locale, t } = useLocale()
  if (reminders.length === 0) return null
  const tomorrow = tomorrowOf(today)
  const days: { day: string; items: Reminder[] }[] = []
  for (const reminder of reminders) {
    const last = days[days.length - 1]
    if (last?.day === reminder.day) last.items.push(reminder)
    else days.push({ day: reminder.day, items: [reminder] })
  }

  return (
    <section className="today-section reminder-coming-up" aria-label={t('reminders.comingUp')}>
      <h3 className="section-label">{t('reminders.comingUp')}</h3>
      {days.map(({ day, items }) => (
        <div key={day} className="reminder-day-group">
          <p className="reminder-day-label">
            {day === tomorrow ? t('reminders.tomorrow') : formatReminderDay(day, today, locale)}
          </p>
          <ul className="today-list">
            {items.map((reminder) => (
              <ReminderRow
                key={reminder.id}
                reminder={reminder}
                today={today}
                busy={busyId === reminder.id}
                onMove={(next) => onMove(reminder, next)}
                onEdit={() => onEdit(reminder)}
              />
            ))}
          </ul>
        </div>
      ))}
    </section>
  )
}
