import { addDays } from './dates'
import { translate, type Locale } from './i18n'

/** A walking day counts at most this many steps. The server applies the same cap. */
export const WALK_CAP = 10_000

export type ScorePhase = 'before' | 'so_far' | 'morning' | 'final'

export interface PaceTeam {
  name: string
  /** Exact steps per day. Null when the pace is hidden. */
  pace: number | null
}

export function capWalkingSteps(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(WALK_CAP, Math.floor(raw))
}

/** One sitting counts at most an hour. A race day counts at most 60 minutes, a shared day at most 5 hours. */
export const SIT_CAP_SECONDS = 3_600
export const RACE_DAY_MINUTES = 60
export const TOGETHER_DAY_MINUTES = 300

export function capMeditationMinutes(
  sessionsSeconds: number[],
  shape: 'race' | 'together',
): { raw: number; capped: number } {
  let raw = 0
  let sit = 0
  for (const seconds of sessionsSeconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) continue
    const whole = Math.floor(seconds)
    raw += Math.floor(whole / 60)
    sit += Math.floor(Math.min(whole, SIT_CAP_SECONDS) / 60)
  }
  const cap = shape === 'race' ? RACE_DAY_MINUTES : TOGETHER_DAY_MINUTES
  return { raw, capped: Math.min(sit, cap) }
}

export type ChallengeMeasure = 'steps' | 'minutes'

/** Public step numbers round to the nearest 100. Public minutes round to the nearest minute. */
export function publicChallengeCount(value: number, measure: ChallengeMeasure): number {
  if (!Number.isFinite(value)) return 0
  if (measure === 'minutes') return Math.round(value)
  return roundSteps(value)
}

/** A shared meditation total is stored in minutes and shown in hours. */
export function meditationHours(minutes: number): number {
  if (!Number.isFinite(minutes) || minutes <= 0) return 0
  const hours = minutes / 60
  if (hours >= 100) return Math.round(hours)
  return Math.round(hours * 10) / 10
}

/** Public step numbers round to the nearest 100. Halfway rounds away from zero. */
export function roundSteps(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value / 100) * 100
}

function zoneOffsetMinutes(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
  }).formatToParts(new Date(ms))
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value)
  const wall = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'))
  return Math.round((wall - Math.floor(ms / 60_000) * 60_000) / 60_000)
}

/** A clock time on a calendar date in `timeZone`, as a UTC instant. */
export function zonedWallTime(date: string, hour: number, minute: number, timeZone: string): Date {
  const [year, month, day] = date.split('-').map(Number)
  const wall = Date.UTC(year, month - 1, day, hour, minute)
  const guess = wall - zoneOffsetMinutes(wall, timeZone) * 60_000
  const instant = wall - zoneOffsetMinutes(guess, timeZone) * 60_000
  return new Date(instant)
}

/** Midnight to the next midnight on the challenge clock. */
export function challengeDayWindow(date: string, timeZone: string): { start: Date; end: Date } {
  return {
    start: zonedWallTime(date, 0, 0, timeZone),
    end: zonedWallTime(addDays(date, 1), 0, 0, timeZone),
  }
}

/** 9:00 the next morning on the challenge clock, when that walking day freezes. */
export function walkingFreezeAt(date: string, timeZone: string): Date {
  return zonedWallTime(addDays(date, 1), 9, 0, timeZone)
}

function amount(
  locale: Locale,
  value: number,
  measure: 'steps' | 'minutes' | 'hours' | 'hours-whole',
): string {
  const shown =
    measure === 'steps'
      ? roundSteps(value)
      : measure === 'minutes' || measure === 'hours-whole'
        ? Math.round(value)
        : Math.round(value * 10) / 10
  return shown.toLocaleString(locale === 'en' ? 'en-IN' : locale)
}

function joinNames(names: string[], andWord: string): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length === 2) return `${names[0]} ${andWord} ${names[1]}`
  return `${names.slice(0, -1).join(', ')}, ${andWord} ${names[names.length - 1]}`
}

function raceSentence(
  locale: Locale,
  day: number,
  teams: PaceTeam[],
  final: boolean,
  measure: ChallengeMeasure,
): string {
  const ranked = teams
    .filter((team): team is PaceTeam & { pace: number } => team.pace != null)
    .map((team) => ({ name: team.name, rounded: publicChallengeCount(team.pace, measure) }))
    .sort((a, b) => b.rounded - a.rounded || a.name.localeCompare(b.name))
  if (ranked.length === 0) return ''
  const lead = ranked[0].rounded
  const leaders = ranked.filter((team) => team.rounded === lead)
  const rest = ranked.filter((team) => team.rounded !== lead)
  const andWord = translate(locale, 'challenge.and')
  const unit = translate(
    locale,
    measure === 'minutes' ? 'challenge.unitMinutes' : 'challenge.unitSteps',
  )
  const leaderNames = joinNames(leaders.map((team) => team.name), andWord)
  const behind = rest.map((team, index) =>
    translate(locale, index === 0 ? 'challenge.line.behindFirst' : 'challenge.line.behindNext', {
      name: team.name,
      gap: amount(locale, lead - team.rounded, measure),
      unit,
    }),
  )
  if (leaders.length > 1 && rest.length === 0) {
    return translate(locale, final ? 'challenge.line.finalEven' : 'challenge.line.even', {
      day,
      names: leaderNames,
    })
  }
  if (leaders.length > 1) {
    return translate(locale, 'challenge.line.evenRest', {
      day,
      names: leaderNames,
      rest: behind.join(', '),
    })
  }
  if (rest.length === 0) {
    return translate(locale, final ? 'challenge.line.finalAlone' : 'challenge.line.leadsAlone', {
      day,
      leader: leaderNames,
      pace: amount(locale, lead, measure),
      unit,
    })
  }
  if (rest.length === 1) {
    return translate(locale, final ? 'challenge.line.finalWinTwo' : 'challenge.line.leadsTwo', {
      day,
      leader: leaderNames,
      other: rest[0].name,
      gap: amount(locale, lead - rest[0].rounded, measure),
      unit,
    })
  }
  const restText = behind.join(', ')
  return translate(locale, final ? 'challenge.line.finalWinMore' : 'challenge.line.leadsMore', {
    day,
    leader: leaderNames,
    rest: restText,
  })
}

