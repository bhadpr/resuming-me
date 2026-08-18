import { createSupabaseClient, isSupabaseConfigured } from './supabase'
import type { Database } from '../types/database'

export type PageViewRow = Database['public']['Tables']['page_views']['Row']

export type AnalyticsWindow = '7d' | '30d'

export const ANALYTICS_WINDOW_DAYS: Record<AnalyticsWindow, number> = {
  '7d': 7,
  '30d': 30,
}

const VISITOR_KEY = 'resuming-visitor-id'
const LAST_TRACK_KEY = 'resuming-last-page-view'

export type AppAnalyticsPath =
  | '/'
  | '/app/today'
  | '/app/activities'
  | '/app/metrics'
  | '/app/insights'
  | '/settings'
  | '/analytics'
  | '/about'
  | '/privacy'
  | '/terms'
  | '/feedback'

const PATH_LABELS: Record<string, string> = {
  '/': 'Landing',
  '/app/today': 'Today',
  '/app/activities': 'Activities',
  '/app/metrics': 'Numbers',
  '/app/insights': 'Insights',
  '/settings': 'Settings',
  '/analytics': 'Analytics',
  '/about': 'About',
  '/privacy': 'Privacy',
  '/terms': 'Terms',
  '/feedback': 'Feedback',
}

export function pathLabel(path: string): string {
  return PATH_LABELS[path] ?? path
}

function getOrCreateVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing && existing.length >= 8) return existing
    const id =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `v-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
    localStorage.setItem(VISITOR_KEY, id)
    return id
  } catch {
    return `anon-${Date.now()}`
  }
}

function shouldSkipDuplicate(path: string): boolean {
  try {
    const raw = sessionStorage.getItem(LAST_TRACK_KEY)
    if (!raw) return false
    const parsed = JSON.parse(raw) as { path: string; at: number }
    if (parsed.path === path && Date.now() - parsed.at < 2500) return true
  } catch {
    /* ignore */
  }
  return false
}

function markTracked(path: string): void {
  try {
    sessionStorage.setItem(LAST_TRACK_KEY, JSON.stringify({ path, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

function truncate(value: string | null | undefined, max: number): string | null {
  if (!value) return null
  return value.length <= max ? value : value.slice(0, max)
}

/** Fire-and-forget first-party page view. Safe to call from UI. */
export function trackPageView(path: AppAnalyticsPath | string, title?: string): void {
  if (!isSupabaseConfigured()) return
  if (typeof window === 'undefined') return
  if (shouldSkipDuplicate(path)) return
  markTracked(path)

  const visitorId = getOrCreateVisitorId()
  const client = createSupabaseClient()

  void client.auth.getSession().then(({ data }) => {
    const userId = data.session?.user?.id ?? null
    return client.from('page_views').insert({
      path: truncate(path, 500)!,
      title: truncate(title ?? pathLabel(path), 200),
      visitor_id: visitorId,
      user_id: userId,
      referrer: truncate(document.referrer || null, 1000),
      user_agent: truncate(navigator.userAgent || null, 500),
    })
  }).catch((err) => {
    console.warn('page view not recorded', err)
  })
}

export interface DailyCount {
  date: string
  views: number
  visitors: number
}

export interface NamedCount {
  key: string
  label: string
  count: number
}

export interface AnalyticsSummary {
  window: AnalyticsWindow
  from: string
  to: string
  totalViews: number
  uniqueVisitors: number
  signedInVisitors: number
  viewsToday: number
  daily: DailyCount[]
  topPages: NamedCount[]
  topReferrers: NamedCount[]
  devices: NamedCount[]
  browsers: NamedCount[]
}

function dateKey(iso: string): string {
  return iso.slice(0, 10)
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function classifyDevice(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/iPad|Tablet/i.test(ua)) return 'Tablet'
  if (/Mobi|Android.*Mobile|iPhone|iPod/i.test(ua)) return 'Mobile'
  return 'Desktop'
}

function classifyBrowser(ua: string | null): string {
  if (!ua) return 'Unknown'
  if (/Edg\//i.test(ua)) return 'Edge'
  if (/OPR\/|Opera/i.test(ua)) return 'Opera'
  if (/Chrome\//i.test(ua) && !/Edg\//i.test(ua)) return 'Chrome'
  if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) return 'Safari'
  if (/Firefox\//i.test(ua)) return 'Firefox'
  return 'Other'
}

function hostFromReferrer(referrer: string | null): string {
  if (!referrer) return 'Direct / none'
  try {
    const host = new URL(referrer).hostname.replace(/^www\./, '')
    return host || 'Direct / none'
  } catch {
    return 'Direct / none'
  }
}

function topN(counts: Map<string, number>, n: number, labelFn: (k: string) => string): NamedCount[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, n)
    .map(([key, count]) => ({ key, label: labelFn(key), count }))
}

export function summarizePageViews(
  rows: Array<Pick<PageViewRow, 'path' | 'visitor_id' | 'user_id' | 'referrer' | 'user_agent' | 'created_at'>>,
  window: AnalyticsWindow,
): AnalyticsSummary {
  const days = ANALYTICS_WINDOW_DAYS[window]
  const to = todayKey()
  const from = addDays(to, -(days - 1))
  const today = to

  const dailyMap = new Map<string, { views: number; visitors: Set<string> }>()
  for (let i = 0; i < days; i++) {
    const d = addDays(from, i)
    dailyMap.set(d, { views: 0, visitors: new Set() })
  }

  const visitors = new Set<string>()
  const signedIn = new Set<string>()
  const pages = new Map<string, number>()
  const referrers = new Map<string, number>()
  const devices = new Map<string, number>()
  const browsers = new Map<string, number>()
  let viewsToday = 0

  for (const row of rows) {
    const day = dateKey(row.created_at)
    if (day < from || day > to) continue

    visitors.add(row.visitor_id)
    if (row.user_id) signedIn.add(row.user_id)
    if (day === today) viewsToday += 1

    const bucket = dailyMap.get(day)
    if (bucket) {
      bucket.views += 1
      bucket.visitors.add(row.visitor_id)
    }

    pages.set(row.path, (pages.get(row.path) ?? 0) + 1)
    const ref = hostFromReferrer(row.referrer)
    referrers.set(ref, (referrers.get(ref) ?? 0) + 1)
    const device = classifyDevice(row.user_agent)
    devices.set(device, (devices.get(device) ?? 0) + 1)
    const browser = classifyBrowser(row.user_agent)
    browsers.set(browser, (browsers.get(browser) ?? 0) + 1)
  }

  return {
    window,
    from,
    to,
    totalViews: rows.filter((r) => {
      const day = dateKey(r.created_at)
      return day >= from && day <= to
    }).length,
    uniqueVisitors: visitors.size,
    signedInVisitors: signedIn.size,
    viewsToday,
    daily: [...dailyMap.entries()].map(([date, v]) => ({
      date,
      views: v.views,
      visitors: v.visitors.size,
    })),
    topPages: topN(pages, 10, pathLabel),
    topReferrers: topN(referrers, 8, (k) => k),
    devices: topN(devices, 5, (k) => k),
    browsers: topN(browsers, 6, (k) => k),
  }
}

export async function fetchPageViewsForAnalytics(
  window: AnalyticsWindow,
): Promise<PageViewRow[]> {
  const client = createSupabaseClient()
  const days = ANALYTICS_WINDOW_DAYS[window]
  const since = new Date()
  since.setUTCDate(since.getUTCDate() - (days - 1))
  since.setUTCHours(0, 0, 0, 0)

  const { data, error } = await client
    .from('page_views')
    .select('*')
    .gte('created_at', since.toISOString())
    .order('created_at', { ascending: false })
    .limit(10000)

  if (error) throw error
  return data ?? []
}

export async function fetchIsAdmin(userId: string): Promise<boolean> {
  const client = createSupabaseClient()
  const { data, error } = await client
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.warn('could not load admin flag', error.message)
    return false
  }
  return Boolean(data?.is_admin)
}
