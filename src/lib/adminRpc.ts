import { createSupabaseClient } from './supabase'

/** The SQL that counts these numbers. Shown if the functions are not in the database yet. */
const MIGRATION = 'supabase/migrations/20261020120000_analytics_summaries.sql'
const GROWTH_MIGRATION = 'supabase/migrations/20261027140000_growth_metrics.sql'

const EVENT_MIGRATION = 'supabase/migrations/20261029120000_admin_event_analytics.sql'

const EXTRAS_MIGRATION = 'supabase/migrations/20261030120000_event_analytics_extras.sql'

const GROWTH_FUNCTIONS = ['growth_metrics_summary', 'save_growth_snapshot']
const EVENT_FUNCTIONS = ['event_counts_by_period', 'app_installs_summary', 'app_errors_summary']
const RETENTION_MIGRATION = 'supabase/migrations/20261031120000_guest_retention.sql'

const EXTRAS_FUNCTIONS = ['alert_status_summary', 'event_prop_breakdown']

/** Tells the admin which migration to apply when a database function is missing. */
export function missingFunctionMessage(fn: string): string {
  const file = GROWTH_FUNCTIONS.includes(fn)
    ? GROWTH_MIGRATION
    : fn === 'guest_retention_summary'
      ? RETENTION_MIGRATION
      : EXTRAS_FUNCTIONS.includes(fn)
        ? EXTRAS_MIGRATION
        : EVENT_FUNCTIONS.includes(fn)
          ? EVENT_MIGRATION
          : MIGRATION
  return `Apply ${file} in the Supabase SQL Editor.`
}

export type AnalyticsSummaryFunction =
  | 'onboarding_funnel_summary'
  | 'guest_journey_summary'
  | 'reminder_analytics_summary'
  | 'loop_analytics_summary'
  | 'app_installs_summary'
  | 'app_errors_summary'
  | 'alert_status_summary'

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
