import { ANALYTICS_WINDOW_DAYS, type AnalyticsWindow } from './analytics'
import { REMINDER_KINDS } from './reminderSchedule'
import { createSupabaseClient } from './supabase'

export const REMINDER_EVENT_NAMES = ['reminder_added', 'reminder_done'] as const

export interface ReminderEventRow {
  name: string
  props: unknown
  anon_id: string | null
  user_id: string | null
}

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
}

function propsOf(row: ReminderEventRow): Record<string, unknown> {
  return row.props && typeof row.props === 'object' ? (row.props as Record<string, unknown>) : {}
}

/** Counts only. Reminder text is never sent with these events. */
export function summarizeReminderEvents(rows: readonly ReminderEventRow[]): ReminderSummary {
  const people = new Set<string>()
  const kinds = new Map<string, number>()
  const summary: ReminderSummary = {
    added: 0,
    done: 0,
    people: 0,
    withTime: 0,
    dayBefore: 0,
    everyYear: 0,
    signedIn: 0,
    doneFromNotification: 0,
    kinds: [],
  }
  for (const row of rows) {
    const props = propsOf(row)
    const who = row.user_id ?? row.anon_id
    if (who) people.add(who)
    if (row.name === 'reminder_added') {
      summary.added += 1
      if (props.has_time === true) summary.withTime += 1
      if (props.day_before === true) summary.dayBefore += 1
      if (props.every_year === true) summary.everyYear += 1
      if (props.signed_in === true) summary.signedIn += 1
      const kind = REMINDER_KINDS.includes(props.kind as (typeof REMINDER_KINDS)[number])
        ? (props.kind as string)
        : 'other'
      kinds.set(kind, (kinds.get(kind) ?? 0) + 1)
    } else if (row.name === 'reminder_done') {
      summary.done += 1
      if (props.from === 'notification') summary.doneFromNotification += 1
    }
  }
  summary.people = people.size
  summary.kinds = [...kinds.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((a, b) => b.count - a.count || a.kind.localeCompare(b.kind))
  return summary
}

export async function fetchReminderEvents(window: AnalyticsWindow): Promise<ReminderEventRow[]> {
  const client = createSupabaseClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (ANALYTICS_WINDOW_DAYS[window] - 1))
  since.setUTCHours(0, 0, 0, 0)
  const { data, error } = await client
    .from('events')
    .select('name, props, anon_id, user_id')
    .gte('created_at', since.toISOString())
    .in('name', [...REMINDER_EVENT_NAMES])
    .limit(8000)
  if (error) throw error
  return (data ?? []) as ReminderEventRow[]
}
