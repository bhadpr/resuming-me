import { useEffect, useState, type FormEvent } from 'react'
import { ayurvedicSuggestions } from '../data/ayurvedicMedicines'
import { medicineFallbackSrc, weekdayName } from '../lib/medicineFormat'
import {
  MAX_MEDICINE_NAME,
  MEDICINE_SYSTEMS,
  mealOf,
  validateMedicineInput,
  type ClockTime,
  type MealRelation,
  type MedicineInputIssue,
  type MedicineSystem,
} from '../lib/medicineSchedule'
import { compressBottlePhoto, type MedicineInput, type MedicineRecord } from '../lib/medicines'
import { useLocale } from '../hooks/useLocale'
import { useNavigate } from 'react-router-dom'
import { AppAlertsNote } from './AppAlertsNote'
import { Icon } from './Icon'

interface MedicineFormProps {
  initial: MedicineRecord | null
  saving: boolean
  error: string | null
  onSubmit: (input: MedicineInput) => Promise<void>
  onDelete?: () => Promise<void>
  onCancel: () => void
}

function padTime(time: ClockTime): string {
  return `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`
}

function parseClock(value: string): ClockTime | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]
const WEEK_FROM_MONDAY = [1, 2, 3, 4, 5, 6, 0]
const DOSE_COUNTS = [1, 2, 3] as const
const MEALS = ['before', 'after'] as const

type DoseCount = (typeof DOSE_COUNTS)[number]
type DayMode = 'daily' | 'pick'
type SlotLabel = 'time' | 'morning' | 'afternoon' | 'evening'

const COUNT_PARTS: Record<DoseCount, { id: string; hour: number; minute: number; label: SlotLabel }[]> = {
  1: [{ id: 'once', hour: 8, minute: 0, label: 'time' }],
  2: [
    { id: 'morning', hour: 8, minute: 0, label: 'morning' },
    { id: 'evening', hour: 20, minute: 0, label: 'evening' },
  ],
  3: [
    { id: 'morning', hour: 8, minute: 0, label: 'morning' },
    { id: 'afternoon', hour: 13, minute: 0, label: 'afternoon' },
    { id: 'evening', hour: 20, minute: 0, label: 'evening' },
  ],
}

type SlotDraft = {
  id: string
  label: SlotLabel
  time: string
  meal: MealRelation | null
}

function foodMeal(meal: MealRelation | null | undefined): MealRelation | null {
  return meal === 'before' || meal === 'after' ? meal : null
}

function slotsForCount(count: DoseCount, times: readonly ClockTime[] = []): SlotDraft[] {
  const sorted = [...times].sort((a, b) => a.hour - b.hour || a.minute - b.minute)
  return COUNT_PARTS[count].map((part, index) => {
    const time = sorted[index]
    return {
      id: part.id,
      label: part.label,
      time: time ? padTime(time) : padTime(part),
      meal: time ? foodMeal(mealOf(time)) : null,
    }
  })
}

function initialDoseCount(times: readonly ClockTime[]): DoseCount | null {
  return times.length === 1 || times.length === 2 || times.length === 3 ? times.length : null
}

function AyurvedicSuggestions({ query, onPick }: { query: string; onPick: (name: string) => void }) {
  const matches = ayurvedicSuggestions(query)
  const typed = query.trim().toLowerCase()
  const visible = matches.filter((item) => item.toLowerCase() !== typed)
  if (visible.length === 0) return null
  return (
    <ul className="medicine-suggest">
      {visible.map((item) => (
        <li key={item}>
          <button type="button" onClick={() => onPick(item)}>
            {item}
          </button>
        </li>
      ))}
    </ul>
  )
}

function choiceClass(on: boolean): string {
  return `btn medicine-choice ${on ? 'btn-primary' : 'btn-secondary'}`
}

