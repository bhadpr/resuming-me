import { ANALYTICS_WINDOW_DAYS, type AnalyticsWindow, type NamedCount } from './analytics'
import { createSupabaseClient } from './supabase'

/** Written by the marketing site at resuming.app (marketing/src/measure.ts). */
export const SITE_EVENT_NAMES = ['site_viewed', 'site_cta_clicked'] as const

export interface SiteEventRow {
  name: string
  props: unknown
  anon_id: string
}

export interface SiteSourceRow {
  source: string
  visitors: number
  tappedPlay: number
}

export interface SiteSummary {
  pageViews: number
  visitors: number
  /** People who tapped a Google Play button at least once. */
  tappedPlay: number
  /** People who tapped Try it in your browser at least once. */
  tappedBrowser: number
  sources: SiteSourceRow[]
  /** Taps by button and place, for example "Google Play · hero". */
  taps: NamedCount[]
  devices: NamedCount[]
}

function propsOf(row: SiteEventRow): Record<string, unknown> {
  return row.props && typeof row.props === 'object' ? (row.props as Record<string, unknown>) : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

const BUTTONS: Record<string, string> = { play: 'Google Play', web: 'Try in browser' }

/** A tagged link wins, then the website they came from, then direct. */
export function sourceLabel(props: Record<string, unknown>): string {
  const tagged = text(props.utm_source)
  if (tagged) {
    const medium = text(props.utm_medium)
    return medium ? `${tagged} / ${medium}` : tagged
  }
  return text(props.referrer_host) ?? 'direct'
}

function ranked(counts: Map<string, number>, limit: number): NamedCount[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => ({ key, label: key, count }))
}

/** Counts people by their random visitor id. No account is involved. */
export function summarizeSiteEvents(rows: readonly SiteEventRow[]): SiteSummary {
  let pageViews = 0
  const visitors = new Set<string>()
  const playTappers = new Set<string>()
  const browserTappers = new Set<string>()
  const sourceOf = new Map<string, string>()
  const deviceOf = new Map<string, string>()
  const taps = new Map<string, number>()

  for (const row of rows) {
    const props = propsOf(row)
    if (row.name === 'site_viewed') {
      pageViews += 1
      visitors.add(row.anon_id)
      // A visitor counts once, under the source of their first visit in this window.
      if (!sourceOf.has(row.anon_id)) sourceOf.set(row.anon_id, sourceLabel(props))
      if (!deviceOf.has(row.anon_id)) deviceOf.set(row.anon_id, text(props.device) === 'phone' ? 'Phone' : 'Computer')
    } else if (row.name === 'site_cta_clicked') {
      const kind = text(props.kind)
      if (!kind || !(kind in BUTTONS)) continue
      if (kind === 'play') playTappers.add(row.anon_id)
      else browserTappers.add(row.anon_id)
      const key = `${BUTTONS[kind]} · ${text(props.where) ?? 'page'}`
      taps.set(key, (taps.get(key) ?? 0) + 1)
    }
  }

  const bySource = new Map<string, SiteSourceRow>()
  for (const [anon, source] of sourceOf) {
    const entry = bySource.get(source) ?? { source, visitors: 0, tappedPlay: 0 }
    entry.visitors += 1
    if (playTappers.has(anon)) entry.tappedPlay += 1
    bySource.set(source, entry)
  }

  const devices = new Map<string, number>()
  for (const device of deviceOf.values()) devices.set(device, (devices.get(device) ?? 0) + 1)

  return {
    pageViews,
    visitors: visitors.size,
    tappedPlay: playTappers.size,
    tappedBrowser: browserTappers.size,
    sources: [...bySource.values()]
      .sort((a, b) => b.visitors - a.visitors || a.source.localeCompare(b.source))
      .slice(0, 10),
    taps: ranked(taps, 8),
    devices: ranked(devices, 2),
  }
}

export async function fetchSiteEvents(window: AnalyticsWindow): Promise<SiteEventRow[]> {
  const client = createSupabaseClient()
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (ANALYTICS_WINDOW_DAYS[window] - 1))
  since.setUTCHours(0, 0, 0, 0)
  const { data, error } = await client
    .from('events')
    .select('name, props, anon_id')
    .eq('platform', 'website')
    .in('name', [...SITE_EVENT_NAMES])
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: true })
    .limit(10000)
  if (error) throw error
  return (data ?? []) as SiteEventRow[]
}
