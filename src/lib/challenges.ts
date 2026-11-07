import { Capacitor } from '@capacitor/core'
import { walkingShareLines, walkingShareMessage, type WalkingScoreInput } from './challengeScore'
import { addDays, daysBetween, todayLocalDate } from './dates'
import type { Locale } from './i18n'
import type { PhoneSteps } from './healthSteps'
import { createSupabaseClient } from './supabase'

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'
const ORIGIN = 'https://resuming.me'

export const CHALLENGE_MEMBER_CAP = 3
export const CHALLENGE_CREATOR_CAP = 5

export type ChallengeShape = 'race' | 'together'
export type WalkingJoinGate = 'join' | 'confirm-empty' | 'connect' | 'blocked'

export type ChallengeIssue =
  | 'name'
  | 'teams'
  | 'oneTeam'
  | 'target'
  | 'dates'
  | 'past'
  | 'creatorCap'
  | 'memberCap'
  | 'notAndroid'
  | 'already'
  | 'rate'
  | 'deleteBlocked'
  | 'raceClosed'
  | 'signIn'
  | 'switchedOff'
  | 'ended'
  | 'unavailable'
  | 'failed'

export interface ChallengeTeam {
  id: string
  name: string
  memberCount: number
  pace: number | null
  recordPace: number | null
  /** 1–4. Matches /team-<image>.jpg when photoPath is empty. */
  image: number
  photoPath: string | null
}

/** The picture WhatsApp shows for every walking challenge. */
export const CHALLENGE_CARD_IMAGE = 'https://resuming.me/og-walk.jpg'

export const TEAM_IMAGE_COUNT = 4

export function teamImageSrc(image: number): string {
  const n = image >= 1 && image <= TEAM_IMAGE_COUNT ? image : 1
  return `/team-${n}.jpg`
}

export interface ChallengeBoard {
  id: string
  code: string
  title: string | null
  shape: ChallengeShape
  kind: string
  status: 'active' | 'switched_off' | 'ended'
  timeZone: string
  startsOn: string
  endsOn: string
  target: number | null
  isOwner: boolean
  myTeamId: string | null
  myTeamName: string | null
  teams: ChallengeTeam[]
  totalSteps: number | null
  recordTotal: number | null
  dayNumber: number | null
  frozenDayNumber: number | null
  daysLeft: number | null
  recordDaysLeft: number | null
  scorePhase: 'before' | 'so_far' | 'morning' | 'final' | null
  joinedCount: number
  cardReady: boolean
  myRaw: number | null
  myCapped: number | null
  myDayClosed: boolean
  myLeavingOn: string | null
  /** The organizer's picture for the WhatsApp card. */
  cardPhoto: string | null
}

export function isChallengeCode(value: string): boolean {
  return new RegExp(`^[${CODE_ALPHABET}]{12}$`).test(value)
}

/** Changes when the card picture changes, so WhatsApp treats the link as new. */
export function challengePhotoVersion(photoPath?: string | null): string | null {
  const file = photoPath?.split('/').pop()?.replace(/\.jpg$/i, '') ?? ''
  if (!/^[a-z0-9-]{8,64}$/.test(file)) return null
  return file.slice(0, 8)
}

export function challengeUrl(code: string, photoPath?: string | null): string {
  const version = challengePhotoVersion(photoPath)
  return version ? `${ORIGIN}/t/${code}?v=${version}` : `${ORIGIN}/t/${code}`
}

/** Today's date on a challenge clock, as YYYY-MM-DD. */
export function challengeDateInZone(timeZone: string, now = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-CA', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  }
}

export function challengeHasEnded(
  board: { status: string; scorePhase: string | null; endsOn: string; timeZone: string },
  now = new Date(),
): boolean {
  return (
    board.status === 'ended' ||
    board.scorePhase === 'final' ||
    board.endsOn < challengeDateInZone(board.timeZone, now)
  )
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  } catch {
    return 'UTC'
  }
}

