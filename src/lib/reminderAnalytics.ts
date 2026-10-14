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
