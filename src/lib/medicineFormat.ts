import { localeTag, type Locale } from './i18n'
import type { ClockTime, MealRelation, MedicineSystem } from './medicineSchedule'

export function weekdayShort(day: number, locale: Locale): string {
  const date = new Date(2024, 0, 7 + day)
  return date.toLocaleDateString(localeTag(locale), { weekday: 'short' })
}

export function weekdayName(day: number, locale: Locale): string {
  const date = new Date(2024, 0, 7 + day)
  return date.toLocaleDateString(localeTag(locale), { weekday: 'long' })
}

export function medicineFallbackSrc(system: MedicineSystem | null | undefined): string | null {
  if (system === 'homeopathic') return '/medicines/homeopathic.webp'
  if (system === 'allopathic') return '/medicines/allopathic.webp'
  if (system === 'ayurvedic') return '/medicines/ayurvedic.webp'
  return null
}

export function systemMessageKey(system: MedicineSystem | null | undefined): string | null {
  if (system === 'homeopathic') return 'medicines.homeopathic'
  if (system === 'allopathic') return 'medicines.allopathic'
  if (system === 'ayurvedic') return 'medicines.ayurvedic'
  return null
}

export function mealMessageKey(meal: MealRelation | null | undefined): string | null {
  if (meal === 'before') return 'medicines.beforeFood'
  if (meal === 'after') return 'medicines.afterFood'
  if (meal === 'with') return 'medicines.withFood'
  return null
}

export function formatClock(time: ClockTime, locale: Locale): string {
  const date = new Date(2024, 0, 7, time.hour, time.minute)
  return date.toLocaleTimeString(localeTag(locale), { hour: 'numeric', minute: '2-digit' })
}