/** Seven days beginning on the start date. */
export function raceLastDay(start: string): string {
  return addDays(start, 6)
}

/** A shared goal lasts 7 to 366 days, counting the start day. */
export function goalSpanOk(start: string, end: string): boolean {
  const span = daysBetween(start, end)
  return span >= 6 && span <= 365
}

export function cleanChallengeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ')
}

export function teamNamesOk(shape: ChallengeShape, names: readonly string[]): boolean {
  const cleaned = names.map(cleanChallengeName).filter(Boolean)
  const unique = new Set(cleaned.map((name) => name.toLowerCase()))
  if (unique.size !== cleaned.length) return false
  if (cleaned.some((name) => name.length > 40)) return false
  if (shape === 'race') return cleaned.length >= 2 && cleaned.length <= 4
  return cleaned.length === 1
}

export function stepTargetOk(raw: string): number | null {
  const digits = raw.replace(/,/g, '').trim()
  if (!/^\d+$/.test(digits)) return null
  const value = Number(digits)
  if (!Number.isSafeInteger(value) || value < 1 || value > 100_000_000_000) return null
  return value
}

/** An hour target is stored as minutes. 100,000 hours is the form's ceiling. */
export function hourTargetOk(raw: string): number | null {
  const digits = raw.replace(/,/g, '').trim()
  if (!/^\d+$/.test(digits)) return null
  const hours = Number(digits)
  if (!Number.isSafeInteger(hours) || hours < 1 || hours > 100_000) return null
  return hours * 60
}

export const MEDITATION_TEMPLATES = [
  'meditate',
  'bhastrika',
  'kapalabhati',
  'anuloma_viloma',
  'bhramari',
  'prayer',
  'rejuvenation',
] as const

export function isMeditationTemplate(templateId: string | null | undefined): boolean {
  return MEDITATION_TEMPLATES.some((id) => id === templateId)
}

/** Web and iPhone can watch a walking challenge. Only Android can join. */
export function walkingJoinGate(platform: string, steps: PhoneSteps | null): WalkingJoinGate {
  if (platform !== 'android') return 'blocked'
  if (!steps || steps.status === 'unavailable') return 'blocked'
  if (steps.status === 'needs-permission' || steps.status === 'denied') return 'connect'
  if (steps.steps <= 0) return 'confirm-empty'
  return 'join'
}

export function challengeIssue(error: { message?: string } | null): ChallengeIssue {
  const message = error?.message ?? ''
  if (message.includes('challenge_creator_cap')) return 'creatorCap'
  if (message.includes('challenge_member_cap')) return 'memberCap'
  if (message.includes('challenge_past_start')) return 'past'
  if (message.includes('challenge_bad_dates')) return 'dates'
  if (message.includes('challenge_bad_target')) return 'target'
  if (message.includes('challenge_bad_teams')) return 'teams'
  if (message.includes('challenge_bad_title')) return 'name'
  if (message.includes('challenge_not_android')) return 'notAndroid'
  if (message.includes('challenge_already_joined')) return 'already'
  if (message.includes('challenge_rate_limited')) return 'rate'
  if (message.includes('challenge_delete_blocked')) return 'deleteBlocked'
  if (message.includes('challenge_race_closed')) return 'raceClosed'
  if (message.includes('challenge_sign_in')) return 'signIn'
  if (message.includes('challenge_switched_off')) return 'switchedOff'
  if (message.includes('challenge_ended')) return 'ended'
  if (message.includes('challenge_unavailable')) return 'unavailable'
  return 'failed'
}

export function challengeIssueKey(issue: ChallengeIssue): string {
  if (issue === 'signIn') return 'challenge.signIn'
  if (issue === 'switchedOff') return 'challenge.switchedOff'
  if (issue === 'ended' || issue === 'unavailable') return 'challenge.unavailable'
  return `challenge.errors.${issue}`
}

