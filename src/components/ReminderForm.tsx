import { useState, type FormEvent } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLocale } from '../hooks/useLocale'
import {
  REMINDER_KINDS,
  REMINDER_PARTS,
  REMINDER_TEXT_MAX,
  formatReminderTime,
  formatShortReminderTime,
  partOfTime,
  readPartTimes,
  tomorrowOf,
  validateReminder,
  type Reminder,
  type ReminderInput,
  type ReminderIssue,
  type ReminderKind,
  type ReminderPart,
} from '../lib/reminderSchedule'
import { Icon } from './Icon'
import { ReminderKindMark } from './ReminderKindIcon'

type DayChoice = 'today' | 'tomorrow' | 'pick'
type TimeChoice = ReminderPart | 'any' | 'pick'

interface ReminderFormProps {
  initial: Reminder | null
  today: string
  saving: boolean
  error: string | null
  /** Resolves to 'full' when no more open reminders fit. */
  onSubmit: (input: ReminderInput) => Promise<'ok' | 'full' | void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function initialDay(initial: Reminder | null, today: string): DayChoice {
  if (!initial || initial.day === today) return 'today'
  if (initial.day === tomorrowOf(today)) return 'tomorrow'
  return 'pick'
}

function choiceClass(on: boolean): string {
  return `btn reminder-choice ${on ? 'btn-primary' : 'btn-secondary'}`
}

export function ReminderForm({ initial, today, saving, error, onSubmit, onDelete, onCancel }: ReminderFormProps) {
  const { locale, t } = useLocale()
  const [parts] = useState(readPartTimes)
  const [text, setText] = useState(initial?.text ?? '')
  const [dayChoice, setDayChoice] = useState<DayChoice>(() => initialDay(initial, today))
  const [pickedDay, setPickedDay] = useState(initial?.day ?? tomorrowOf(today))
  const [timeChoice, setTimeChoice] = useState<TimeChoice>(() =>
    partOfTime(initial?.hour ?? null, initial?.minute ?? null, parts),
  )
  const [pickedTime, setPickedTime] = useState(
    initial?.hour != null ? `${pad(initial.hour)}:${pad(initial.minute ?? 0)}` : '10:00',
  )
  const [remindBefore, setRemindBefore] = useState(initial?.remindBefore ?? false)
  const [kind, setKind] = useState<ReminderKind | null>(initial?.kind ?? null)
  const [everyYear, setEveryYear] = useState(initial?.everyYear ?? false)
  const [issue, setIssue] = useState<ReminderIssue | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const canRemindBefore = resolvedDay() > today
  const dayBeforeOn = canRemindBefore && remindBefore

  function resolvedDay(): string {
    if (dayChoice === 'today') return today
    if (dayChoice === 'tomorrow') return tomorrowOf(today)
    return pickedDay
  }

  function resolvedTime(): { hour: number | null; minute: number | null } {
    if (timeChoice === 'any') return { hour: null, minute: null }
    if (timeChoice === 'pick') {
      const match = /^(\d{2}):(\d{2})$/.exec(pickedTime)
      if (!match) return { hour: null, minute: null }
      return { hour: Number(match[1]), minute: Number(match[2]) }
    }
    return parts[timeChoice]
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const input: ReminderInput = {
      text,
      day: resolvedDay(),
      ...resolvedTime(),
      remindBefore: dayBeforeOn,
      kind: kind ?? 'other',
      everyYear,
    }
    const nextIssue = validateReminder(input)
    setIssue(nextIssue)
    if (nextIssue) return
    const result = await onSubmit(input)
    if (result === 'full') setIssue('full')
  }

  const issueText =
    issue === 'text'
      ? t('reminders.needText')
      : issue === 'day'
        ? t('reminders.needDay')
        : issue === 'full'
          ? t('reminders.full')
          : null

  return (
    <form className="activity-form reminder-form" noValidate onSubmit={(event) => void submit(event)}>
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onCancel}>
        <Icon name="back" />
        {t('reminders.back')}
      </button>
      <h2 className="form-title">{initial ? t('reminders.edit') : t('reminders.new')}</h2>

      <label className="field">
        <span className="reminder-question">{t('reminders.what')}</span>
        <textarea
          className="field-input reminder-text"
          value={text}
          rows={1}
          maxLength={REMINDER_TEXT_MAX}
          placeholder={t('reminders.placeholder')}
          onChange={(event) => {
            setText(event.target.value)
            if (issue === 'text') setIssue(null)
          }}
        />
      </label>

      <p className="reminder-question">{t('reminders.kind')}</p>
      <div className="reminder-kinds">
        {REMINDER_KINDS.map((choice) => (
          <button
            key={choice}
            type="button"
            className={`${choiceClass(kind === choice)} reminder-kind`}
            aria-pressed={kind === choice}
            onClick={() => setKind((current) => (current === choice ? null : choice))}
          >
            <ReminderKindMark kind={choice} />
            {t(`reminders.kinds.${choice}`)}
          </button>
        ))}
      </div>

      <p className="reminder-question">{t('reminders.day')}</p>
      <div className="reminder-choices">
        {(['today', 'tomorrow', 'pick'] as const).map((choice) => (
          <button
            key={choice}
            type="button"
            className={choiceClass(dayChoice === choice)}
            aria-pressed={dayChoice === choice}
            onClick={() => setDayChoice(choice)}
          >
            {t(choice === 'pick' ? 'reminders.pickDate' : `reminders.${choice}`)}
          </button>
        ))}
      </div>
      {dayChoice === 'pick' && (
        <input
          className="field-input"
          type="date"
          min={today}
          value={pickedDay}
          aria-label={t('reminders.pickDate')}
          onChange={(event) => setPickedDay(event.target.value)}
        />
      )}

      <label className="reminder-switch">
        <input type="checkbox" checked={everyYear} onChange={(event) => setEveryYear(event.target.checked)} />
        <span>
          {t('reminders.everyYear')}
          <span className="reminder-switch-hint">{t('reminders.everyYearHint')}</span>
        </span>
      </label>

      <p className="reminder-question">{t('reminders.time')}</p>
      <div className="reminder-choices">
        <button
          type="button"
          className={choiceClass(timeChoice === 'any')}
          aria-pressed={timeChoice === 'any'}
          onClick={() => setTimeChoice('any')}
        >
          {t('reminders.anyTime')}
        </button>
        {REMINDER_PARTS.map((part) => (
          <button
            key={part}
            type="button"
            className={choiceClass(timeChoice === part)}
            aria-pressed={timeChoice === part}
            aria-label={`${t(`reminders.${part}`)} ${formatReminderTime(parts[part].hour, parts[part].minute, locale)}`}
            onClick={() => setTimeChoice(part)}
          >
            {formatShortReminderTime(parts[part].hour, parts[part].minute, locale)}
          </button>
        ))}
        <button
          type="button"
          className={choiceClass(timeChoice === 'pick')}
          aria-pressed={timeChoice === 'pick'}
          onClick={() => setTimeChoice('pick')}
        >
          {t('reminders.pickTime')}
        </button>
      </div>
      {timeChoice === 'pick' && (
        <input
          className="field-input"
          type="time"
          value={pickedTime}
          aria-label={t('reminders.pickTime')}
          onChange={(event) => setPickedTime(event.target.value)}
        />
      )}

      {canRemindBefore && (
        <label className="reminder-switch">
          <input
            type="checkbox"
            checked={remindBefore}
            onChange={(event) => setRemindBefore(event.target.checked)}
          />
          <span>
            {t('reminders.dayBefore')}
            <span className="reminder-switch-hint">
              {t('reminders.dayBeforeHint', {
                time: formatReminderTime(parts.evening.hour, parts.evening.minute, locale),
              })}
            </span>
          </span>
        </label>
      )}

      {!Capacitor.isNativePlatform() && (timeChoice !== 'any' || dayBeforeOn) && (
        <p className="reminder-switch-hint">{t('reminders.alertsAppOnly')}</p>
      )}

      {(issueText || error) && <p className="error">{issueText || error}</p>}

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? t('reminders.saving') : t('reminders.save')}
      </button>

