/** The numbers behind the admin charts. Pure functions, so they are easy to check. */

export type Tone = 'blue' | 'green' | 'amber' | 'rose' | 'violet' | 'teal' | 'orange' | 'slate'

/** Slice colors in the order they are used. "Other" always gets the last, grey one. */
export const SLICE_TONES: Tone[] = ['blue', 'green', 'amber', 'violet', 'rose', 'teal', 'orange']

export interface ChartRow {
  key: string
  label: string
  count: number
  /** A color that means something, such as red for a problem. Otherwise colors are handed out in order. */
  tone?: Tone
}

export interface Slice extends ChartRow {
  tone: Tone
  /** 0 to 1 of the total. */
  share: number
}

/**
 * The biggest `max - 1` rows keep their own slice and the rest are folded into "Other",
 * so a pie never has a dozen hard-to-read slivers. Rows with no count are left out.
 */
export function donutSlices(rows: ChartRow[], max = 6): Slice[] {
  const real = rows.filter((row) => row.count > 0).sort((a, b) => b.count - a.count)
  const total = real.reduce((sum, row) => sum + row.count, 0)
  if (total === 0) return []
  const keep = real.length > max ? real.slice(0, max - 1) : real
  const rest = real.length > max ? real.slice(max - 1) : []
  const slices: Slice[] = keep.map((row, index) => ({
    ...row,
    tone: row.tone ?? SLICE_TONES[index % SLICE_TONES.length],
    share: row.count / total,
  }))
  if (rest.length > 0) {
    const count = rest.reduce((sum, row) => sum + row.count, 0)
    slices.push({ key: '__other', label: `Other (${rest.length})`, count, tone: 'slate', share: count / total })
  }
  return slices
}

export interface DonutSegment {
  /** Length of the colored part of the ring and the gap after it, in ring units. */
  dash: number
  gap: number
  /** Where the part starts along the ring. */
  offset: number
}

/**
 * The ring is drawn as one circle per slice, using a dashed line. Each part starts where the last
 * one ended. A single slice fills the whole ring.
 */
export function donutSegments(slices: Slice[], circumference: number): DonutSegment[] {
  let used = 0
  return slices.map((slice) => {
    const dash = Math.max(0, slice.share * circumference)
    const segment = { dash, gap: Math.max(0, circumference - dash), offset: -used }
    used += dash
    return segment
  })
}

export interface FunnelStep {
  label: string
  value: number
  hint?: string
}

export interface FunnelRow extends FunnelStep {
  /** Share of the first step, 0 to 1. Null when the first step is empty. */
  ofFirst: number | null
  /** Share of the step before. Null for the first step or when that one is empty. */
  ofPrevious: number | null
  /** People lost since the step before. Zero for the first step. */
  lost: number
}

export function funnelRows(steps: FunnelStep[]): FunnelRow[] {
  const first = steps[0]?.value ?? 0
  return steps.map((step, index) => {
    const previous = index > 0 ? steps[index - 1].value : null
    return {
      ...step,
      ofFirst: first > 0 ? step.value / first : null,
      ofPrevious: previous != null && previous > 0 ? step.value / previous : null,
      lost: previous != null ? Math.max(0, previous - step.value) : 0,
    }
  })
}

/** "34%" or "—" when there is nothing to compare to. */
export function percentText(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((100 * part) / whole)}%`
}

/** 0 to 100, how strong a heat-map cell is colored. A missing rate is not colored at all. */
export function heatStrength(rate: number | null | undefined, full = 0.6): number {
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return 0
  return Math.round(Math.min(1, rate / full) * 100)
}

/** 1200 becomes "1.2k". Small numbers keep their own digits. */
export function compactNumber(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (abs >= 10_000) return `${Math.round(n / 1000)}k`
  if (abs >= 1000) return `${trim(n / 1000)}k`
  return String(Math.round(n))
}

function trim(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '')
}

/** A short list for a sparkline: the points as 0 to 100 heights, with a flat line when all are equal. */
export function sparkHeights(values: number[]): number[] {
  const max = Math.max(...values, 0)
  if (max <= 0) return values.map(() => 0)
  return values.map((value) => Math.round((Math.max(0, value) / max) * 100))
}

export function formatInt(n: number): string {
  return new Intl.NumberFormat().format(n)
}

/** The cell style for a heat-map table: a stronger color means a higher rate. */
export function heatStyle(strength: number, tone: Tone = 'green'): Record<string, string> {
  if (strength <= 0) return {}
  return { background: `color-mix(in srgb, var(--an-${tone}) ${Math.round(strength * 0.55)}%, transparent)` }
}