interface BoardRow {
  challenge_id: string
  board_code: string
  title: string | null
  shape: string
  kind: string
  status: string
  time_zone: string
  starts_on: string
  ends_on: string
  target: number | null
  is_owner: boolean
  my_team_id: string | null
  my_team_name: string | null
  team_id: string | null
  team_name: string | null
  member_count: number
  pace: number | null
  record_pace: number | null
  total_steps: number | null
  record_total: number | null
  day_number: number | null
  frozen_day_number: number | null
  days_left: number | null
  record_days_left: number | null
  score_phase: string | null
  joined_count: number
  card_ready: boolean
  my_raw: number | null
  my_capped: number | null
  my_day_closed: boolean
  my_leaving_on: string | null
  image?: number | null
  photo_path?: string | null
  card_path?: string | null
}

export async function getChallengeBoard(code: string): Promise<ChallengeBoard | null> {
  if (!isChallengeCode(code)) return null
  const { data, error } = await createSupabaseClient().rpc('get_challenge_board', { p_code: code })
  if (error) throw error
  const rows = (data ?? []) as BoardRow[]
  const first = rows[0]
  if (!first || first.status === 'deleted') return null
  const pictures =
    'card_path' in first
      ? {
          teams: new Map(
            rows
              .filter((row): row is BoardRow & { team_id: string } => Boolean(row.team_id))
              .map((row) => [row.team_id, { image: row.image && row.image > 0 ? row.image : 1, photoPath: row.photo_path ?? null }]),
          ),
          cardPath: first.card_path ?? null,
        }
      : await teamPictures(code)
  const shape: ChallengeShape = first.shape === 'together' ? 'together' : 'race'
  return {
    id: first.challenge_id,
    code: first.board_code,
    title: first.title,
    shape,
    kind: first.kind,
    status:
      first.status === 'switched_off' || first.status === 'ended' ? first.status : 'active',
    timeZone: first.time_zone,
    startsOn: first.starts_on,
    endsOn: first.ends_on,
    target: first.target,
    isOwner: first.is_owner,
    myTeamId: first.my_team_id,
    myTeamName: first.my_team_name,
    teams: rows
      .filter((row): row is BoardRow & { team_id: string; team_name: string } =>
        Boolean(row.team_id && row.team_name),
      )
      .map((row, index) => ({
        id: row.team_id,
        name: row.team_name,
        memberCount: row.member_count,
        pace: row.pace,
        recordPace: row.record_pace,
        image: pictures.teams.get(row.team_id)?.image ?? (index % TEAM_IMAGE_COUNT) + 1,
        photoPath: pictures.teams.get(row.team_id)?.photoPath ?? null,
      })),
    totalSteps: first.total_steps,
    recordTotal: first.record_total,
    dayNumber: first.day_number,
    frozenDayNumber: first.frozen_day_number,
    daysLeft: first.days_left,
    recordDaysLeft: first.record_days_left,
    scorePhase:
      first.score_phase === 'before' ||
      first.score_phase === 'so_far' ||
      first.score_phase === 'morning' ||
      first.score_phase === 'final'
        ? first.score_phase
        : null,
    joinedCount: first.joined_count ?? 0,
    cardReady: first.card_ready === true,
    myRaw: first.my_raw,
    myCapped: first.my_capped,
    myDayClosed: first.my_day_closed === true,
    myLeavingOn: first.my_leaving_on,
    cardPhoto: pictures.cardPath,
  }
}

