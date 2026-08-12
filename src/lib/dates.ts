/** Local calendar date as YYYY-MM-DD (user's browser timezone). */
export function todayLocalDate(now = new Date()): string {
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Yesterday in local timezone as YYYY-MM-DD. */
export function yesterdayLocalDate(now = new Date()): string {
  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  return todayLocalDate(yesterday)
}

/** True when a date string is strictly before another (YYYY-MM-DD). */
export function isDateBefore(a: string, b: string): boolean {
  return a < b
}

/** Parse YYYY-MM-DD as local Date at noon (avoids DST edge issues). */
export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0, 0)
}

export function addDays(date: string, days: number): string {
  const d = parseLocalDate(date)
  d.setDate(d.getDate() + days)
  return todayLocalDate(d)
}

/** Monday of the week containing `date` (Mon–Sun weeks). */
export function startOfWeekMonday(date: string): string {
  const d = parseLocalDate(date)
  const day = d.getDay() // 0 Sun .. 6 Sat
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  return todayLocalDate(d)
}

export function endOfWeekSunday(date: string): string {
  return addDays(startOfWeekMonday(date), 6)
}

/** Whole days from `from` to `to` (can be negative). */
export function daysBetween(from: string, to: string): number {
  const a = parseLocalDate(from).getTime()
  const b = parseLocalDate(to).getTime()
  return Math.round((b - a) / (24 * 60 * 60 * 1000))
}
