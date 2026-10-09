import { useState, type FormEvent, type ReactNode } from 'react'
import { useLocale } from '../hooks/useLocale'
import {
  REMINDER_KINDS,
  REMINDER_PARTS,
  REMINDER_TEXT_MAX,
  formatReminderTime,
  formatShortReminderTime,
  isSharedEventGone,
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
import { formatSharedWhen } from '../lib/sharedEvents'
import { AppAlertsNote } from './AppAlertsNote'
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
  onCancel: () => void
  /** Starting values for a new reminder. */
  prefill?: ReminderInput
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

function initialDay(initial: Pick<Reminder, 'day'> | null, today: string): DayChoice {
  if (!initial || initial.day === today) return 'today'
  if (initial.day === tomorrowOf(today)) return 'tomorrow'
  return 'pick'
}

function choiceClass(on: boolean): string {
  return `btn reminder-choice ${on ? 'btn-primary' : 'btn-secondary'}`
}

export function ReminderForm({
  initial,
  today,
  saving,
  error,
  onSubmit,
  onCancel,
  prefill,
}: ReminderFormProps) {
  const { locale, t } = useLocale()
  const seed = initial ?? prefill ?? null
  const seedDay = initial ?? (prefill && prefill.day >= today ? prefill : null)
  const [parts] = useState(readPartTimes)
  const [text, setText] = useState(seed?.text ?? '')
  const [dayChoice, setDayChoice] = useState<DayChoice>(() => initialDay(seedDay, today))
  const [pickedDay, setPickedDay] = useState(seedDay?.day ?? tomorrowOf(today))
  const [timeChoice, setTimeChoice] = useState<TimeChoice>(() =>
    partOfTime(seed?.hour ?? null, seed?.minute ?? null, parts),
  )
  const [pickedTime, setPickedTime] = useState(
    seed?.hour != null ? `${pad(seed.hour)}:${pad(seed.minute ?? 0)}` : '10:00',
  )
  const [remindBefore, setRemindBefore] = useState(seed?.remindBefore ?? false)
  const [kind, setKind] = useState<ReminderKind | null>(seed?.kind ?? null)
  const [everyYear, setEveryYear] = useState(initial?.everyYear ?? false)
  const [issue, setIssue] = useState<ReminderIssue | null>(null)
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

      <fieldset className="reminder-fields">
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
              className={`reminder-kind${kind === choice ? ' is-selected' : ''}`}
              aria-pressed={kind === choice}
              onClick={() => setKind((current) => (current === choice ? null : choice))}
            >
              <ReminderKindMark kind={choice} />
              <span className="reminder-kind-label">{t(`reminders.kinds.${choice}`)}</span>
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
      </fieldset>

      {(timeChoice !== 'any' || dayBeforeOn) && <AppAlertsNote where="reminder" />}

      {(issueText || error) && <p className="error">{issueText || error}</p>}

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? t('reminders.saving') : t('reminders.save')}
      </button>
    </form>
  )
}

function DeleteReminder({ saving, onDelete }: { saving: boolean; onDelete: () => Promise<void> }) {
  const { t } = useLocale()
  const [confirm, setConfirm] = useState(false)
  if (!confirm) {
    return (
      <button type="button" className="btn btn-ghost" onClick={() => setConfirm(true)}>
        {t('reminders.delete')}
      </button>
    )
  }
  return (
    <div className="reminder-delete">
      <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setConfirm(false)}>
        {t('reminders.keep')}
      </button>
      <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void onDelete()}>
        {t('reminders.deleteForever')}
      </button>
    </div>
  )
}

interface ReminderViewProps {
  reminder: Reminder
  saving: boolean
  error: string | null
  onDelete: () => Promise<void>
  onCancel: () => void
  onEdit?: () => void
  share?: ReactNode
  onAlertOff?: (alertOff: boolean) => void
}

/**
 * One reminder: what and when, then Edit (or the lock line once shared), sharing, and delete.
 * Editing is its own screen, so a share never goes out with unsaved changes.
 */
function ReminderView({ reminder, saving, error, onDelete, onCancel, onEdit, share, onAlertOff }: ReminderViewProps) {
  const { locale, t } = useLocale()
  const shared = Boolean(reminder.sharedEventId)
  const gone = isSharedEventGone(reminder)
  const alerts = reminder.hour != null || reminder.remindBefore
  const when = [
    formatSharedWhen(reminder, locale),
    reminder.everyYear ? t('reminders.everyYear') : null,
    reminder.remindBefore ? t('reminders.dayBeforeShort') : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="activity-form reminder-form reminder-view">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onCancel}>
        <Icon name="back" />
        {t('reminders.back')}
      </button>
      <h2 className="form-title">{t(shared ? 'sharedEvent.lockedTitle' : 'reminders.viewTitle')}</h2>

      <div className="reminder-summary">
        <ReminderKindMark kind={reminder.kind} />
        <div className="reminder-summary-body">
          <p className="reminder-summary-text">{reminder.text}</p>
          <p className="reminder-summary-when">{when}</p>
          {gone && (
            <p className="reminder-shared-gone">
              {t(reminder.sharedStatus === 'cancelled' ? 'sharedEvent.cancelledLine' : 'sharedEvent.switchedOffLine')}
            </p>
          )}
        </div>
        {!shared && onEdit && (
          <button type="button" className="btn btn-secondary btn-sm reminder-summary-edit" onClick={onEdit}>
            {t('reminders.editShort')}
          </button>
        )}
      </div>

      {shared && (
        <p className="reminder-locked">
          <Icon name="lock" size={20} />
          <span>{t('sharedEvent.locked')}</span>
        </p>
      )}

      {shared && !gone && alerts && onAlertOff && (
        <label className="reminder-switch">
          <input
            type="checkbox"
            checked={!reminder.alertOff}
            onChange={(event) => onAlertOff(!event.target.checked)}
          />
          <span>
            {t('sharedEvent.alertMe')}
            <span className="reminder-switch-hint">{t('sharedEvent.alertMeHint')}</span>
          </span>
        </label>
      )}

      {error && <p className="error">{error}</p>}

      {share}

      <DeleteReminder saving={saving} onDelete={onDelete} />
    </div>
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
  shareFor?: (reminder: Reminder) => ReactNode
  prefill?: ReminderInput
  onAlertOff?: (reminder: Reminder, alertOff: boolean) => void
  /** The edit screen for reminderId, rather than its view. */
  editing?: boolean
  onEdit?: (reminder: Reminder) => void
}

/** A reminder's view, its edit screen, the add screen, and the not-found state when an old link points nowhere. */
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
  shareFor,
  prefill,
  onAlertOff,
  editing = false,
  onEdit,
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

  if (reminder && (!editing || reminder.sharedEventId)) {
    return (
      <ReminderView
        key={reminder.id}
        reminder={reminder}
        saving={saving}
        error={error}
        onDelete={() => onDelete(reminder)}
        onCancel={onCancel}
        onEdit={onEdit ? () => onEdit(reminder) : undefined}
        share={shareFor ? shareFor(reminder) : undefined}
        onAlertOff={onAlertOff ? (alertOff) => onAlertOff(reminder, alertOff) : undefined}
      />
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
      onCancel={onCancel}
      prefill={reminder ? undefined : prefill}
    />
  )
}
