import { addDays, todayLocalDate } from './dates'
import {
  MEDICINE_SNOOZE_MS,
  type DoseMark,
  type MedicineSnoozeAlarm,
} from './medicineSchedule'

const STORAGE_KEY = 'resuming-medicine-reminder'
export const MEDICINE_REMINDER_CHANGED = 'resuming-medicine-reminder-changed'

type StoredSnooze = DoseMark & { until: string; title: string; body: string }

type Store = {
  skips: DoseMark[]
  snoozes: StoredSnooze[]
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function emptyStore(): Store {
  return { skips: [], snoozes: [] }
}

function sameDose(a: DoseMark, b: DoseMark): boolean {
  return a.medicineId === b.medicineId && a.date === b.date && a.hour === b.hour && a.minute === b.minute
}

function isDose(value: unknown): value is DoseMark {
  if (!value || typeof value !== 'object') return false
  const dose = value as DoseMark
  return (
    typeof dose.medicineId === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(dose.date) &&
    Number.isInteger(dose.hour) &&
    dose.hour >= 0 &&
    dose.hour <= 23 &&
    Number.isInteger(dose.minute) &&
    dose.minute >= 0 &&
    dose.minute <= 59
  )
}

function load(): Store {
  const store = storage()
  if (!store) return emptyStore()
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? '') as Store
    const earliest = addDays(todayLocalDate(), -1)
    const skips = (parsed.skips ?? []).filter((dose) => isDose(dose) && dose.date >= earliest)
    const snoozes = (parsed.snoozes ?? []).filter((dose) => {
      if (!isDose(dose) || typeof dose.until !== 'string' || typeof dose.title !== 'string') return false
      return Date.parse(dose.until) > Date.now() - 60_000
    })
    return { skips, snoozes }
  } catch {
    return emptyStore()
  }
}

function write(next: Store): void {
  const store = storage()
  if (!store) return
  store.setItem(STORAGE_KEY, JSON.stringify(next))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(MEDICINE_REMINDER_CHANGED))
}

export function isDoseSkipped(dose: DoseMark): boolean {
  return load().skips.some((item) => sameDose(item, dose))
}

export function skippedDoseMarks(): DoseMark[] {
  return load().skips
}

export function rememberSkip(dose: DoseMark): void {
  const current = load()
  if (current.skips.some((item) => sameDose(item, dose))) return
  write({
    skips: [...current.skips, dose],
    snoozes: current.snoozes.filter((item) => !sameDose(item, dose)),
  })
}

export function clearSkip(dose: DoseMark): void {
  const current = load()
  const skips = current.skips.filter((item) => !sameDose(item, dose))
  if (skips.length === current.skips.length) return
  write({ ...current, skips })
}

export function activeSnoozeAlarms(now = new Date()): MedicineSnoozeAlarm[] {
  return load()
    .snoozes.filter((item) => Date.parse(item.until) > now.getTime())
    .map((item) => ({
      medicineId: item.medicineId,
      date: item.date,
      hour: item.hour,
      minute: item.minute,
      until: new Date(item.until),
      title: item.title,
      body: item.body,
    }))
}

export function rememberSnooze(dose: DoseMark, title: string, body: string, now = new Date()): Date {
  const until = new Date(now.getTime() + MEDICINE_SNOOZE_MS)
  const current = load()
  const snoozes = current.snoozes.filter((item) => !sameDose(item, dose))
  snoozes.push({ ...dose, until: until.toISOString(), title, body })
  write({
    skips: current.skips.filter((item) => !sameDose(item, dose)),
    snoozes,
  })
  return until
}

export function clearSnooze(dose: DoseMark): void {
  const current = load()
  const snoozes = current.snoozes.filter((item) => !sameDose(item, dose))
  if (snoozes.length === current.snoozes.length) return
  write({ ...current, snoozes })
}
