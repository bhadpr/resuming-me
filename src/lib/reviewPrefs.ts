import type { ReviewSchedule } from './weeklyReview'
import { DEFAULT_REVIEW_SCHEDULE } from './weeklyReview'

const SCHEDULE_KEY = 'resuming-review-schedule'
const OFF_KEY = 'resuming-reviews-off'
const BIRTHDAY_KEY = 'resuming-birthday'
const SEEN_KEY = 'resuming-moments-seen'

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}

export function loadReviewSchedule(): ReviewSchedule {
  const parsed = readJson<Partial<ReviewSchedule>>(SCHEDULE_KEY)
  if (!parsed) return DEFAULT_REVIEW_SCHEDULE
  return {
    weekday: clamp(parsed.weekday, 0, 6, DEFAULT_REVIEW_SCHEDULE.weekday),
    hour: clamp(parsed.hour, 0, 23, DEFAULT_REVIEW_SCHEDULE.hour),
    minute: clamp(parsed.minute, 0, 59, DEFAULT_REVIEW_SCHEDULE.minute),
  }
}

export function saveReviewSchedule(schedule: ReviewSchedule): void {
  localStorage.setItem(SCHEDULE_KEY, JSON.stringify(schedule))
}

export function loadReviewsOff(): boolean {
  return localStorage.getItem(OFF_KEY) === '1'
}

export function saveReviewsOff(off: boolean): void {
  localStorage.setItem(OFF_KEY, off ? '1' : '0')
}

export function loadBirthday(): string | null {
  const value = localStorage.getItem(BIRTHDAY_KEY)
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null
}

export function saveBirthday(value: string | null): void {
  if (!value) localStorage.removeItem(BIRTHDAY_KEY)
  else localStorage.setItem(BIRTHDAY_KEY, value)
}

export function loadSeenMoments(): string[] {
  const parsed = readJson<unknown>(SEEN_KEY)
  return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
}

export function saveSeenMoments(ids: readonly string[]): void {
  localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-40)))
}

function clamp(value: number | undefined, min: number, max: number, fallback: number): number {
  if (value == null || Number.isNaN(value)) return fallback
  return Math.min(max, Math.max(min, value))
}
