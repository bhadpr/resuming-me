import { addDays, parseLocalDate, todayLocalDate } from './dates'
import { localeTag, type Locale } from './i18n'
import type { Reminder } from './reminderSchedule'

/** A repeating reminder is one reminder that comes back every day or every week until an end date. */
export const REMINDER_REPEATS = ['day', 'week'] as const
export type ReminderRepeat = (typeof REMINDER_REPEATS)[number]

/** The end date starts one month after the first day. */
export const REPEAT_DEFAULT_MONTHS = 1
/** The end date can be at most this many months after the first day. */
export const REPEAT_MAX_MONTHS = 2
/** Only this many coming occurrences of one repeating reminder get an alert armed. */
export const REPEAT_ALERTS_AHEAD = 7

export function isReminderRepeat(value: unknown): value is ReminderRepeat {
  return REMINDER_REPEATS.includes(value as ReminderRepeat)
}

/** Same day of the month, months later. A short month ends on its last day, as Postgres does. */
export function addMonthsClamped(day: string, months: number): string {
  const [year, month, date] = day.split('-').map(Number)
  const target = new Date(year, month - 1 + months, 1)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
  const y = target.getFullYear()
  const m = String(target.getMonth() + 1).padStart(2, '0')
  const d = String(Math.min(date, last)).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function defaultRepeatUntil(start: string): string {
  return addMonthsClamped(start, REPEAT_DEFAULT_MONTHS)
}

/** The latest end date allowed for a repeat that starts on this day. */
export function repeatLimit(start: string): string {
  return addMonthsClamped(start, REPEAT_MAX_MONTHS)
}

/** Keeps a chosen end date between the first day and the limit. */
export function clampRepeatUntil(start: string, until: string): string {
  if (until < start) return start
  const limit = repeatLimit(start)
  return until > limit ? limit : until
}

function stepDays(repeat: ReminderRepeat): number {
  return repeat === 'week' ? 7 : 1
}

export function nextOccurrence(day: string, repeat: ReminderRepeat): string {
  return addDays(day, stepDays(repeat))
}

type RepeatFields = Pick<Reminder, 'repeat' | 'repeatUntil'>

/** Whether a reminder comes back, with the end date it needs. */
export function isRepeating(reminder: RepeatFields): reminder is { repeat: ReminderRepeat; repeatUntil: string } {
  return isReminderRepeat(reminder.repeat) && typeof reminder.repeatUntil === 'string'
}

function daysBetween(from: string, to: string): number {
  return Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 86_400_000)
}

/** The first occurrence on or after `today`, or null once the end date has passed. A missed day is simply gone. */
export function occurrenceOnOrAfter(day: string, repeat: ReminderRepeat, until: string, today: string): string | null {
  let next = day
  if (day < today) {
    const step = stepDays(repeat)
    next = addDays(day, Math.ceil(daysBetween(day, today) / step) * step)
  }
  return next <= until ? next : null
}

/** End of the last day, used to close a series whose end date has passed. */
function endedAt(until: string): string {
  const at = parseLocalDate(until)
  at.setHours(23, 59, 0, 0)
  return at.toISOString()
}

/**
 * The reminder as it stands today. A repeating one moves to its next occurrence, because missed days
 * vanish, and one past its end date counts as done. Other reminders come back unchanged.
 */
export function effectiveReminder<T extends Reminder>(reminder: T, today: string): T {
  if (reminder.doneAt || !isRepeating(reminder)) return reminder
  const next = occurrenceOnOrAfter(reminder.day, reminder.repeat, reminder.repeatUntil, today)
  if (next === null) return { ...reminder, doneAt: endedAt(reminder.repeatUntil) }
  return next === reminder.day ? reminder : { ...reminder, day: next }
}

export interface RepeatState {
  day: string
  doneAt: string | null
  lastDoneOn: string | null
}

/**
 * Done for this occurrence. The reminder moves to its next one; after the last one it is done for good.
 * Pass the reminder as effectiveReminder returns it.
 */
export function completeOccurrence(
  reminder: Reminder & { repeat: ReminderRepeat; repeatUntil: string },
  doneAt: string,
): RepeatState {
  const lastDoneOn = todayLocalDate(new Date(doneAt))
  const next = nextOccurrence(reminder.day, reminder.repeat)
  if (next > reminder.repeatUntil) return { day: reminder.day, doneAt, lastDoneOn }
  return { day: next, doneAt: null, lastDoneOn }
}

/**
 * Not done: back to the occurrence that Done moved past. It takes the reminder either as it is after
 * Done (moved on, or done for good) or as it was just before, which is how an Undo toast remembers it.
 */
export function reopenOccurrence(
  reminder: Reminder & { repeat: ReminderRepeat },
  today = todayLocalDate(),
): RepeatState {
  const movedOn = !reminder.doneAt && repeatDoneOn(reminder, today)
  const day = movedOn ? addDays(reminder.day, -stepDays(reminder.repeat)) : reminder.day
  return { day, doneAt: null, lastDoneOn: null }
}

/** Whether this occurrence was marked done on `today`. */
export function repeatDoneOn(reminder: Pick<Reminder, 'lastDoneOn'>, today: string): boolean {
  return reminder.lastDoneOn === today
}

/** The days a repeating reminder will ring on, starting at its next one, soonest first. */
export function upcomingOccurrences(
  reminder: Reminder & { repeat: ReminderRepeat; repeatUntil: string },
  limit = REPEAT_ALERTS_AHEAD,
): string[] {
  const days: string[] = []
  let day = reminder.day
  while (days.length < limit && day <= reminder.repeatUntil) {
    days.push(day)
    day = nextOccurrence(day, reminder.repeat)
  }
  return days
}

/** "Every day until 14 Nov". */
export function repeatSummary(
  reminder: RepeatFields,
  locale: Locale,
  t: (key: string, vars?: Record<string, string | number>) => string,
): string | null {
  if (!isRepeating(reminder)) return null
  const date = parseLocalDate(reminder.repeatUntil).toLocaleDateString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
  })
  return t(reminder.repeat === 'week' ? 'reminders.repeatSummaryWeek' : 'reminders.repeatSummaryDay', { date })
}

/** Why a repeat setting is not allowed, or null when it is fine (or there is no repeat). */
export function repeatIssue(input: {
  day: string
  repeat?: ReminderRepeat | null
  repeatUntil?: string | null
  repeatFrom?: string | null
}): 'repeat' | null {
  if (!input.repeat) return null
  if (!isReminderRepeat(input.repeat) || !input.repeatUntil) return 'repeat'
  const from = input.repeatFrom ?? input.day
  if (input.repeatUntil < input.day || input.repeatUntil > repeatLimit(from)) return 'repeat'
  return null
}
