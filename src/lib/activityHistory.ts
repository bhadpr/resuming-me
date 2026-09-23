import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { addDays, daysBetween, parseLocalDate, todayLocalDate } from './dates'
import { getDayStatus, isAutoPostponed, type ActivityPause } from './dayStatus'
import { freshStartCovering, type FreshStartRange } from './comeback'

export type ActivityHistoryRow =
  | { kind: 'quiet'; id: string; from: string; to: string }
  | {
      kind: 'fresh'
      id: string
      startedOn: string
      coversFrom: string
      coversTo: string
      days: number
    }
  | { kind: 'entry'; entry: LogEntry }

export type ActivityHistoryGroup = {
  monthKey: string
  monthLabel: string
  rows: ActivityHistoryRow[]
}

export type ActivityHistoryOpts = {
  restDates?: ReadonlySet<string>
  pauses?: readonly ActivityPause[]
  freshStarts?: readonly FreshStartRange[]
  showEverything?: boolean
}

const MONTH_SHORT = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
] as const

const MONTH_LONG = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const

export function formatHistoryDay(date: string): string {
  const d = parseLocalDate(date)
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

export function formatQuietRange(from: string, to: string): string {
  if (from === to) return `${formatHistoryDay(from)} · quiet`
  return `${formatHistoryDay(from)} – ${formatHistoryDay(to)} · quiet`
}

function monthKey(date: string): string {
  return date.slice(0, 7)
}

function monthLabel(date: string): string {
  const d = parseLocalDate(date)
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`
}

function historyStartDate(activity: Activity, entries: LogEntry[]): string {
  const created = activity.created_at.slice(0, 10)
  let earliest = created
  for (const e of entries) {
    if (e.activity_id === activity.id && e.date < earliest) earliest = e.date
  }
  return earliest
}

function entriesForDate(
  entries: LogEntry[],
  activityId: string,
  date: string,
): LogEntry[] {
  return entries.filter((e) => e.activity_id === activityId && e.date === date)
}

/** Visible log rows for a day — omit auto put-offs (those read as missed/quiet). */
function visibleEntriesForDay(dayEntries: LogEntry[]): LogEntry[] {
  return dayEntries.filter(
    (e) => !(e.type === 'postponed' && isAutoPostponed(e)),
  )
}

/**
 * Newest-first history: real log rows, with consecutive missed days collapsed
 * into a single quiet range, grouped under sticky month headers.
 */
export function buildActivityHistory(
  activity: Activity,
  entries: LogEntry[],
  today = todayLocalDate(),
  opts?: ActivityHistoryOpts,
): ActivityHistoryGroup[] {
  const mine = entries
    .filter((e) => e.activity_id === activity.id)
    .sort((a, b) => {
      const byDate = b.date.localeCompare(a.date)
      if (byDate !== 0) return byDate
      return b.created_at.localeCompare(a.created_at)
    })

  const start = historyStartDate(activity, mine)
  if (start > today) return []

  const flat: Array<{ sortDate: string; row: ActivityHistoryRow }> = []
  let missedTo: string | null = null
  let missedFrom: string | null = null
  const emittedFresh = new Set<string>()
  const hideFresh = !opts?.showEverything

  const flushMissed = () => {
    if (missedFrom && missedTo) {
      flat.push({
        sortDate: missedTo,
        row: {
          kind: 'quiet',
          id: `quiet-${missedFrom}-${missedTo}`,
          from: missedFrom,
          to: missedTo,
        },
      })
    }
    missedFrom = null
    missedTo = null
  }

  for (let date = today; date >= start; date = addDays(date, -1)) {
    const cover = hideFresh ? freshStartCovering(date, opts?.freshStarts ?? []) : null
    if (cover) {
      flushMissed()
      if (!emittedFresh.has(cover.id)) {
        emittedFresh.add(cover.id)
        flat.push({
          sortDate: cover.coversTo,
          row: {
            kind: 'fresh',
            id: `fresh-${cover.id}`,
            startedOn: cover.startedOn,
            coversFrom: cover.coversFrom,
            coversTo: cover.coversTo,
            days: daysBetween(cover.coversFrom, cover.coversTo) + 1,
          },
        })
      }
      continue
    }

    const { status } = getDayStatus({
      activity,
      entriesForDay: mine,
      date,
      today,
      timezone: 'UTC',
      restDates: opts?.restDates,
      pauses: opts?.pauses,
    })

    if (status === 'missed' || status === 'paused' || status === 'rest') {
      // Walking newest→oldest: first hit is `to`, last hit is `from`.
      if (missedTo == null) missedTo = date
      missedFrom = date
      continue
    }

    flushMissed()

    const dayEntries = visibleEntriesForDay(
      entriesForDate(mine, activity.id, date),
    )
    for (const entry of dayEntries) {
      flat.push({ sortDate: entry.date, row: { kind: 'entry', entry } })
    }
  }
  flushMissed()

  const groups: ActivityHistoryGroup[] = []
  const byMonth = new Map<string, ActivityHistoryGroup>()

  for (const { sortDate, row } of flat) {
    const key = monthKey(sortDate)
    let group = byMonth.get(key)
    if (!group) {
      group = { monthKey: key, monthLabel: monthLabel(sortDate), rows: [] }
      byMonth.set(key, group)
      groups.push(group)
    }
    group.rows.push(row)
  }

  return groups
}