export async function createWalkingChallenge(input: {
  title: string
  shape: ChallengeShape
  kind?: 'walk' | 'meditate'
  startsOn: string
  endsOn: string | null
  target: number | null
  teamNames: string[]
  teamImages?: number[]
  join: boolean
  joinTeam: number | null
}): Promise<{ id: string; code: string }> {
  const { data, error } = await createSupabaseClient().rpc('create_walking_challenge', {
    p_title: cleanChallengeName(input.title),
    p_shape: input.shape,
    p_starts_on: input.startsOn,
    p_ends_on: input.shape === 'race' ? raceLastDay(input.startsOn) : input.endsOn ?? input.startsOn,
    p_target: input.shape === 'together' ? input.target : null,
    p_team_names: input.teamNames.map(cleanChallengeName).filter(Boolean),
    p_time_zone: deviceTimeZone(),
    p_join: input.join,
    p_join_team: input.join ? (input.joinTeam ?? 0) : 0,
    p_platform: Capacitor.getPlatform(),
    p_kind: input.kind ?? 'walk',
  })
  if (error) throw error
  const row = data?.[0]
  if (!row) throw new Error('challenge_unavailable')
  const images = (input.teamImages ?? []).filter((image) => image >= 1 && image <= TEAM_IMAGE_COUNT)
  if (images.length > 0) {
    const { error: imageError } = await createSupabaseClient().rpc('set_challenge_team_images', {
      p_id: row.id,
      p_images: images,
    })
    if (imageError) {
      // The challenge is already created. The page still shows a picture for each team.
    }
  }
  return { id: row.id, code: row.code }
}

async function teamPictures(code: string): Promise<{
  teams: Map<string, { image: number; photoPath: string | null }>
  cardPath: string | null
}> {
  const empty = { teams: new Map<string, { image: number; photoPath: string | null }>(), cardPath: null }
  const { data, error } = await createSupabaseClient().rpc('challenge_team_pictures', { p_code: code })
  if (error || !data) return empty
  return {
    teams: new Map(
      data.map((row) => [row.team_id, { image: row.image, photoPath: row.photo_path ?? null }]),
    ),
    cardPath: data[0]?.card_path ?? null,
  }
}

export async function joinWalkingChallenge(code: string, teamId: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('join_walking_challenge', {
    p_code: code,
    p_team_id: teamId,
    p_platform: Capacitor.getPlatform(),
  })
  if (error) throw error
}

export async function setWalkingChallengeStatus(
  id: string,
  status: 'switched_off' | 'deleted',
): Promise<void> {
  const { error } = await createSupabaseClient().rpc('set_walking_challenge_status', {
    p_id: id,
    p_status: status,
  })
  if (error) throw error
}

export function challengeToday(): string {
  return todayLocalDate()
}

export function boardScoreInput(board: ChallengeBoard, startsLabel: string): WalkingScoreInput {
  return {
    shape: board.shape,
    phase: board.scorePhase ?? 'before',
    dayNumber: board.dayNumber,
    frozenDayNumber: board.frozenDayNumber,
    teams: board.teams.map((team) => ({ name: team.name, pace: team.pace })),
    recordTeams: board.teams.map((team) => ({ name: team.name, pace: team.recordPace })),
    total: board.totalSteps,
    recordTotal: board.recordTotal,
    target: board.target,
    daysLeft: board.daysLeft,
    recordDaysLeft: board.recordDaysLeft,
    joined: board.joinedCount,
    startsLabel,
    measure: board.kind === 'meditate' ? 'minutes' : 'steps',
  }
}

export function boardShareMessage(board: ChallengeBoard, startsLabel: string, locale: Locale, record = false): string {
  const lines = walkingShareLines(boardScoreInput(board, startsLabel), locale)
  const line = record ? lines.record ?? lines.current : lines.current
  return walkingShareMessage(line, challengeUrl(board.code, board.cardPhoto))
}

export async function saveWalkingSteps(
  code: string,
  days: { day: string; raw: number }[],
): Promise<void> {
  if (days.length === 0) return
  const { error } = await createSupabaseClient().rpc('save_walking_steps', {
    p_code: code,
    p_days: days,
  })
  if (error) throw error
}

