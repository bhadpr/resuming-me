import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { addDays, daysBetween } from './dates.ts'
import {
  getDayStatus,
  showedUp,
  type ActivityPause,
  type DayStatus,
} from './dayStatus.ts'

/** A comeback needs at least this many quiet days before the person shows up. */
export const COMEBACK_GAP_DAYS = 2
/** Welcome-back appears after this many quiet days with no showing up. */
export const WELCOME_BACK_GAP_DAYS = 3
export const FRESH_START_GAP_DAYS = 7
export const FRESH_START_COOLDOWN_DAYS = 14

export type FreshStartRange = {
  id: string
  startedOn: string
  coversFrom: string
  coversTo: string
}

export type WelcomeBackState = {
  /** Gap this card was already shown for. */
  lastGapStartedAt: string | null
  /** "Just looking today" hides the card until this instant. */
  dismissedUntil: string | null
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function formatMonthDay(date: string): string {
  const [, month, day] = date.split('-')
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`
}

export function isQuietStatus(status: DayStatus): boolean {
  return status === 'missed'
}

export function isShowedUpStatus(status: DayStatus): boolean {
  return showedUp(status)
}

export function welcomeBackLine(gapDays: number): string {
  if (gapDays >= 21) return "It's been a while. That's completely normal."
  if (gapDays >= 7) return "It's been a couple of weeks. Good to see you."
  return "It's been a few days. Welcome back."
}

export function tinyStartLine(
  activity: Pick<Activity, 'name' | 'tracking_mode' | 'target_value' | 'target_unit'>,
): string {
  if (activity.tracking_mode === 'timer') {
    const minutes =
      activity.target_unit === 'seconds'
        ? Math.max(1, Math.round((activity.target_value ?? 120) / 60))
        : Math.max(1, activity.target_value ?? 2)
    const tiny = Math.min(minutes, 2)
    return `Start with ${tiny} minute${tiny === 1 ? '' : 's'} of ${activity.name}.`
  }
  if (activity.tracking_mode === 'count') {
    const count = Math.max(1, activity.target_value ?? 1)
    const tiny = Math.min(count, 2)
    if (activity.target_unit === 'glasses') {
      return `Start with ${tiny} ${tiny === 1 ? 'glass' : 'glasses'} of ${activity.name}.`
    }
    return `Start with ${tiny} of ${activity.name}.`
  }
  return `Start with ${activity.name}.`
}

/** Minutes to open the timer at. Null when Start should use the normal action. */
export function tinyTimerMinutes(
  activity: Pick<Activity, 'tracking_mode' | 'target_value' | 'target_unit' | 'type'>,
): number | null {
  if (activity.tracking_mode !== 'timer' || activity.type === 'weekly_n') return null
  const minutes =
    activity.target_unit === 'seconds'
      ? Math.max(1, Math.round((activity.target_value ?? 120) / 60))
      : Math.max(1, activity.target_value ?? 2)
  return Math.min(minutes, 2)
}

type DayOpts = {
  restDates?: ReadonlySet<string>
  pauses?: readonly ActivityPause[]
  freshStarts?: readonly FreshStartRange[]
  showEverything?: boolean
}

function dateHidden(date: string, opts?: DayOpts): boolean {
  if (!opts || opts.showEverything) return false
  return freshStartCovering(date, opts.freshStarts ?? []) != null
}

function existed(activity: Pick<Activity, 'created_at'>, date: string): boolean {
  return activity.created_at.slice(0, 10) <= date
}

function statusOn(
  activity: Activity,
  entries: LogEntry[],
  date: string,
  today: string,
  opts?: DayOpts,
): DayStatus {
  return getDayStatus({
    activity,
    entriesForDay: entries.filter((entry) => entry.activity_id === activity.id),
    date,
    today,
    timezone: 'UTC',
    restDates: opts?.restDates,
    pauses: opts?.pauses,
  }).status
}

/**
 * Quiet days for the whole account, walking back from yesterday.
 * Rest, skip, and pause do not extend the gap and do not break it.
 */
export function accountGap(opts: {
  activities: Activity[]
  entries: LogEntry[]
  today: string
  restDates?: ReadonlySet<string>
  pauses?: readonly ActivityPause[]
}): { gapDays: number; gapStart: string | null } {
  const active = opts.activities.filter((activity) => !activity.archived)
  if (active.length === 0) return { gapDays: 0, gapStart: null }

  const earliest = active.reduce((min, activity) => {
    const created = activity.created_at.slice(0, 10)
    return created < min ? created : min
  }, opts.today)
  if (earliest >= opts.today) return { gapDays: 0, gapStart: null }

  let gapDays = 0
  let gapStart: string | null = null
  for (let date = addDays(opts.today, -1); date >= earliest; date = addDays(date, -1)) {
    if (dateHidden(date, opts)) continue
    const living = active.filter((activity) => existed(activity, date))
    if (living.length === 0) break

    let showed = false
    let quiet = false
    for (const activity of living) {
      const status = statusOn(activity, opts.entries, date, opts.today, opts)
      if (isShowedUpStatus(status)) showed = true
      else if (isQuietStatus(status)) quiet = true
    }
    if (showed) break
    if (quiet) {
      gapDays += 1
      gapStart = date
    }
  }
  return { gapDays, gapStart }
}

export function shouldShowWelcomeBack(opts: {
  gapDays: number
  gapStart: string | null
  state: WelcomeBackState
  now?: Date
  /** Gap currently on screen, so the first open of this gap stays visible. */
  visibleGapStart?: string | null
}): boolean {
  if (opts.gapDays < WELCOME_BACK_GAP_DAYS || !opts.gapStart) return false
  const now = opts.now ?? new Date()
  if (opts.state.dismissedUntil && Date.parse(opts.state.dismissedUntil) > now.getTime()) {
    return false
  }
  if (opts.state.lastGapStartedAt === opts.gapStart && opts.visibleGapStart !== opts.gapStart) {
    return false
  }
  return true
}

function targetSize(activity: Activity): number {
  if (activity.tracking_mode === 'checkbox') return 1
  if (activity.tracking_mode === 'timer') {
    if (activity.target_unit === 'seconds') return Math.max(1, (activity.target_value ?? 60) / 60)
    return Math.max(1, activity.target_value ?? 1)
  }
  return Math.max(1, activity.target_value ?? 1)
}

function smallestTargetScore(activity: Activity): number {
  const size = targetSize(activity)
  const cap = activity.tracking_mode === 'count' ? 12 : 60
  return 1 - Math.min(size, cap) / cap
}

function lastShowedUp(
  activity: Activity,
  entries: LogEntry[],
  today: string,
  opts?: DayOpts,
): string | null {
  const created = activity.created_at.slice(0, 10)
  let latest: string | null = null
  for (let date = addDays(today, -1); date >= created; date = addDays(date, -1)) {
    if (dateHidden(date, opts)) continue
    const status = statusOn(activity, entries, date, today, opts)
    if (isShowedUpStatus(status)) {
      latest = date
      break
    }
  }
  return latest
}

function successRate(
  activity: Activity,
  entries: LogEntry[],
  today: string,
  opts?: DayOpts,
): number {
  const created = activity.created_at.slice(0, 10)
  const from = created > addDays(today, -29) ? created : addDays(today, -29)
  let scheduled = 0
  let showed = 0
  for (let date = from; date < today; date = addDays(date, 1)) {
    if (dateHidden(date, opts)) continue
    const status = statusOn(activity, entries, date, today, opts)
    if (status === 'rest' || status === 'paused' || status === 'open' || status === 'skipped') continue
    scheduled += 1
    if (isShowedUpStatus(status)) showed += 1
  }
  if (scheduled === 0) return 0
  return showed / scheduled
}

function preferredScore(activity: Activity, preferredTimes: readonly string[]): number {
  if (preferredTimes.length === 0 || !activity.usually_when) return 0.5
  const when = activity.usually_when.toLowerCase()
  const hit = preferredTimes.some((time) => when.includes(time.toLowerCase().replace(/s$/, '')))
  return hit ? 1 : 0
}

export function resumabilityScore(
  activity: Activity,
  entries: LogEntry[],
  today: string,
  opts?: DayOpts & { preferredTimes?: readonly string[] },
): number {
  const last = lastShowedUp(activity, entries, today, opts)
  const recency = last == null ? 0.4 : Math.max(0, 1 - daysBetween(last, today) / 30)
  return (
    0.4 * smallestTargetScore(activity) +
    0.3 * recency +
    0.2 * successRate(activity, entries, today, opts) +
    0.1 * preferredScore(activity, opts?.preferredTimes ?? [])
  )
}

function eligible(activity: Activity, today: string, pauses?: readonly ActivityPause[]): boolean {
  if (activity.archived) return false
  if (activity.type === 'deadline' && activity.deadline && activity.deadline < today) return false
  if (pauses?.some((pause) => pause.activityId === activity.id && pause.from <= today && (pause.until == null || pause.until >= today))) {
    return false
  }
  return true
}

/** Highest score first. Ties break toward the smaller target. */
export function rankResumable(
  activities: Activity[],
  entries: LogEntry[],
  today: string,
  opts?: DayOpts & { preferredTimes?: readonly string[] },
): Activity[] {
  return activities
    .filter((activity) => eligible(activity, today, opts?.pauses))
    .map((activity) => ({
      activity,
      score: resumabilityScore(activity, entries, today, opts),
      size: targetSize(activity),
    }))
    .sort((a, b) => b.score - a.score || a.size - b.size || a.activity.name.localeCompare(b.activity.name))
    .map((row) => row.activity)
}

export function freshStartCovers(gapStart: string, today: string): Pick<FreshStartRange, 'startedOn' | 'coversFrom' | 'coversTo'> {
  return {
    startedOn: today,
    coversFrom: gapStart,
    coversTo: addDays(today, -1),
  }
}

export function canOfferFreshStart(gapDays: number): boolean {
  return gapDays >= FRESH_START_GAP_DAYS
}

export function nextFreshStartDate(startedOn: string): string {
  return addDays(startedOn, FRESH_START_COOLDOWN_DAYS)
}

/** Most recent fresh start blocks another until 14 days after its started_on. */
export function freshStartBlock(
  ranges: readonly FreshStartRange[],
  today: string,
): { allowed: boolean; line: string | null } {
  const latest = [...ranges].sort((a, b) => b.startedOn.localeCompare(a.startedOn))[0]
  if (!latest) return { allowed: true, line: null }
  const again = nextFreshStartDate(latest.startedOn)
  if (today >= again) return { allowed: true, line: null }
  return {
    allowed: false,
    line: `You started fresh on ${formatMonthDay(latest.startedOn)}. You can do that again on ${formatMonthDay(again)}.`,
  }
}

export function freshStartCovering(
  date: string,
  ranges: readonly FreshStartRange[],
): FreshStartRange | null {
  return ranges.find((range) => date >= range.coversFrom && date <= range.coversTo) ?? null
}

export function coveragePhrase(
  ranges: readonly FreshStartRange[],
  from: string,
  to: string,
  showEverything = false,
): string | null {
  if (showEverything || ranges.length === 0) return null
  const hit = ranges.find((range) => range.coversTo >= from && range.coversFrom <= to)
  if (!hit) return null
  return `Since your fresh start on ${formatMonthDay(hit.startedOn)}.`
}

export type ComebackHit = {
  activityId: string
  name: string
  date: string
  gapDays: number
}

export const COMEBACK_MILESTONES = [1, 5, 10, 25] as const

export function comebackMilestoneCopy(count: number): string | null {
  if (count === 1) return "You came back. That's the whole idea."
  if (count === 5) return '5 comebacks. Starting again is becoming the habit.'
  if (count === 10) return '10 comebacks. That is the skill.'
  if (count === 25) return '25 comebacks. You know how to begin again.'
  return null
}

/** Comebacks for one activity inside the window. Rest, skip, and pause do not grow the gap. */
export function listActivityComebacks(
  activity: Activity,
  entries: LogEntry[],
  today: string,
  windowDays = 30,
  opts?: DayOpts,
): ComebackHit[] {
  if (activity.type === 'deadline') return []
  const created = activity.created_at.slice(0, 10)
  const windowStart = addDays(today, -(windowDays - 1))
  const from = created > windowStart ? created : windowStart
  if (from > today) return []

  const hits: ComebackHit[] = []
  let quiet = 0
  // Walk from creation so a gap that starts before the window still counts
  // when the return itself is inside the window.
  for (let date = created; date <= today; date = addDays(date, 1)) {
    if (dateHidden(date, opts)) continue
    const status = statusOn(activity, entries, date, today, opts)
    if (isQuietStatus(status)) {
      quiet += 1
      continue
    }
    if (isShowedUpStatus(status)) {
      if (quiet >= COMEBACK_GAP_DAYS && date >= windowStart) {
        hits.push({ activityId: activity.id, name: activity.name, date, gapDays: quiet })
      }
      quiet = 0
      continue
    }
    // Rest, skip, and pause neither grow the gap nor end it.
  }
  return hits
}

export function listAccountComebacks(
  activities: Activity[],
  entries: LogEntry[],
  today: string,
  windowDays = 30,
  opts?: DayOpts,
): ComebackHit[] {
  return activities
    .filter((activity) => !activity.archived)
    .flatMap((activity) => listActivityComebacks(activity, entries, today, windowDays, opts))
    .sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name))
}

export function longestReturnedGap(hits: readonly ComebackHit[]): number | null {
  if (hits.length === 0) return null
  return hits.reduce((max, hit) => Math.max(max, hit.gapDays), 0)
}

export function showedUpDayCount(
  activity: Activity,
  entries: LogEntry[],
  today: string,
  windowDays = 30,
  opts?: DayOpts,
): number {
  if (activity.type === 'deadline') return 0
  const created = activity.created_at.slice(0, 10)
  const from = created > addDays(today, -(windowDays - 1)) ? created : addDays(today, -(windowDays - 1))
  let count = 0
  for (let date = from; date <= today; date = addDays(date, 1)) {
    if (dateHidden(date, opts)) continue
    if (isShowedUpStatus(statusOn(activity, entries, date, today, opts))) count += 1
  }
  return count
}

const MILESTONE_KEY = 'resuming-comeback-milestones'

/** Null means this browser has never recorded milestones. */
export function readSeenMilestones(): number[] | null {
  try {
    const raw = localStorage.getItem(MILESTONE_KEY)
    if (raw == null) return null
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is number => typeof value === 'number')
  } catch {
    return []
  }
}

export function writeSeenMilestones(seen: readonly number[]): void {
  localStorage.setItem(MILESTONE_KEY, JSON.stringify(seen))
}

/**
 * First time we see a total, mark every milestone already reached as seen
 * so a rebuild of old history does not toast. Later crossings toast once.
 */
export function takeComebackMilestone(
  total: number,
  seen: readonly number[] | null,
): { message: string | null; seen: number[] } {
  if (seen == null) {
    return {
      message: null,
      seen: COMEBACK_MILESTONES.filter((count) => total >= count),
    }
  }
  const next = COMEBACK_MILESTONES.find((count) => total >= count && !seen.includes(count))
  if (next == null) return { message: null, seen: [...seen] }
  return { message: comebackMilestoneCopy(next), seen: [...seen, next] }
}

export function currentQuietRun(
  activity: Activity,
  entries: LogEntry[],
  today: string,
  opts?: DayOpts,
): number {
  const created = activity.created_at.slice(0, 10)
  let quiet = 0
  for (let date = addDays(today, -1); date >= created; date = addDays(date, -1)) {
    if (dateHidden(date, opts)) continue
    const status = statusOn(activity, entries, date, today, opts)
    if (isShowedUpStatus(status)) break
    if (isQuietStatus(status)) quiet += 1
  }
  return quiet
}
