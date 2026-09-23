import { matchPath, type NavigateFunction } from 'react-router-dom'

/** Reject open redirects: only same-origin relative paths. */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next) return null
  if (!next.startsWith('/') || next.startsWith('//')) return null
  if (next.includes('://')) return null
  return next
}

export type AppTab = 'today' | 'activities' | 'metrics' | 'insights'

export type AppView =
  | { name: 'today' }
  | { name: 'activities'; screen: 'list' }
  | { name: 'activities'; screen: 'form'; activityId?: string }
  | { name: 'activities'; screen: 'detail'; activityId: string }
  | { name: 'numbers'; screen: 'list' }
  | { name: 'numbers'; screen: 'form'; metricId?: string }
  | { name: 'numbers'; screen: 'detail'; metricId: string }
  | { name: 'insights' }
  | { name: 'review'; weekStart: string }
  | { name: 'settings' }
  | { name: 'admin'; page: 'analytics' | 'feedback' }

const APP_ROUTES: Array<{ pattern: string; parse: (params: Record<string, string | undefined>) => AppView }> = [
  { pattern: '/today', parse: () => ({ name: 'today' }) },
  { pattern: '/activities/new', parse: () => ({ name: 'activities', screen: 'form' }) },
  {
    pattern: '/activities/:id/edit',
    parse: (p) => ({ name: 'activities', screen: 'form', activityId: p.id }),
  },
  {
    pattern: '/activities/:id',
    parse: (p) => ({ name: 'activities', screen: 'detail', activityId: p.id! }),
  },
  { pattern: '/activities', parse: () => ({ name: 'activities', screen: 'list' }) },
  { pattern: '/numbers/new', parse: () => ({ name: 'numbers', screen: 'form' }) },
  {
    pattern: '/numbers/:id/edit',
    parse: (p) => ({ name: 'numbers', screen: 'form', metricId: p.id }),
  },
  {
    pattern: '/numbers/:id',
    parse: (p) => ({ name: 'numbers', screen: 'detail', metricId: p.id! }),
  },
  { pattern: '/numbers', parse: () => ({ name: 'numbers', screen: 'list' }) },
  { pattern: '/insights', parse: () => ({ name: 'insights' }) },
  { pattern: '/review/:weekStart', parse: (p) => ({ name: 'review', weekStart: p.weekStart! }) },
  { pattern: '/settings', parse: () => ({ name: 'settings' }) },
  { pattern: '/admin/analytics', parse: () => ({ name: 'admin', page: 'analytics' }) },
  { pattern: '/admin/feedback', parse: () => ({ name: 'admin', page: 'feedback' }) },
]

export function parseAppPath(pathname: string): AppView | null {
  for (const route of APP_ROUTES) {
    const match = matchPath({ path: route.pattern, end: true }, pathname)
    if (match) return route.parse(match.params)
  }
  return null
}

export function tabFromView(view: AppView | null): AppTab {
  if (!view) return 'today'
  if (view.name === 'numbers') return 'metrics'
  if (view.name === 'activities') return 'activities'
  if (view.name === 'insights') return 'insights'
  return 'today'
}

export function tabPath(tab: AppTab): string {
  if (tab === 'metrics') return '/numbers'
  return `/${tab}`
}

export function showAppChrome(view: AppView | null): boolean {
  if (!view) return false
  return (
    view.name === 'today' ||
    view.name === 'activities' ||
    view.name === 'numbers' ||
    view.name === 'insights' ||
    view.name === 'review'
  )
}

/** Prefer history back when the router has a stack entry; otherwise fall back. */
export function navigateBack(navigate: NavigateFunction, fallback = '/today'): void {
  const idx =
    typeof window !== 'undefined' &&
    window.history.state &&
    typeof (window.history.state as { idx?: unknown }).idx === 'number'
      ? (window.history.state as { idx: number }).idx
      : 0
  if (idx > 0) navigate(-1)
  else navigate(fallback)
}

const AUTH_NEXT_KEY = 'resuming:auth-next'
const memoryAuthNext = new Map<string, string>()

function authNextStore(): { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void } {
  try {
    if (typeof sessionStorage !== 'undefined') return sessionStorage
  } catch {
    // private mode / blocked storage
  }
  return {
    getItem: (k) => memoryAuthNext.get(k) ?? null,
    setItem: (k, v) => {
      memoryAuthNext.set(k, v)
    },
    removeItem: (k) => {
      memoryAuthNext.delete(k)
    },
  }
}

/** Persist post-login destination across OAuth redirects. */
export function stashAuthNext(next: string | null | undefined): void {
  const store = authNextStore()
  const safe = safeNextPath(next)
  if (safe) store.setItem(AUTH_NEXT_KEY, safe)
  else store.removeItem(AUTH_NEXT_KEY)
}

/** Read and clear a stashed post-login destination. */
export function takeAuthNext(): string | null {
  const store = authNextStore()
  const raw = store.getItem(AUTH_NEXT_KEY)
  store.removeItem(AUTH_NEXT_KEY)
  return safeNextPath(raw)
}
