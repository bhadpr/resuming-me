import { localeTag, type Locale } from './i18n'

/** YYYY-MM for a reminder day. */
export function monthKeyOf(day: string): string {
  return day.slice(0, 7)
}

/** Days already in order stay in order. A later month starts a new group. */
export function groupByMonth<T extends { day: string }>(items: readonly T[]): { key: string; items: T[] }[] {
  const groups: { key: string; items: T[] }[] = []
  for (const item of [...items].sort((a, b) => a.day.localeCompare(b.day))) {
    const key = monthKeyOf(item.day)
    const last = groups[groups.length - 1]
    if (last?.key === key) last.items.push(item)
    else groups.push({ key, items: [item] })
  }
  return groups
}

export function monthTitle(key: string, locale: Locale): string {
  const [year, month] = key.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, 1).toLocaleDateString(localeTag(locale), {
    month: 'long',
    year: 'numeric',
  })
}

/**
 * Past months start closed, so the eye lands on this month and what follows.
 * A list that is entirely in the past keeps its latest month open.
 */
export function monthsClosedByDefault(keys: readonly string[], today: string): Set<string> {
  const current = today.slice(0, 7)
  const ahead = keys.some((key) => key >= current)
  if (!ahead) {
    const latest = keys[keys.length - 1]
    return new Set(keys.filter((key) => key !== latest))
  }
  return new Set(keys.filter((key) => key < current))
}
