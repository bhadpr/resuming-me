import { createSupabaseClient } from './supabase'

/** The SQL that counts these numbers. Shown if the functions are not in the database yet. */
const MIGRATION = 'supabase/migrations/20261020120000_analytics_summaries.sql'
const GROWTH_MIGRATION = 'supabase/migrations/20261027140000_growth_metrics.sql'

const GROWTH_FUNCTIONS = ['growth_metrics_summary', 'save_growth_snapshot']

/** Tells the admin which migration to apply when a database function is missing. */
export function missingFunctionMessage(fn: string): string {
  const file = GROWTH_FUNCTIONS.includes(fn) ? GROWTH_MIGRATION : MIGRATION
  return `Apply ${file} in the Supabase SQL Editor.`
}

export type AnalyticsSummaryFunction =
  | 'onboarding_funnel_summary'
  | 'guest_journey_summary'
  | 'reminder_analytics_summary'
  | 'loop_analytics_summary'

/** Admin totals counted in the database, so no event rows are downloaded or cut off. */
export async function fetchAnalyticsSummary(fn: AnalyticsSummaryFunction, days: number): Promise<unknown> {
  const { data, error } = await createSupabaseClient().rpc(fn, { p_days: days })
  if (error) {
    if (error.code === '42883' || error.message.includes(fn)) {
      throw new Error(missingFunctionMessage(fn))
    }
    throw error
  }
  return data
}

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

export function asCount(value: unknown): number {
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
}

export function asRatio(value: unknown): number | null {
  if (value == null) return null
  const n = typeof value === 'string' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}

export function asList(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(asRecord) : []
}