export async function walkingSyncDays(): Promise<{ code: string; timeZone: string; day: string }[]> {
  const { data, error } = await createSupabaseClient().rpc('walking_sync_days')
  if (error) throw error
  return (data ?? []).map((row) => ({
    code: row.code,
    timeZone: row.time_zone,
    day: row.day,
  }))
}

export type ChallengePhase = 'current' | 'soon' | 'past' | 'later'

export interface ChallengeIndexRow {
  role: 'member' | 'run'
  code: string
  title: string
  cardPath: string | null
  kind: 'walk' | 'meditate'
  startsOn: string
  endsOn: string
  phase: ChallengePhase
}

export interface ChallengeHistory {
  teams: { teamId: string; day: string; steps: number }[]
  mine: { day: string; steps: number }[]
}

/** Team averages by day, plus the signed-in person's own steps. */
export async function getChallengeHistory(code: string): Promise<ChallengeHistory> {
  const empty = { teams: [], mine: [] }
  if (!isChallengeCode(code)) return empty
  const { data, error } = await createSupabaseClient().rpc('challenge_day_history', { p_code: code })
  if (error || !data) return empty
  return {
    teams: data
      .filter((row) => row.kind === 'team' && row.team_id)
      .map((row) => ({ teamId: row.team_id as string, day: row.day, steps: row.steps })),
    mine: data.filter((row) => row.kind === 'mine').map((row) => ({ day: row.day, steps: row.steps })),
  }
}

export async function myChallengeIndex(): Promise<ChallengeIndexRow[]> {
  const { data, error } = await createSupabaseClient().rpc('my_challenge_index')
  if (error) throw error
  return (data ?? []).map((row) => ({
    role: row.role === 'run' ? 'run' : 'member',
    code: row.code,
    title: row.title,
    cardPath: row.card_path ?? null,
    kind: row.kind === 'meditate' ? 'meditate' : 'walk',
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    phase:
      row.phase === 'soon' || row.phase === 'past' || row.phase === 'later' || row.phase === 'current'
        ? row.phase
        : 'current',
  }))
}

export async function scheduleChallengeLeave(id: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('schedule_challenge_leave', { p_id: id })
  if (error) throw error
}

export async function cancelChallengeLeave(id: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('cancel_challenge_leave', { p_id: id })
  if (error) throw error
}

export async function endWalkingChallenge(id: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('end_walking_challenge', { p_id: id })
  if (error) throw error
}

export async function markChallengeShared(id: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('mark_challenge_shared', { p_id: id })
  if (error) throw error
}

const PLAY_PACKAGE = 'com.cheerfulgames.resuming'

export function challengeCodeFromReferrer(referrer: string): string | null {
  const code = new URLSearchParams(referrer).get('challenge')?.trim().toLowerCase() ?? ''
  return isChallengeCode(code) ? code : null
}

export function challengeInstallLink(code: string): string {
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(`challenge=${code}`)}`
}

const INSTALL_CHALLENGE_CHECKED_KEY = 'resuming-install-challenge-checked'

/** The challenge code an install came with, once per install. */
export async function takeInstallChallengeCode(
  read: () => Promise<{ referrer: string } | null>,
): Promise<string | null> {
  try {
    if (localStorage.getItem(INSTALL_CHALLENGE_CHECKED_KEY)) return null
  } catch {
    return null
  }
  const attribution = await read()
  if (!attribution) return null
  try {
    localStorage.setItem(INSTALL_CHALLENGE_CHECKED_KEY, '1')
  } catch {
    /* the join page can show again next start */
  }
  return challengeCodeFromReferrer(attribution.referrer)
}

export function challengeCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname !== 'resuming.me' && parsed.hostname !== 'www.resuming.me') return null
    const match = /^\/t\/([a-z0-9]+)\/?$/i.exec(parsed.pathname)
    const code = match?.[1].toLowerCase() ?? ''
    return isChallengeCode(code) ? code : null
  } catch {
    return null
  }
}
