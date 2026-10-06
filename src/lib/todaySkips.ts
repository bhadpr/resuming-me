import { addDays, todayLocalDate } from './dates'

/** Skips for items with no skip of their own on the server: reminders, vitals, guest habits. */
const STORAGE_KEY = 'resuming-today-skips'
export const TODAY_SKIPS_CHANGED = 'resuming-today-skips-changed'

/** Item key → the date it was skipped. */
type Store = Record<string, string>

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function load(): Store {
  const store = storage()
  if (!store) return {}
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? '{}') as Store
    const earliest = addDays(todayLocalDate(), -1)
    return Object.fromEntries(
      Object.entries(parsed).filter(([, date]) => typeof date === 'string' && date >= earliest),
    )
  } catch {
    return {}
  }
}

function write(next: Store): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(next))
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(TODAY_SKIPS_CHANGED))
}

export function isSkippedOn(key: string, date: string): boolean {
  return load()[key] === date
}

export function skipOn(key: string, date: string): void {
  write({ ...load(), [key]: date })
}

export function unskipOn(key: string, date: string): void {
  const current = load()
  if (current[key] !== date) return
  delete current[key]
  write(current)
}
