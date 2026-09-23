import { createSupabaseClient } from './supabase'

export type LoopEvent = {
  name: string
  userId: string | null
  createdAt: string
}

export type ComebackLoopSummary = {
  comebacksPerActiveUser: number | null
  returnedWithCard: number
  returnedWithoutCard: number
  reviewOpenRate: number | null
  reviewActionRate: number | null
  caveat: string
}

export type CohortRow = {
  weekStart: string
  size: number
  week2: number | null
  week4: number | null
  week8: number | null
}

function usersWith(events: readonly LoopEvent[], name: string): Set<string> {
  const ids = new Set<string>()
  for (const event of events) {
    if (event.name === name && event.userId) ids.add(event.userId)
  }
  return ids
}

function countName(events: readonly LoopEvent[], name: string): number {
  return events.filter((event) => event.name === name).length
}

const LOOP_EVENT_NAMES = [
  'comeback',
  'welcome_back_shown',
  'review_generated',
  'review_opened',
  'review_focus_set',
  'review_shrink_used',
  'signup_completed',
  'log_created',
  'app_opened',
] as const

export async function fetchLoopEvents(days = 90): Promise<LoopEvent[]> {
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (days - 1))
  since.setUTCHours(0, 0, 0, 0)
  const { data, error } = await createSupabaseClient()
    .from('events')
    .select('name, created_at, user_id')
    .gte('created_at', since.toISOString())
    .in('name', [...LOOP_EVENT_NAMES])
    .order('created_at', { ascending: true })
    .limit(5000)
  if (error) throw error
  return (data ?? []).map((row) => ({
    name: row.name,
    userId: row.user_id,
    createdAt: row.created_at,
  }))
}

export function summarizeComebackLoop(
  events: readonly LoopEvent[],
  activeUsers: number,
): ComebackLoopSummary {
  const comebacks = countName(events, 'comeback')
  const withCard = usersWith(events, 'welcome_back_shown')
  const comebackUsers = usersWith(events, 'comeback')
  let withoutCard = 0
  for (const userId of comebackUsers) {
    if (!withCard.has(userId)) withoutCard += 1
  }
  const generated = countName(events, 'review_generated')
  const opened = countName(events, 'review_opened')
  const acted = new Set<string>()
  for (const event of events) {
    if ((event.name === 'review_focus_set' || event.name === 'review_shrink_used') && event.userId) {
      acted.add(event.userId)
    }
  }
  const openedUsers = usersWith(events, 'review_opened')
  let actionUsers = 0
  for (const userId of openedUsers) {
    if (acted.has(userId)) actionUsers += 1
  }
  return {
    comebacksPerActiveUser: activeUsers > 0 ? comebacks / activeUsers : null,
    returnedWithCard: withCard.size,
    returnedWithoutCard: withoutCard,
    reviewOpenRate: generated > 0 ? opened / generated : null,
    reviewActionRate: openedUsers.size > 0 ? actionUsers / openedUsers.size : null,
    caveat: 'This compares people who came back. It is not a controlled test.',
  }
}

function weekStartMonday(iso: string): string {
  const date = iso.slice(0, 10)
  const day = new Date(`${date}T12:00:00Z`).getUTCDay()
  const delta = day === 0 ? 6 : day - 1
  const start = new Date(`${date}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() - delta)
  return start.toISOString().slice(0, 10)
}

function daysAfter(iso: string, days: number): string {
  const start = new Date(`${iso.slice(0, 10)}T12:00:00Z`)
  start.setUTCDate(start.getUTCDate() + days)
  return start.toISOString().slice(0, 10)
}

/** Share of a signup week still showing up in weeks 2, 4, and 8. Null if that week has not ended. */
export function cohortRetention(opts: {
  signups: readonly { userId: string; at: string }[]
  showedUp: readonly { userId: string; at: string }[]
  asOf: string
}): CohortRow[] {
  const groups = new Map<string, { userId: string; at: string }[]>()
  for (const signup of opts.signups) {
    const key = weekStartMonday(signup.at)
    const list = groups.get(key) ?? []
    list.push(signup)
    groups.set(key, list)
  }
  const rows: CohortRow[] = []
  for (const [weekStart, members] of [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]))) {
    const share = (fromDay: number, toDay: number): number | null => {
      const windowEnd = daysAfter(weekStart, toDay)
      if (opts.asOf < windowEnd) return null
      let hit = 0
      for (const member of members) {
        const from = daysAfter(member.at, fromDay)
        const to = daysAfter(member.at, toDay)
        const showed = opts.showedUp.some(
          (event) => event.userId === member.userId && event.at.slice(0, 10) >= from && event.at.slice(0, 10) < to,
        )
        if (showed) hit += 1
      }
      return members.length === 0 ? null : hit / members.length
    }
    rows.push({
      weekStart,
      size: members.length,
      week2: share(7, 14),
      week4: share(21, 28),
      week8: share(49, 56),
    })
  }
  return rows
}
