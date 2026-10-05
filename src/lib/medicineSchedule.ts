import { addDays, parseLocalDate, todayLocalDate } from './dates'

export const MAX_MEDICINE_TIMES = 4
export const MAX_MEDICINE_NAME = 40
export const MEDICINE_NOTIFICATION_ID_BASE = 8000
export const MEDICINE_NOTIFICATION_SLOTS = 160
export const MEDICINE_LOOKAHEAD_DAYS = 2

export const MEDICINE_SYSTEMS = ['homeopathic', 'allopathic', 'ayurvedic'] as const
export type MedicineSystem = (typeof MEDICINE_SYSTEMS)[number]
export type MealRelation = 'before' | 'after' | 'with'

export function medicineSystemOf(value: unknown): MedicineSystem | null {
  return value === 'homeopathic' || value === 'allopathic' || value === 'ayurvedic' ? value : null
}

export type ClockTime = { hour: number; minute: number; meal?: MealRelation | null }

export interface MedicineSchedule {
  id: string
  name: string
  photoUrl: string | null
  weekdays: number[]
  times: ClockTime[]
  /** Homeopathic, allopathic, or Ayurvedic. Charts can group on this later. */
  system?: MedicineSystem | null
}

export interface DoseMark {
  medicineId: string
  date: string
  hour: number
  minute: number
}

export interface DueDose {
  key: string
  medicineId: string
  name: string
  photoUrl: string | null
  hour: number
  minute: number
  meal: MealRelation | null
  system?: MedicineSystem | null
  taken: boolean
  /** Set from the notification. A skip is not a miss and not a taken dose. */
  skipped?: boolean
}

export interface MedicineAlarm {
  id: number
  medicineId: string
  title: string
  body: string
  at: Date
  date: string
  hour: number
  minute: number
}

export const MEDICINE_SNOOZE_MS = 30 * 60 * 1000
export const MEDICINE_SNOOZE_ID_BASE = 8200
export const MEDICINE_SNOOZE_SLOTS = 40

export interface MedicineSnoozeAlarm {
  medicineId: string
  date: string
  hour: number
  minute: number
  until: Date
  title: string
  body: string
}

export function doseKey(medicineId: string, date: string, hour: number, minute: number): string {
  return `${medicineId}|${date}|${hour}:${minute}`
}

