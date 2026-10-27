import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { addDays } from '../lib/dates'
import { LIST_PHOTO_SIDE, reminderPhotoSrc } from '../lib/eventPhotoUrl'
import { prepareReminderPhoto } from '../lib/reminderPhotos'
import { useLocale } from '../hooks/useLocale'
import { localeTag, type Locale } from '../lib/i18n'
import {
  REMINDER_REPEATS,
  clampRepeatUntil,
  defaultRepeatUntil,
  effectiveReminder,
  repeatLimit,
  repeatSummary,
  type ReminderRepeat,
} from '../lib/reminderRepeat'
import {
  REMINDER_KINDS,
  REMINDER_DESCRIPTION_MAX,
  REMINDER_PARTS,
  REMINDER_TEXT_MAX,
  cleanReminderDescription,
  formatReminderTime,
  formatShortReminderTime,
  isFollowedListReminder,
  reminderListKind,
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
  type ReminderPhoto,
} from '../lib/reminderSchedule'
import { formatSharedWhen } from '../lib/sharedEvents'
import { AppAlertsNote } from './AppAlertsNote'
import { Icon } from './Icon'
import { EventPhoto, ReminderKindMark } from './ReminderKindIcon'

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
  /** A meetup asks for the same details, then the next screen is its link. */
  meetup?: boolean
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

/** Opens the browser's own date or time picker. Returns false when this browser will not. */
function openNativePicker(input: HTMLInputElement | null): boolean {
  if (!input || typeof input.showPicker !== 'function') return false
  try {
    input.showPicker()
    return true
  } catch {
    return false
  }
}

function pickedClock(value: string, locale: Parameters<typeof formatReminderTime>[2]): string {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return ''
  return formatReminderTime(Number(match[1]), Number(match[2]), locale)
}

function pickedDayLabel(day: string, locale: Locale): string {
  const [year, month, date] = day.split('-').map(Number)
  if (!year || !month || !date) return day
  return new Date(year, month - 1, date).toLocaleDateString(localeTag(locale), { month: 'short', day: 'numeric' })
}

