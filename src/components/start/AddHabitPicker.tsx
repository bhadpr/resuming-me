import { useRef, useState } from 'react'
import { HABIT_GROUPS, templateById } from '../../data/activityTemplates'
import { CUSTOM_HABIT_ART, HABIT_ART } from '../../data/habitArt'
import { useLocale } from '../../hooks/useLocale'
import { useThemedArt } from '../../hooks/useThemedArt'
import { groupTitle, templateLabel } from '../../lib/catalogName'
import { isReminderPhotoData } from '../../lib/eventPhotoUrl'
import type { GuestActivity } from '../../lib/guestDraft'
import { WEEK_CADENCE, applyWeekCadence, weekCadenceOf, type WeekCadence } from '../../lib/onboardingFlow'
import { prepareReminderPhoto } from '../../lib/reminderPhotos'
import { HabitMark } from '../HabitMark'
import { Icon } from '../Icon'

/** Grouped habits. Each row opens to Daily or Once a week. */
export function AddHabitPicker({
  takenIds,
  openId,
  disabled,
  onToggle,
  onCadence,
}: {
  takenIds: ReadonlySet<string>
  openId: string | null
  disabled: boolean
  onToggle: (id: string) => void
  onCadence: (id: string, cadence: WeekCadence) => void
}) {
  const { t, locale } = useLocale()
  return (
    <div className="add-habit-groups">
      {HABIT_GROUPS.map((group) => {
        const ids = group.ids.filter((id) => templateById(id) && !takenIds.has(id))
        if (ids.length === 0) return null
        return (
          <section key={group.title} className="habit-group">
            <h2 className="habit-group-title">{groupTitle(group.title, locale)}</h2>
            <div className="add-habit-list">
              {ids.map((id) => {
                const open = openId === id
                return (
                  <div key={id} className={`add-habit-item${open ? ' is-open' : ''}`}>
                    <button
                      type="button"
                      className="add-habit-toggle"
                      aria-expanded={open}
                      disabled={disabled}
                      onClick={() => onToggle(id)}
                    >
                      <HabitMark templateId={id} />
                      <span className="add-habit-name">{templateLabel(id, locale)}</span>
                      <Icon name="chevron" className="add-habit-chevron" />
                    </button>
                    {open && (
                      <div
                        className="add-habit-body choice-grid choice-grid-cadence"
                        role="group"
                        aria-label={t('start.often')}
                      >
                        {WEEK_CADENCE.map((option) => (
                          <button
                            key={option.id}
                            type="button"
                            className="choice-tile choice-tile-stack"
                            onClick={() => onCadence(id, option.id)}
                          >
                            <span className="choice-tile-primary">
                              {option.id === 'daily' ? t('cadence.daily') : t('cadence.once')}
                            </span>
                            {option.secondary ? (
                              <span className="choice-tile-secondary">{t('cadence.week')}</span>
                            ) : null}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}

/** Icon and how often, for a habit the person named. */
export function CustomHabitSetup({
  habit,
  onChange,
  onBack,
  onContinue,
  continueLabel,
}: {
  habit: GuestActivity
  onChange: (habit: GuestActivity) => void
  onBack: () => void
  onContinue: () => void
  continueLabel: string
}) {
  const { t, locale } = useLocale()
  const themed = useThemedArt()
  const photoInput = useRef<HTMLInputElement>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const cadence = weekCadenceOf(habit)
  const photoChosen = isReminderPhotoData(habit.photo)
  return (
    <>
      <button type="button" className="btn btn-ghost start-back" onClick={onBack}>
        <Icon name="back" />
        {t('start.back')}
      </button>
      <h1 className="screen-heading">{habit.name}</h1>
      <p className="screen-sub">{t('start.pickIcon')}</p>
      <div className="reminder-kinds habit-icon-kinds" role="group" aria-label={t('start.pickIcon')}>
        {CUSTOM_HABIT_ART.map((id) => {
          const selected = !photoChosen && habit.icon === id
          const label = templateLabel(id, locale) ?? id
          return (
            <button
              key={id}
              type="button"
              className={`reminder-kind${selected ? ' is-selected' : ''}`}
              aria-pressed={selected}
              aria-label={label}
              onClick={() =>
                onChange({
                  ...habit,
                  icon: id,
                  photo: null,
                  emoji: templateById(id)?.emoji ?? habit.emoji,
                })
              }
            >
              <span className="activity-emoji activity-emoji-art reminder-mark" aria-hidden>
                <img src={themed(HABIT_ART[id])} alt="" />
              </span>
              <span className="reminder-kind-label">{label}</span>
            </button>
          )
        })}
        <button
          type="button"
          className={`reminder-kind reminder-kind-own${photoChosen ? ' is-selected' : ''}`}
          aria-pressed={photoChosen}
          disabled={photoBusy}
          onClick={() => photoInput.current?.click()}
        >
          {photoChosen ? (
            <img className="reminder-kind-photo" src={habit.photo ?? ''} alt="" />
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
              if (!isReminderPhotoData(next.dataUrl)) {
                setPhotoFailed(true)
                return
              }
              onChange({ ...habit, photo: next.dataUrl })
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
            setPhotoFailed(false)
            onChange({ ...habit, photo: null })
          }}
        >
          {t('sharedEvent.removePhoto')}
        </button>
      )}
      {photoFailed && <p className="error">{t('reminders.photoFailed')}</p>}
      <span className="field-label habit-often">{t('start.often')}</span>
      <div className="choice-grid choice-grid-cadence" role="group" aria-label={t('start.often')}>
        {WEEK_CADENCE.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`choice-tile choice-tile-stack${cadence === option.id ? ' choice-tile-selected' : ''}`}
            aria-pressed={cadence === option.id}
            onClick={() => onChange(applyWeekCadence(habit, option.id))}
          >
            <span className="choice-tile-primary">
              {option.id === 'daily' ? t('cadence.daily') : t('cadence.once')}
            </span>
            {option.secondary ? <span className="choice-tile-secondary">{t('cadence.week')}</span> : null}
          </button>
        ))}
      </div>
      <button type="button" className="btn btn-primary" onClick={onContinue}>
        {continueLabel}
      </button>
    </>
  )
}