      {onDelete && !confirmDelete && (
        <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
          {t('reminders.delete')}
        </button>
      )}
      {onDelete && confirmDelete && (
        <div className="reminder-delete">
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setConfirmDelete(false)}>
            {t('reminders.keep')}
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void onDelete()}>
            {t('reminders.deleteForever')}
          </button>
        </div>
      )}
    </form>
  )
}

interface ReminderEditorProps {
  reminderId?: string
  reminders: Reminder[]
  today: string
  loading: boolean
  saving: boolean
  error: string | null
  onSubmit: (input: ReminderInput) => Promise<'ok' | 'full' | void>
  onDelete: (reminder: Reminder) => Promise<void>
  onCancel: () => void
}

/** Add or edit, and the not-found state when an old link points nowhere. */
export function ReminderEditor({
  reminderId,
  reminders,
  today,
  loading,
  saving,
  error,
  onSubmit,
  onDelete,
  onCancel,
}: ReminderEditorProps) {
  const { t } = useLocale()
  const reminder = reminderId ? (reminders.find((item) => item.id === reminderId) ?? null) : null

  if (reminderId && !reminder) {
    if (loading) return <p className="muted-center">{t('reminders.loading')}</p>
    return (
      <section className="empty-state">
        <p>{error ?? t('reminders.notFound')}</p>
        <button type="button" className="btn btn-primary" onClick={onCancel}>
          {t('reminders.back')}
        </button>
      </section>
    )
  }

  return (
    <ReminderForm
      key={reminder?.id ?? 'new'}
      initial={reminder}
      today={today}
      saving={saving}
      error={error}
      onSubmit={onSubmit}
      onDelete={reminder ? () => onDelete(reminder) : undefined}
      onCancel={onCancel}
    />
  )
}