export function ReminderForm({
  initial,
  today,
  saving,
  error,
  onSubmit,
  onCancel,
  prefill,
  meetup = false,
}: ReminderFormProps) {
  const { locale, t } = useLocale()
  const seed = initial ?? prefill ?? null
  const seedDay = initial ?? (prefill && prefill.day >= today ? prefill : null)
  const [parts] = useState(readPartTimes)
  const [text, setText] = useState(seed?.text ?? '')
  const [description, setDescription] = useState(seed?.description ?? '')
  /** Missing until the person picks or removes a photo, so an edit leaves the stored one alone. */
  const [photo, setPhoto] = useState<ReminderPhoto | null | undefined>(undefined)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const currentPhoto = photo === undefined ? (initial ? reminderPhotoSrc(initial) : null) : (photo?.dataUrl ?? null)
  const [dayChoice, setDayChoice] = useState<DayChoice>(() => initialDay(seedDay, today))
  const [pickedDay, setPickedDay] = useState(seedDay?.day ?? tomorrowOf(today))
  const [timeChoice, setTimeChoice] = useState<TimeChoice>(() =>
    partOfTime(seed?.hour ?? null, seed?.minute ?? null, parts),
  )
  const [pickedTime, setPickedTime] = useState(
    seed?.hour != null ? `${pad(seed.hour)}:${pad(seed.minute ?? 0)}` : '10:00',
  )
  const [remindBefore, setRemindBefore] = useState(seed?.remindBefore ?? false)
  const [remindWeekBefore, setRemindWeekBefore] = useState(seed?.remindWeekBefore ?? false)
  const [kind, setKind] = useState<ReminderKind | null>(seed?.kind ?? (meetup ? 'event' : null))
  const [everyYear, setEveryYear] = useState(initial?.everyYear ?? false)
  const [repeat, setRepeat] = useState<ReminderRepeat | null>(initial?.repeat ?? null)
  /** Missing until the person picks an end date, so it follows the first day until then. */
  const [pickedUntil, setPickedUntil] = useState<string | null>(initial?.repeatUntil ?? null)
  const [issue, setIssue] = useState<ReminderIssue | null>(null)
  const [more, setMore] = useState(
    () =>
      Boolean(cleanReminderDescription(seed?.description)) ||
      Boolean(initial && reminderPhotoSrc(initial)) ||
      (seed?.kind != null && seed.kind !== 'other') ||
      Boolean(seed?.everyYear) ||
      Boolean(initial?.repeat) ||
      Boolean(seed?.remindBefore) ||
      Boolean(seed?.remindWeekBefore),
  )
  const [manualDate, setManualDate] = useState(false)
  const [manualTime, setManualTime] = useState(false)
  const dateInput = useRef<HTMLInputElement>(null)
  const timeInput = useRef<HTMLInputElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const photoChosen = Boolean(currentPhoto)
  const repeating = repeat !== null
  const canRemindBefore = resolvedDay() > today && !repeating
  const dayBeforeOn = canRemindBefore && remindBefore
  /** A week ahead only makes sense when that evening has not passed. */
  const canRemindWeekBefore = !repeating && resolvedDay() >= addDays(today, 7)
  const weekBeforeOn = canRemindWeekBefore && remindWeekBefore
  /** Keeps the original first day, so editing a repeat cannot stretch its two months. */
  const repeatFrom = initial?.repeat && initial.repeatFrom && resolvedDay() === initial.day ? initial.repeatFrom : resolvedDay()
  const repeatUntil = clampRepeatUntil(repeatFrom, pickedUntil ?? defaultRepeatUntil(repeatFrom))

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
      description: cleanReminderDescription(description),
      ...(photo !== undefined ? { photo } : {}),
      day: resolvedDay(),
      ...resolvedTime(),
      remindBefore: dayBeforeOn,
      remindWeekBefore: meetup ? false : weekBeforeOn,
      kind: meetup ? (kind ?? 'event') : (kind ?? 'other'),
      everyYear: meetup ? false : everyYear && !repeating,
      ...(!meetup && repeat
        ? {
            repeat,
            repeatUntil,
            repeatFrom,
            lastDoneOn: initial?.lastDoneOn ?? null,
          }
        : {}),
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
        : issue === 'repeat'
          ? t('reminders.needRepeatEnd')
          : issue === 'full'
            ? t('reminders.full')
            : null

  return (
    <form className="activity-form reminder-form" noValidate onSubmit={(event) => void submit(event)}>
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onCancel}>
        <Icon name="back" />
        {t('reminders.back')}
      </button>
      <h2 className="form-title">
        {meetup && !initial ? t('reminders.meetupTitle') : initial ? t('reminders.edit') : t('reminders.new')}
      </h2>
      {meetup && !initial && <p className="screen-sub">{t('reminders.meetupHint')}</p>}

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

        <p className="reminder-question">{t('reminders.day')}</p>
        <div className="reminder-choices">
          {(['today', 'tomorrow', 'pick'] as const).map((choice) => (
            <button
              key={choice}
              type="button"
              className={choiceClass(dayChoice === choice)}
              aria-pressed={dayChoice === choice}
              onClick={() => {
                if (choice !== 'pick') {
                  setDayChoice(choice)
                  return
                }
                if (!openNativePicker(dateInput.current)) {
                  setDayChoice('pick')
                  setManualDate(true)
                }
              }}
            >
              {choice === 'pick' && dayChoice === 'pick'
                ? pickedDayLabel(pickedDay, locale)
                : t(choice === 'pick' ? 'reminders.pickDate' : `reminders.${choice}`)}
            </button>
          ))}
        </div>
        <input
          ref={dateInput}
          className="picker-proxy"
          type="date"
          min={today}
          value={pickedDay}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            if (!event.target.value) return
            setPickedDay(event.target.value)
            setDayChoice('pick')
          }}
        />
        {manualDate && dayChoice === 'pick' && (
          <input
            className="field-input"
            type="date"
            min={today}
            value={pickedDay}
            aria-label={t('reminders.pickDate')}
            onChange={(event) => setPickedDay(event.target.value)}
            onClick={(event) => {
              openNativePicker(event.currentTarget)
            }}
          />
        )}

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
            onClick={() => {
              if (!openNativePicker(timeInput.current)) {
                setTimeChoice('pick')
                setManualTime(true)
              }
            }}
          >
            {timeChoice === 'pick' ? pickedClock(pickedTime, locale) || t('reminders.pickTime') : t('reminders.pickTime')}
          </button>
        </div>
        <input
          ref={timeInput}
          className="picker-proxy"
          type="time"
          value={pickedTime}
          tabIndex={-1}
          aria-hidden="true"
          onChange={(event) => {
            if (!event.target.value) return
            setPickedTime(event.target.value)
            setTimeChoice('pick')
          }}
        />
        {manualTime && timeChoice === 'pick' && (
          <input
            className="field-input"
            type="time"
            value={pickedTime}
            aria-label={t('reminders.pickTime')}
            onChange={(event) => setPickedTime(event.target.value)}
            onClick={(event) => {
              openNativePicker(event.currentTarget)
            }}
          />
        )}

        <button
          type="button"
          className="btn btn-ghost reminder-more"
          aria-expanded={more}
          onClick={() => setMore((open) => !open)}
        >
          {more ? t('reminders.less') : t('reminders.more')}
        </button>

        {more && (
          <>
            <label className="field">
              <span className="reminder-question">{t('reminders.description')}</span>
              <textarea
                className="field-input reminder-description-input"
                value={description}
                rows={3}
                maxLength={REMINDER_DESCRIPTION_MAX}
                placeholder={t('reminders.descriptionPlaceholder')}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            <p className="reminder-question">{t('reminders.kind')}</p>
            <div className="reminder-kinds">
              {REMINDER_KINDS.map((choice) => (
                <button
                  key={choice}
                  type="button"
                  className={`reminder-kind${!photoChosen && kind === choice ? ' is-selected' : ''}`}
                  aria-pressed={!photoChosen && kind === choice}
                  onClick={() => {
                    setPhoto(null)
                    setPhotoFailed(false)
                    setKind((current) => (photoChosen || current !== choice ? choice : null))
                  }}
                >
                  <ReminderKindMark kind={choice} />
                  <span className="reminder-kind-label">{t(`reminders.kinds.${choice}`)}</span>
                </button>
              ))}
              <button
                type="button"
                className={`reminder-kind reminder-kind-own${photoChosen ? ' is-selected' : ''}`}
                aria-pressed={photoChosen}
                disabled={photoBusy}
                onClick={() => photoInput.current?.click()}
              >
                {currentPhoto ? (
                  <img className="reminder-kind-photo" src={currentPhoto} alt="" />
                ) : (
                  <span className="reminder-kind-photo reminder-kind-photo-empty" aria-hidden="true">
                    <Icon name="photo" />
                  </span>
                )}
                <span className="reminder-kind-label reminder-kind-label-wrap">
                  {photoBusy ? t('reminders.photoReading') : t('reminders.addPhoto')}
                </span>
              </button>
            </div>
            <input
              ref={photoInput}
              className="photo-pick-input"
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden="true"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file || !file.type.startsWith('image/')) return
                setPhotoBusy(true)
                setPhotoFailed(false)
                void prepareReminderPhoto(file)
                  .then((next) => {
                    setPhoto(next)
                    setKind(null)
                  })
                  .catch(() => setPhotoFailed(true))
                  .finally(() => setPhotoBusy(false))
              }}
            />
            {photoChosen && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                disabled={photoBusy}
                onClick={() => {
                  setPhoto(null)
                  setPhotoFailed(false)
                }}
              >
                {t('sharedEvent.removePhoto')}
              </button>
            )}
            {photoFailed && <p className="error">{t('reminders.photoFailed')}</p>}
            <p className="reminder-switch-hint">{t('reminders.photoHint')}</p>

            {!meetup && !repeating && (
              <label className="reminder-switch">
                <input type="checkbox" checked={everyYear} onChange={(event) => setEveryYear(event.target.checked)} />
                <span>
                  {t('reminders.everyYear')}
                  <span className="reminder-switch-hint">{t('reminders.everyYearHint')}</span>
                </span>
              </label>
            )}

            {!meetup && !everyYear && (
              <>
                <p className="reminder-question">{t('reminders.repeat')}</p>
                <div className="reminder-choices">
                  <button
                    type="button"
                    className={choiceClass(repeat === null)}
                    aria-pressed={repeat === null}
                    onClick={() => setRepeat(null)}
                  >
                    {t('reminders.repeatNone')}
                  </button>
                  {REMINDER_REPEATS.map((choice) => (
                    <button
                      key={choice}
                      type="button"
                      className={choiceClass(repeat === choice)}
                      aria-pressed={repeat === choice}
                      onClick={() => setRepeat(choice)}
                    >
                      {t(choice === 'week' ? 'reminders.repeatWeek' : 'reminders.repeatDay')}
                    </button>
                  ))}
                </div>
                {repeat && (
                  <label className="field">
                    <span className="reminder-question">{t('reminders.repeatUntil')}</span>
                    <input
                      className="field-input"
                      type="date"
                      min={repeatFrom}
                      max={repeatLimit(repeatFrom)}
                      value={repeatUntil}
                      onClick={(event) => {
                        openNativePicker(event.currentTarget)
                      }}
                      onChange={(event) => {
                        setPickedUntil(event.target.value || null)
                        if (issue === 'repeat') setIssue(null)
                      }}
                    />
                    <span className="reminder-switch-hint">{t('reminders.repeatUntilHint')}</span>
                  </label>
                )}
              </>
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

            {canRemindWeekBefore && !meetup && (
              <label className="reminder-switch">
                <input
                  type="checkbox"
                  checked={remindWeekBefore}
                  onChange={(event) => setRemindWeekBefore(event.target.checked)}
                />
                <span>
                  {t('reminders.weekBefore')}
                  <span className="reminder-switch-hint">
                    {t('reminders.weekBeforeHint', {
                      time: formatReminderTime(parts.evening.hour, parts.evening.minute, locale),
                    })}
                  </span>
                </span>
              </label>
            )}
          </>
        )}
      </fieldset>

      {(timeChoice !== 'any' || dayBeforeOn || weekBeforeOn) && <AppAlertsNote where="reminder" />}

      {(issueText || error) && <p className="error">{issueText || error}</p>}

      <button type="submit" className="btn btn-primary" disabled={saving || photoBusy}>
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
  const followed = isFollowedListReminder(reminder)
  const holidayList = reminderListKind(reminder) === 'holiday'
  const organizerMeetup = Boolean(reminder.meetup && reminder.sharedByMe)
  const locked = (shared && !organizerMeetup) || followed
  const gone = isSharedEventGone(reminder)
  const alerts = reminder.hour != null || reminder.remindBefore || reminder.remindWeekBefore
  const when = [
    formatSharedWhen(reminder, locale),
    reminder.everyYear ? t('reminders.everyYear') : null,
    repeatSummary(reminder, locale, t),
    reminder.remindWeekBefore ? t('reminders.weekBeforeShort') : null,
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
      <h2 className="form-title">
          {t(
            followed
              ? holidayList
                ? 'reminders.listLockedHolidayTitle'
                : 'reminders.listLockedTitle'
              : organizerMeetup
                ? 'reminders.meetupTitle'
                : shared
                  ? 'sharedEvent.lockedTitle'
                  : 'reminders.viewTitle',
          )}
      </h2>

      <EventPhoto src={reminderPhotoSrc(reminder)} alt={t('sharedEvent.photoAlt')} />

      <div className="reminder-summary">
        <ReminderKindMark kind={reminder.kind} photo={reminderPhotoSrc(reminder, LIST_PHOTO_SIDE)} />
        <div className="reminder-summary-body">
          <p className="reminder-summary-text">{reminder.text}</p>
          <p className="reminder-summary-when">{when}</p>
          {reminder.description && <p className="reminder-description">{reminder.description}</p>}
          {gone && (
            <p className="reminder-shared-gone">
              {t(reminder.sharedStatus === 'cancelled' ? 'sharedEvent.cancelledLine' : 'sharedEvent.switchedOffLine')}
            </p>
          )}
        </div>
        {!locked && onEdit && (
          <button type="button" className="btn btn-secondary btn-sm reminder-summary-edit" onClick={onEdit}>
            {t('reminders.editShort')}
          </button>
        )}
      </div>

      {locked && (
        <p className="reminder-locked">
          <Icon name="lock" size={20} />
          <span>
            {t(followed ? (holidayList ? 'reminders.listLockedHoliday' : 'reminders.listLocked') : 'sharedEvent.locked')}
          </span>
        </p>
      )}

      {(locked || organizerMeetup) && !gone && alerts && onAlertOff && (
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

      {!followed && share}

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
  /** A new meetup: same details, then the link. */
  meetup?: boolean
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
  meetup = false,
}: ReminderEditorProps) {
  const { t } = useLocale()
  const stored = reminderId ? (reminders.find((item) => item.id === reminderId) ?? null) : null
  const reminder = stored ? effectiveReminder(stored, today) : null

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

  const organizerMeetup = Boolean(reminder?.meetup && reminder.sharedByMe)
  if (reminder && (!editing || (Boolean(reminder.sharedEventId) && !organizerMeetup) || isFollowedListReminder(reminder))) {
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
      meetup={meetup || organizerMeetup}
    />
  )
}
