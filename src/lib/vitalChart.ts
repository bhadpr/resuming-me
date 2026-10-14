import { habitTemplateId } from '../data/habitArt'
import type { VitalDirection } from './vitalTargets'

/** Blood pressure target: below 120/80 mmHg. */
export const BP_UPPER_LIMIT = 120
export const BP_LOWER_LIMIT = 80
/** Resting heart rate target: 60 to 100 bpm. */
export const HR_LOW = 60
export const HR_HIGH = 100

export type VitalTarget =
  | { kind: 'bp'; upper: number; lower: number }
  | { kind: 'band'; low: number; high: number }
  /** A daily goal: a day below it is off target. */
  | { kind: 'atLeast'; value: number }
  /** Weight: on target once it reaches the target from the side it started on. */
  | { kind: 'weight'; value: number; direction: VitalDirection | null }
  /** A target we draw but cannot judge, such as a custom number. */
  | { kind: 'line'; value: number }

export interface VitalPoint {
  date: string
  value: number
  /** The lower number of a pair such as blood pressure. */
  secondary: number | null
}

const AT_LEAST_IDS: ReadonlySet<string> = new Set([
  'steps',
  'water',
  'protein',
  'fasting',
  'sleep_hours',
])

/**
 * The target a vital's chart draws.
 * Blood pressure and heart rate have fixed ranges. Everything else uses the target saved on this device.
 */
export function vitalTargetFor(
  metric: { template_id?: string | null; name?: string | null },
  saved: number | null,
  direction: VitalDirection | null,
): VitalTarget | null {
  const id = habitTemplateId(metric)
  if (id === 'blood_pressure') return { kind: 'bp', upper: BP_UPPER_LIMIT, lower: BP_LOWER_LIMIT }
  if (id === 'heart_rate') return { kind: 'band', low: HR_LOW, high: HR_HIGH }
  if (saved == null) return null
  if (id === 'weight') return { kind: 'weight', value: saved, direction }
  if (id != null && AT_LEAST_IDS.has(id)) return { kind: 'atLeast', value: saved }
  return { kind: 'line', value: saved }
}

/**
 * The goal of the habit with the same template, for vitals that are also daily-goal habits
 * (water, protein, fasting, steps, sleep). Used when no target is saved on this device.
 */
export function habitGoalFor(
  metric: { template_id?: string | null; name?: string | null },
  activities: ReadonlyArray<{ template_id?: string | null; target_value?: number | null; archived?: boolean }>,
): number | null {
  const id = habitTemplateId(metric)
  if (id == null || !AT_LEAST_IDS.has(id)) return null
  const match = activities.find(
    (a) => !a.archived && a.template_id === id && a.target_value != null && Number(a.target_value) > 0,
  )
  return match ? Number(match.target_value) : null
}

/** Which way a weight goal points, from the first reading we have. Null when it is already on the target. */
export function weightDirection(target: number, firstValue: number): VitalDirection | null {
  if (firstValue > target) return 'down'
  if (firstValue < target) return 'up'
  return null
}

export type PointStatus = 'on' | 'off'

/** Blood pressure is judged at each end: the upper number against 120 and the lower against 80. */
export function bpEnds(
  target: Extract<VitalTarget, { kind: 'bp' }>,
  point: VitalPoint,
): { upper: PointStatus; lower: PointStatus | null } {
  return {
    upper: point.value < target.upper ? 'on' : 'off',
    lower: point.secondary == null ? null : point.secondary < target.lower ? 'on' : 'off',
  }
}

/** Null when this vital has no target, or one we cannot judge. */
export function pointStatus(target: VitalTarget | null, point: VitalPoint): PointStatus | null {
  if (!target || target.kind === 'line') return null
  if (target.kind === 'bp') {
    const ends = bpEnds(target, point)
    return ends.upper === 'on' && ends.lower !== 'off' ? 'on' : 'off'
  }
  if (target.kind === 'band') {
    return point.value >= target.low && point.value <= target.high ? 'on' : 'off'
  }
  if (target.kind === 'atLeast') return point.value >= target.value ? 'on' : 'off'
  if (target.direction == null) return null
  if (target.direction === 'down') return point.value <= target.value ? 'on' : 'off'
  return point.value >= target.value ? 'on' : 'off'
}

/** "5 of 7 readings within target". Null when nothing can be judged. */
export function withinTarget(
  target: VitalTarget | null,
  points: readonly VitalPoint[],
): { met: number; total: number } | null {
  let met = 0
  let total = 0
  for (const point of points) {
    const status = pointStatus(target, point)
    if (status == null) continue
    total += 1
    if (status === 'on') met += 1
  }
  return total === 0 ? null : { met, total }
}

/** "126/82" for a pair, or "72" for a single number. */
export function formatPair(value: number, secondary: number | null | undefined): string {
  const round = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))
  return secondary == null ? round(value) : `${round(value)}/${round(secondary)}`
}

/** A change for a pair, such as "+2/-1". */
export function formatPairDelta(delta: number | null, secondaryDelta: number | null): string {
  if (delta == null) return '—'
  const signed = (n: number) => `${n > 0 ? '+' : ''}${Number.isInteger(n) ? n : n.toFixed(1)}`
  return secondaryDelta == null ? signed(delta) : `${signed(delta)}/${signed(secondaryDelta)}`
}
