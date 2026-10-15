import { todayLocalDate } from './dates'

export const PLAY_PACKAGE = 'com.cheerfulgames.resuming'
export const RETENTION_DAYS = 30
export const RETENTION_VISITS = 5

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`

export function marketingInstallLink(groupCode: string, memberCode: string): string {
  const referrer = `utm_source=${encodeURIComponent(groupCode)}&utm_medium=play&utm_campaign=${encodeURIComponent(memberCode)}`
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(referrer)}`
}

/** Play Install Referrer hands back the decoded query string. */
export function codesFromReferrer(referrer: string): { groupCode: string; memberCode: string } | null {
  const params = new URLSearchParams(referrer)
  const groupCode = params.get('utm_source')?.trim() ?? ''
  const memberCode = params.get('utm_campaign')?.trim() ?? ''
  if (!groupCode || !memberCode) return null
  return { groupCode, memberCode }
}

export type RetentionBucket = 'retained' | 'in_progress' | 'ended_short'

/**
 * Day one is startedOn. Retained means a signed-in account that opened the app on five different
 * days inside that 30-day window. Five days without an account is not retained (it stays in
 * progress until the window ends). Mirrors `marketing_is_retained` in the database.
 */
export function retentionBucket(
  startedOn: string,
  openDayCount: number,
  asOf: string,
  hasAccount: boolean,
): RetentionBucket {
  if (hasAccount && openDayCount >= RETENTION_VISITS) return 'retained'
  const last = addDays(startedOn, RETENTION_DAYS - 1)
  if (asOf <= last) return 'in_progress'
  return 'ended_short'
}

/** Default terms for a new group: pay only for people who stayed, nothing below 500 of them. */
export const DEFAULT_INSTALL_RATE = 0
export const DEFAULT_RETAINED_RATE = 20
export const DEFAULT_MIN_RETAINED = 500
export const DEFAULT_CAP = 20000

/**
 * Nothing is paid until the group has `minRetained` five-day people. After that every
 * five-day person earns `retainedRate`, plus `installRate` for each install when that is set.
 */
export function earnedRupees(
  installs: number,
  retained: number,
  installRate: number,
  retainedRate: number,
  cap: number | null,
  minRetained = DEFAULT_MIN_RETAINED,
): number {
  if (retained < minRetained) return 0
  const raw = installs * installRate + retained * retainedRate
  if (cap == null) return raw
  return Math.min(cap, raw)
}

export function formatRupees(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount)
}

function addDays(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  date.setDate(date.getDate() + days)
  return todayLocalDate(date)
}

/** Days to wait after an install's 30-day window closes before paying for it. */
export const HOLD_DAYS = 7

export interface PayableInput {
  /** Installs we counted, including ones still inside their 30 days. */
  installs: number
  /** Installs whose 30-day window closed at least HOLD_DAYS ago. */
  settledInstalls: number
  settledRetained: number
  /** What Google Play Console shows for the group. Null until someone types it in. */
  playInstalls: number | null
  installRate: number
  retainedRate: number
  cap: number | null
  /** Minimum five-day people before anything is paid. */
  minRetained: number
}

export interface Payable {
  installs: number
  retained: number
  rupees: number
}

/**
 * What is safe to pay now: only settled installs, scaled down if Play Console shows fewer
 * installs than we counted. Null until the Play Console number has been entered.
 */
export function payableNow(input: PayableInput): Payable | null {
  if (input.playInstalls == null) return null
  const factor = input.installs > 0 ? Math.min(1, input.playInstalls / input.installs) : 0
  const installs = Math.floor(input.settledInstalls * factor)
  const retained = Math.min(Math.floor(input.settledRetained * factor), installs)
  const rupees = earnedRupees(
    installs,
    retained,
    input.installRate,
    input.retainedRate,
    input.cap,
    input.minRetained,
  )
  return { installs, retained, rupees }
}

/** Warns when we count clearly more installs than Google Play Console does. */
export function playGap(ours: number, play: number | null): { missing: number; percent: number } | null {
  if (play == null || ours <= play) return null
  const missing = ours - play
  if (missing < 10 || missing / ours < 0.2) return null
  return { missing, percent: Math.round((100 * missing) / ours) }
}
