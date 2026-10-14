import { ANALYTICS_WINDOW_DAYS, type AnalyticsWindow } from './analytics'
import { asCount, asList, asRecord, fetchAnalyticsSummary } from './adminRpc'
import { REMINDER_KINDS } from './reminderSchedule'

export interface ReminderSummary {
  added: number
  done: number
  people: number
  withTime: number
  dayBefore: number
  everyYear: number
  signedIn: number
  doneFromNotification: number
  /** Added as an every-day or every-week repeat. */
  repeatAdded: { day: number; week: number }
  /** Done events from repeating reminders. Each day's Done counts. */
  repeatDone: number
  /** The last days of the window, oldest first, with zero days included. */
  perDay: Array<{ day: string; added: number; done: number }>
  kinds: Array<{ kind: string; count: number }>
  shared: {
    created: number
    /** Event pages opened, on the website or in the app. */
    opened: number
    added: number
    /** App installs that came with an event code. */
    installs: number
    cancelled: number
    reported: number
  }
}

/** Counts only. Reminder text is never sent with these events. */
export function parseReminderSummary(data: unknown): ReminderSummary {
  const row = asRecord(data)
  const shared = asRecord(row.shared)
  const repeatAdded = asRecord(row.repeatAdded)
  const kinds = new Map<string, number>()
  for (const entry of asList(row.kinds)) {
    const kind = REMINDER_KINDS.includes(entry.kind as (typeof REMINDER_KINDS)[number])
      ? (entry.kind as string)
      : 'other'
    kinds.set(kind, (kinds.get(kind) ?? 0) + asCount(entry.count))
  }
  return {
    added: asCount(row.added),
    done: asCount(row.done),
    people: asCount(row.people),
    withTime: asCount(row.withTime),
    dayBefore: asCount(row.dayBefore),
    everyYear: asCount(row.everyYear),
    signedIn: asCount(row.signedIn),
    doneFromNotification: asCount(row.doneFromNotification),
    repeatAdded: { day: asCount(repeatAdded.day), week: asCount(repeatAdded.week) },
    repeatDone: asCount(row.repeatDone),
    perDay: asList(row.perDay)
      .filter((entry) => typeof entry.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(entry.day))
      .map((entry) => ({ day: entry.day as string, added: asCount(entry.added), done: asCount(entry.done) }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    kinds: [...kinds.entries()]
      .map(([kind, count]) => ({ kind, count }))
      .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind)),
    shared: {
      created: asCount(shared.created),
      opened: asCount(shared.opened),
      added: asCount(shared.added),
      installs: asCount(shared.installs),
      cancelled: asCount(shared.cancelled),
      reported: asCount(shared.reported),
    },
  }
}

export async function fetchReminderSummary(window: AnalyticsWindow): Promise<ReminderSummary> {
  return parseReminderSummary(await fetchAnalyticsSummary('reminder_analytics_summary', ANALYTICS_WINDOW_DAYS[window]))
}

/**
 * One-time reminders done for each one added, as a percent. It is not an exact completion rate:
 * a reminder done today may have been added earlier, so it can pass 100. Null with nothing added.
 */
export function oneTimeDoneRate(summary: Pick<ReminderSummary, 'added' | 'done' | 'repeatAdded' | 'repeatDone'>): number | null {
  const added = summary.added - summary.repeatAdded.day - summary.repeatAdded.week
  const done = summary.done - summary.repeatDone
  if (added <= 0) return null
  return Math.round((100 * Math.max(0, done)) / added)
}
