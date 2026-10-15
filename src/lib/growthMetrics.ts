import { createSupabaseClient } from './supabase'
import { asCount, asList, asRatio, asRecord, missingFunctionMessage } from './adminRpc'

export type GrowthWeek = {
  weekStart: string
  signups: number
  /** Signups by where the person first came from, for example "google.com" or "android app". */
  sources: { source: string; count: number }[]
  activeUsers: number
  checkIns: number
  onboardingStarted: number
  onboardingFinished: number
  slips: number
  resumed: number
}

export type GrowthCohort = {
  weekStart: string
  size: number
  d1: number | null
  d7: number | null
  d30: number | null
}

export type GrowthHeadline = {
  signups: number
  d1: number | null
  d7: number | null
  d30: number | null
  dauYesterday: number
  mau: number
  avgDau: number | null
  /** Average daily actives divided by monthly actives. */
  stickiness: number | null
  onboardingStarted: number
  onboardingFinished: number
  onboardingCompletion: number | null
  checkInsPerActiveUserPerWeek: number | null
  slips: number
  resumed: number
  /** Share of slips followed by another check-in within 7 days. */
  resumeRate: number | null
}

export type GrowthMetrics = {
  weeks: GrowthWeek[]
  cohorts: GrowthCohort[]
  headline: GrowthHeadline
}

export type GrowthSnapshot = { date: string; headline: GrowthHeadline }

function asNullableNumber(value: unknown): number | null {
  const n = asRatio(value)
  return n == null ? null : n
}

function parseHeadline(data: unknown): GrowthHeadline {
  const row = asRecord(data)
  return {
    signups: asCount(row.signups),
    d1: asRatio(row.d1),
    d7: asRatio(row.d7),
    d30: asRatio(row.d30),
    dauYesterday: asCount(row.dauYesterday),
    mau: asCount(row.mau),
    avgDau: asNullableNumber(row.avgDau),
    stickiness: asRatio(row.stickiness),
    onboardingStarted: asCount(row.onboardingStarted),
    onboardingFinished: asCount(row.onboardingFinished),
    onboardingCompletion: asRatio(row.onboardingCompletion),
    checkInsPerActiveUserPerWeek: asNullableNumber(row.checkInsPerActiveUserPerWeek),
    slips: asCount(row.slips),
    resumed: asCount(row.resumed),
    resumeRate: asRatio(row.resumeRate),
  }
}

/** Turns the database totals (growth_metrics_summary) into the cards on the Analytics screen. */
export function parseGrowthMetrics(data: unknown): GrowthMetrics {
  const row = asRecord(data)
  return {
    weeks: asList(row.weeks).map((week) => ({
      weekStart: String(week.weekStart ?? ''),
      signups: asCount(week.signups),
      sources: Object.entries(asRecord(week.sources))
        .map(([source, count]) => ({ source, count: asCount(count) }))
        .sort((a, b) => b.count - a.count || a.source.localeCompare(b.source)),
      activeUsers: asCount(week.activeUsers),
      checkIns: asCount(week.checkIns),
      onboardingStarted: asCount(week.onboardingStarted),
      onboardingFinished: asCount(week.onboardingFinished),
      slips: asCount(week.slips),
      resumed: asCount(week.resumed),
    })),
    cohorts: asList(row.cohorts).map((cohort) => ({
      weekStart: String(cohort.weekStart ?? ''),
      size: asCount(cohort.size),
      d1: asRatio(cohort.d1),
      d7: asRatio(cohort.d7),
      d30: asRatio(cohort.d30),
    })),
    headline: parseHeadline(row.headline),
  }
}

/** Turns saved snapshot rows into one headline per month, newest first. */
export function parseGrowthSnapshots(rows: unknown): GrowthSnapshot[] {
  return asList(rows)
    .map((row) => ({
      date: String(row.snapshot_date ?? ''),
      headline: parseHeadline(asRecord(row.metrics).headline),
    }))
    .filter((snapshot) => snapshot.date !== '')
    .sort((a, b) => b.date.localeCompare(a.date))
}

function percent(value: number | null): string {
  return value == null ? '' : String(Math.round(value * 1000) / 10)
}

function csvCell(value: string | number): string {
  const text = String(value)
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/**
 * The weekly numbers as CSV, for a spreadsheet kept outside the app.
 * Rates are percentages with one decimal; a blank cell means "not enough data yet".
 */
export function growthWeeksToCsv(metrics: GrowthMetrics): string {
  const cohorts = new Map(metrics.cohorts.map((cohort) => [cohort.weekStart, cohort]))
  const header = [
    'week_start',
    'signups',
    'top_source',
    'active_users',
    'check_ins',
    'check_ins_per_active_user',
    'onboarding_started',
    'onboarding_finished',
    'onboarding_completion_pct',
    'd1_pct',
    'd7_pct',
    'd30_pct',
    'slips',
    'resumed',
    'resume_rate_pct',
  ]
  const lines = metrics.weeks.map((week) => {
    const cohort = cohorts.get(week.weekStart)
    return [
      week.weekStart,
      week.signups,
      week.sources[0]?.source ?? '',
      week.activeUsers,
      week.checkIns,
      week.activeUsers > 0 ? (week.checkIns / week.activeUsers).toFixed(2) : '',
      week.onboardingStarted,
      week.onboardingFinished,
      week.onboardingStarted > 0 ? percent(week.onboardingFinished / week.onboardingStarted) : '',
      percent(cohort?.d1 ?? null),
      percent(cohort?.d7 ?? null),
      percent(cohort?.d30 ?? null),
      week.slips,
      week.resumed,
      week.slips > 0 ? percent(week.resumed / week.slips) : '',
    ]
      .map(csvCell)
      .join(',')
  })
  return [header.join(','), ...lines].join('\n')
}

/** Weekly growth numbers, counted in the database. */
export async function fetchGrowthMetrics(weeks = 12): Promise<GrowthMetrics> {
  const { data, error } = await createSupabaseClient().rpc('growth_metrics_summary', { p_weeks: weeks })
  if (error) {
    if (error.code === '42883' || error.message.includes('growth_metrics_summary')) {
      throw new Error(missingFunctionMessage('growth_metrics_summary'))
    }
    throw error
  }
  return parseGrowthMetrics(data)
}

/** The monthly history saved on the 1st of each month. */
export async function fetchGrowthSnapshots(): Promise<GrowthSnapshot[]> {
  const { data, error } = await createSupabaseClient()
    .from('growth_snapshots')
    .select('snapshot_date, metrics')
    .order('snapshot_date', { ascending: false })
    .limit(60)
  if (error) {
    // The table is created by the same migration, so a missing table means it is not applied yet.
    if (error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error(missingFunctionMessage('growth_metrics_summary'))
    }
    throw error
  }
  return parseGrowthSnapshots(data)
}

/** Saves today's numbers into the permanent history. Returns the snapshot day. */
export async function saveGrowthSnapshot(): Promise<string> {
  const { data, error } = await createSupabaseClient().rpc('save_growth_snapshot')
  if (error) throw error
  return String(data ?? '')
}