export function MedicineForm({
  initial,
  saving,
  error,
  onSubmit,
  onDelete,
  onCancel,
}: MedicineFormProps) {
  const { locale, t } = useLocale()
  const [screen, setScreen] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<MedicineSystem | null>(initial?.system ?? null)
  const [dayMode, setDayMode] = useState<DayMode | null>(
    initial ? (initial.weekdays.length === 7 ? 'daily' : 'pick') : null,
  )
  const [pickedDays, setPickedDays] = useState<number[]>(
    initial && initial.weekdays.length < 7 ? initial.weekdays : [],
  )
  const [doseCount, setDoseCount] = useState<DoseCount | null>(() => initialDoseCount(initial?.times ?? []))
  const [slots, setSlots] = useState<SlotDraft[]>(() => {
    const count = initialDoseCount(initial?.times ?? [])
    return count ? slotsForCount(count, initial?.times ?? []) : []
  })
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(initial?.photoUrl ?? null)
  const [issue, setIssue] = useState<MedicineInputIssue | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  function toggleDay(day: number) {
    setPickedDays((current) =>
      current.includes(day) ? current.filter((item) => item !== day) : [...current, day].sort(),
    )
  }

  function goBack() {
    setIssue(null)
    if (screen === 1) onCancel()
    else setScreen(screen === 3 ? 2 : 1)
  }

  function goNext() {
    if (!name.trim()) {
      setIssue('name')
      return
    }
    if (name.trim().length > MAX_MEDICINE_NAME) {
      setIssue('name-long')
      return
    }
    if (!kind) {
      setIssue('kind')
      return
    }
    setIssue(null)
    setScreen(2)
  }

  function goTimes() {
    const days = dayMode === 'daily' ? ALL_DAYS : pickedDays
    if (dayMode == null || days.length === 0) {
      setIssue('days')
      return
    }
    setIssue(null)
    setScreen(3)
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (screen !== 3) {
      event.preventDefault()
      return
    }
    const savedDays = dayMode === 'daily' ? ALL_DAYS : pickedDays
    const parsed = doseCount == null
      ? []
      : slots.flatMap((slot) => {
          const clock = parseClock(slot.time)
          if (!clock) return []
          return [{ ...clock, meal: foodMeal(slot.meal) }]
        })
    const nextIssue = validateMedicineInput({ name, weekdays: savedDays, times: parsed })
    setIssue(nextIssue)
    if (nextIssue || !kind) {
      if (!kind) setIssue('kind')
      return
    }
    setPhotoError(null)
    let blob: Blob | null = null
    if (photo) {
      try {
        blob = await compressBottlePhoto(photo)
      } catch {
        setPhotoError(t('medicines.photoFailed'))
        setScreen(1)
        return
      }
    }
    await onSubmit({
      name,
      weekdays: savedDays,
      times: parsed,
      system: kind,
      photo: blob,
    })
  }

  const issueText =
    issue === 'name'
      ? t('medicines.needName')
      : issue === 'name-long'
        ? t('medicines.nameLong')
        : issue === 'days'
          ? t('medicines.needDay')
          : issue === 'times'
            ? t('medicines.needTime')
            : issue === 'kind'
              ? t('medicines.needKind')
              : null

  function chooseCount(count: DoseCount) {
    setDoseCount(count)
    setSlots((current) => {
      const next = slotsForCount(count)
      return next.map((slot, index) => current[index] ? { ...slot, time: current[index].time, meal: foodMeal(current[index].meal) } : slot)
    })
  }

  function setSlotTime(id: string, time: string) {
    setSlots((current) => current.map((slot) => (slot.id === id ? { ...slot, time } : slot)))
  }

  function setSlotMeal(id: string, meal: MealRelation) {
    setSlots((current) =>
      current.map((slot) => (slot.id === id ? { ...slot, meal: slot.meal === meal ? null : meal } : slot)),
    )
  }

  return (
    <form className="activity-form medicine-form" onSubmit={(event) => void submit(event)}>
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={goBack}>
        <Icon name="back" />
        {t('medicines.back')}
      </button>
      <h2 className="form-title">{initial ? t('medicines.edit') : t('medicines.new')}</h2>

      {screen === 1 && (
        <>
          <p className="medicine-question">{t('medicines.kind')}</p>
          <div className="medicine-choices medicine-kind">
            {MEDICINE_SYSTEMS.map((system) => (
              <button
                key={system}
                type="button"
                className={choiceClass(kind === system)}
                aria-pressed={kind === system}
                onClick={() => {
                  setKind(system)
                  setIssue(null)
                }}
              >
                {t(`medicines.${system}`)}
              </button>
            ))}
          </div>

          <label className="field">
            <span className="field-label">{t('medicines.name')}</span>
            <input
              className="field-input"
              value={name}
              maxLength={MAX_MEDICINE_NAME}
              placeholder={t('medicines.namePlaceholder')}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {kind === 'ayurvedic' && <AyurvedicSuggestions query={name} onPick={setName} />}

          <div className="field">
            <span className="field-label">{t('medicines.photo')}</span>
            {(preview || medicineFallbackSrc(kind)) && (
              <img className="medicine-preview" src={preview || medicineFallbackSrc(kind)!} alt="" />
            )}
            <label className="btn btn-secondary medicine-photo-pick">
              {preview ? t('medicines.photoChange') : t('medicines.photo')}
              <input
                type="file"
                accept="image/*"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null
                  setPhoto(file)
                  event.target.value = ''
                }}
              />
            </label>
          </div>
        </>
      )}

      {screen === 2 && (
        <>
          <p className="medicine-question">{t('medicines.whichDays')}</p>
          <div className="medicine-choices">
            <button
              type="button"
              className={choiceClass(dayMode === 'daily')}
              aria-pressed={dayMode === 'daily'}
              onClick={() => setDayMode('daily')}
            >
              {t('medicines.daily')}
            </button>
            <button
              type="button"
              className={choiceClass(dayMode === 'pick')}
              aria-pressed={dayMode === 'pick'}
              onClick={() => setDayMode('pick')}
            >
              {t('medicines.pickDays')}
            </button>
          </div>
          {dayMode === 'pick' && (
            <div className="medicine-days">
              {WEEK_FROM_MONDAY.map((day) => {
                const on = pickedDays.includes(day)
                return (
                  <button
                    key={day}
                    type="button"
                    className={`btn medicine-day ${on ? 'btn-primary' : 'btn-secondary'}`}
                    aria-pressed={on}
                    onClick={() => toggleDay(day)}
                  >
                    {weekdayName(day, locale)}
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {screen === 3 && (
        <>
          <p className="medicine-question">{t('medicines.howMany')}</p>
          <div className="medicine-choices">
            {DOSE_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                className={`${choiceClass(doseCount === count)} medicine-count`}
                aria-pressed={doseCount === count}
                onClick={() => chooseCount(count)}
              >
                {count}
              </button>
            ))}
          </div>
          {slots.map((slot) => (
            <div key={slot.id} className="medicine-part">
              <label className="medicine-part-head">
                <span className="medicine-question">
                  {slot.label === 'time' ? t('medicines.remindTimes') : t(`medicines.${slot.label}`)}
                </span>
                <input
                  className="field-input medicine-time"
                  type="time"
                  value={slot.time}
                  aria-label={slot.label === 'time' ? t('medicines.remindTimes') : t(`medicines.${slot.label}`)}
                  onChange={(event) => setSlotTime(slot.id, event.target.value)}
                />
              </label>
              <div className="medicine-choices">
                {MEALS.map((meal) => (
                  <button
                    key={meal}
                    type="button"
                    className={choiceClass(slot.meal === meal)}
                    aria-pressed={slot.meal === meal}
                    onClick={() => setSlotMeal(slot.id, meal)}
                  >
                    {t(meal === 'before' ? 'medicines.beforeFood' : 'medicines.afterFood')}
                  </button>
                ))}
              </div>
            </div>
          ))}
          <p className="medicine-reminder">{t('medicines.reminder')}</p>
          <AppAlertsNote where="medicine" />
        </>
      )}

      {(issueText || photoError || error) && <p className="error">{issueText || photoError || error}</p>}

      {screen === 1 && (
        <button type="button" className="btn btn-primary" onClick={goNext}>
          {t('medicines.continue')}
        </button>
      )}
      {screen === 2 && (
        <button type="button" className="btn btn-primary" onClick={goTimes}>
          {t('medicines.continue')}
        </button>
      )}
      {screen === 3 && (
        <button type="submit" className="btn btn-primary" disabled={saving || doseCount == null}>
          {saving ? t('medicines.saving') : t('medicines.save')}
        </button>
      )}

      {screen === 3 && onDelete && !confirmDelete && (
        <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(true)}>
          {t('medicines.delete')}
        </button>
      )}
      {screen === 3 && onDelete && confirmDelete && (
        <div className="medicine-delete">
          <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setConfirmDelete(false)}>
            {t('medicines.keep')}
          </button>
          <button type="button" className="btn btn-primary" disabled={saving} onClick={() => void onDelete()}>
            {t('medicines.deleteForever')}
          </button>
        </div>
      )}
    </form>
  )
}

interface MedicineEditorProps {
  medicineId?: string
  medicines: MedicineRecord[]
  loading: boolean
  saving: boolean
  error: string | null
  onSubmit: (input: MedicineInput) => Promise<void>
  onDelete: (medicine: MedicineRecord) => Promise<void>
}

export function MedicineEditor({
  medicineId,
  medicines,
  loading,
  saving,
  error,
  onSubmit,
  onDelete,
}: MedicineEditorProps) {
  const { t } = useLocale()
  const navigate = useNavigate()
  const medicine = medicineId ? (medicines.find((item) => item.id === medicineId) ?? null) : null

  return (
    <>
      {medicineId && loading && !medicine ? <p className="muted-center">{t('medicines.loading')}</p> : null}
      {medicineId && !loading && !medicine ? (
        <section className="empty-state">
          <p>{error ?? t('medicines.notFound')}</p>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/numbers')}>
            {t('medicines.back')}
          </button>
        </section>
      ) : null}
      {(!medicineId || medicine) && (
        <MedicineForm
          key={medicine?.id ?? 'new'}
          initial={medicine}
          saving={saving}
          error={error}
          onSubmit={onSubmit}
          onDelete={medicine ? () => onDelete(medicine) : undefined}
          onCancel={() => navigate('/numbers')}
        />
      )}
    </>
  )
}