export function normalizeWeekdays(days: readonly number[]): number[] {
  const unique = [...new Set(days.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
  unique.sort((a, b) => a - b)
  return unique
}

export function mealOf(time: { meal?: MealRelation | null }): MealRelation | null {
  return time.meal === 'before' || time.meal === 'after' || time.meal === 'with' ? time.meal : null
}

export function normalizeTimes(times: readonly ClockTime[]): ClockTime[] {
  const unique: ClockTime[] = []
  for (const time of times) {
    if (!Number.isInteger(time.hour) || time.hour < 0 || time.hour > 23) continue
    if (!Number.isInteger(time.minute) || time.minute < 0 || time.minute > 59) continue
    if (unique.some((item) => item.hour === time.hour && item.minute === time.minute)) continue
    const meal = mealOf(time)
    unique.push(meal ? { hour: time.hour, minute: time.minute, meal } : { hour: time.hour, minute: time.minute })
    if (unique.length >= MAX_MEDICINE_TIMES) break
  }
  unique.sort((a, b) => a.hour - b.hour || a.minute - b.minute)
  return unique
}

export type MedicineInputIssue = 'name' | 'name-long' | 'days' | 'times' | 'kind'

export function validateMedicineInput(input: {
  name: string
  weekdays: readonly number[]
  times: readonly ClockTime[]
}): MedicineInputIssue | null {
  const name = input.name.trim()
  if (!name) return 'name'
  if (name.length > MAX_MEDICINE_NAME) return 'name-long'
  if (normalizeWeekdays(input.weekdays).length === 0) return 'days'
  if (normalizeTimes(input.times).length === 0) return 'times'
  return null
}

function takenSet(marks: readonly DoseMark[]): Set<string> {
  return new Set(marks.map((mark) => doseKey(mark.medicineId, mark.date, mark.hour, mark.minute)))
}

/** Every dose scheduled on this calendar date. A missed one stays until the day ends. */
export function dosesOnDate(
  medicines: readonly MedicineSchedule[],
  date: string,
  marks: readonly DoseMark[],
): DueDose[] {
  const weekday = parseLocalDate(date).getDay()
  const taken = takenSet(marks)
  const doses: DueDose[] = []
  for (const medicine of medicines) {
    if (!medicine.weekdays.includes(weekday)) continue
    for (const time of normalizeTimes(medicine.times)) {
      const key = doseKey(medicine.id, date, time.hour, time.minute)
      doses.push({
        key,
        medicineId: medicine.id,
        name: medicine.name,
        photoUrl: medicine.photoUrl,
        hour: time.hour,
        minute: time.minute,
        meal: mealOf(time),
        system: medicine.system ?? null,
        taken: taken.has(key),
      })
    }
  }
  doses.sort((a, b) => a.hour - b.hour || a.minute - b.minute || a.name.localeCompare(b.name))
  return doses
}

function atLocal(date: string, hour: number, minute: number): Date {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day, hour, minute, 0, 0)
}

/** Future dose alarms. Taken doses and times already passed are left off. */
export function planMedicineAlarms(
  medicines: readonly MedicineSchedule[],
  marks: readonly DoseMark[],
  now = new Date(),
  body: string | ((meal: MealRelation | null) => string) = 'Reminder',
): MedicineAlarm[] {
  const taken = takenSet(marks)
  const alarms: Array<Omit<MedicineAlarm, 'id'>> = []
  const today = todayLocalDate(now)
  for (let offset = 0; offset < MEDICINE_LOOKAHEAD_DAYS; offset += 1) {
    const date = addDays(today, offset)
    const weekday = parseLocalDate(date).getDay()
    for (const medicine of medicines) {
      if (!medicine.weekdays.includes(weekday)) continue
      for (const time of normalizeTimes(medicine.times)) {
        if (taken.has(doseKey(medicine.id, date, time.hour, time.minute))) continue
        const at = atLocal(date, time.hour, time.minute)
        if (at.getTime() <= now.getTime()) continue
        alarms.push({
          medicineId: medicine.id,
          title: medicine.name,
          body: typeof body === 'function' ? body(mealOf(time)) : body,
          at,
          date,
          hour: time.hour,
          minute: time.minute,
        })
      }
    }
  }
  alarms.sort((a, b) => a.at.getTime() - b.at.getTime())
  return alarms.slice(0, MEDICINE_NOTIFICATION_SLOTS).map((alarm, index) => ({
    ...alarm,
    id: MEDICINE_NOTIFICATION_ID_BASE + index,
  }))
}

export function medicineNotificationIds(): number[] {
  return Array.from(
    { length: MEDICINE_NOTIFICATION_SLOTS },
    (_, index) => MEDICINE_NOTIFICATION_ID_BASE + index,
  )
}

export function medicineSnoozeIds(): number[] {
  return Array.from({ length: MEDICINE_SNOOZE_SLOTS }, (_, index) => MEDICINE_SNOOZE_ID_BASE + index)
}

/** Keep a snoozed reminder. The dose clock itself stays where it was. */
export function applyMedicineSnoozes(
  alarms: readonly MedicineAlarm[],
  snoozes: readonly MedicineSnoozeAlarm[],
): MedicineAlarm[] {
  const covered = new Set(
    alarms.map((alarm) => doseKey(alarm.medicineId, alarm.date, alarm.hour, alarm.minute)),
  )
  const extra: MedicineAlarm[] = []
  for (const snooze of snoozes) {
    if (extra.length >= MEDICINE_SNOOZE_SLOTS) break
    const key = doseKey(snooze.medicineId, snooze.date, snooze.hour, snooze.minute)
    if (covered.has(key)) continue
    covered.add(key)
    extra.push({
      id: MEDICINE_SNOOZE_ID_BASE + extra.length,
      medicineId: snooze.medicineId,
      title: snooze.title,
      body: snooze.body,
      at: snooze.until,
      date: snooze.date,
      hour: snooze.hour,
      minute: snooze.minute,
    })
  }
  return [...alarms, ...extra]
}
