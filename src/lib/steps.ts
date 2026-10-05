import { addDays, todayLocalDate } from './dates'
import { localeTag, type Locale } from './i18n'

export const DEFAULT_STEP_GOAL = 10_000
export const MAX_STEP_AMOUNT = 200_000

const GOAL_KEY = 'resuming-step-goal'
const COUNTS_KEY = 'resuming-step-counts'
const COUNT_KEEP_DAYS = 60

export function isDailyStepsMetric(metric: {
  name: string
  template_id?: string | null
}): boolean {
  if (metric.template_id === 'steps') return true
  const name = metric.name.trim().toLowerCase()
  return name === 'daily steps' || name === 'steps'
}

export function parseStepAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(/,/g, '')
  if (!/^\d+$/.test(cleaned)) return null
  const value = Number(cleaned)
  if (!Number.isInteger(value) || value < 0 || value > MAX_STEP_AMOUNT) return null
  return value
}

export function formatStepCount(value: number, locale: Locale): string {
  return Math.max(0, Math.round(value)).toLocaleString(localeTag(locale))
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

export function loadStepGoal(): number {
  const raw = storage()?.getItem(GOAL_KEY)
  const parsed = raw == null ? null : parseStepAmount(raw)
  return parsed == null || parsed < 1 ? DEFAULT_STEP_GOAL : parsed
}

export function saveStepGoal(goal: number): void {
  const parsed = parseStepAmount(String(goal))
  if (parsed == null || parsed < 1) return
  storage()?.setItem(GOAL_KEY, String(parsed))
}

function readCounts(): Record<string, number> {
  const raw = storage()?.getItem(COUNTS_KEY)
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed == null || Array.isArray(parsed)) return {}
    const counts: Record<string, number> = {}
    for (const [date, value] of Object.entries(parsed)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) continue
      counts[date] = value
    }
    return counts
  } catch {
    return {}
  }
}

export function loadTypedSteps(date: string): number | null {
  const value = readCounts()[date]
  return value == null ? null : value
}

export function saveTypedSteps(date: string, steps: number): void {
  const parsed = parseStepAmount(String(steps))
  if (parsed == null) return
  const counts = readCounts()
  counts[date] = parsed
  const oldest = addDays(todayLocalDate(), -COUNT_KEEP_DAYS)
  for (const key of Object.keys(counts)) {
    if (key < oldest) delete counts[key]
  }
  storage()?.setItem(COUNTS_KEY, JSON.stringify(counts))
}