function goalSentence(
  locale: Locale,
  input: {
    day: number
    total: number
    target: number
    daysLeft: number
    final: boolean
    measure: ChallengeMeasure
  },
): string {
  const hours = input.measure === 'minutes'
  const scale = hours ? 60 : 1
  const display = hours ? 'hours' : 'steps'
  const coarseHours = hours && input.target / 60 >= 100
  const show = (value: number) =>
    amount(locale, value / scale, coarseHours ? 'hours-whole' : display)
  const total = show(input.total)
  const target = show(input.target)
  const unit = translate(locale, hours ? 'challenge.unitHours' : 'challenge.unitSteps')
  if (input.final) {
    if (input.total >= input.target) {
      return translate(locale, 'challenge.line.finalGoal', { total, target, unit })
    }
    return translate(locale, 'challenge.line.finalShort', { total, target, unit })
  }
  if (input.total >= input.target) {
    return translate(locale, 'challenge.line.goalReached', {
      target,
      days: input.daysLeft,
      unit,
    })
  }
  const left = show(Math.max(0, input.target - input.total))
  return translate(
    locale,
    input.daysLeft === 1 ? 'challenge.line.goalOneDay' : 'challenge.line.goal',
    { day: input.day, total, target, left, days: input.daysLeft, unit },
  )
}

export interface WalkingScoreInput {
  shape: 'race' | 'together'
  phase: ScorePhase
  dayNumber: number | null
  /** Latest frozen day, when one exists. */
  frozenDayNumber: number | null
  teams: PaceTeam[]
  /** Frozen days only, for the morning card while today is still open. */
  recordTeams?: PaceTeam[]
  total: number | null
  recordTotal?: number | null
  target: number | null
  daysLeft: number | null
  recordDaysLeft?: number | null
  joined: number
  startsLabel: string
  /** Minutes challenges round to the minute and show a shared goal in hours. */
  measure?: ChallengeMeasure
}

/** The morning record, and the line a daytime share uses. */
export function walkingShareLines(
  input: WalkingScoreInput,
  locale: Locale = 'en',
): { current: string; record: string | null } {
  const measure = input.measure ?? 'steps'
  const recordTeams = input.recordTeams ?? input.teams
  const recordTotal = input.recordTotal === undefined ? input.total : input.recordTotal
  const recordDaysLeft = input.recordDaysLeft ?? input.daysLeft
  const recordLine =
    input.frozenDayNumber == null
      ? null
      : input.shape === 'race'
        ? raceSentence(locale, input.frozenDayNumber, recordTeams, input.phase === 'final', measure)
        : recordTotal == null || input.target == null || recordDaysLeft == null
          ? null
          : goalSentence(locale, {
              day: input.frozenDayNumber,
              total: recordTotal,
              target: input.target,
              daysLeft: recordDaysLeft,
              final: input.phase === 'final',
              measure,
            })
  const record = recordLine || null

  if (input.phase === 'before') {
    return {
      current: translate(locale, 'challenge.line.before', {
        date: input.startsLabel,
        count: input.joined,
      }),
      record: null,
    }
  }

  if (input.phase === 'final' || input.phase === 'morning') {
    return { current: record ?? '', record }
  }

  const live =
    input.shape === 'race'
      ? input.dayNumber == null
        ? ''
        : raceSentence(locale, input.dayNumber, input.teams, false, measure) ||
          translate(locale, 'challenge.line.dayJoined', { day: input.dayNumber, count: input.joined })
      : input.dayNumber == null || input.total == null || input.target == null || input.daysLeft == null
        ? translate(locale, 'challenge.line.dayJoined', {
            day: input.dayNumber ?? 0,
            count: input.joined,
          })
        : goalSentence(locale, {
            day: input.dayNumber,
            total: input.total,
            target: input.target,
            daysLeft: input.daysLeft,
            final: false,
            measure,
          })

  return {
    current: translate(locale, 'challenge.line.soFar', { line: live }),
    record,
  }
}

export function walkingShareMessage(line: string, url: string): string {
  return `${line}\n${url}`
}
