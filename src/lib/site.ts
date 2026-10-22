export type SitePageId = 'about' | 'privacy' | 'terms' | 'feedback' | 'delete-account'

export const SITE_PAGE_IDS: readonly SitePageId[] = [
  'about',
  'privacy',
  'terms',
  'feedback',
  'delete-account',
]

/** @deprecated Prefer SitePageId — kept for existing legal-only imports. */
export type LegalPageId = Exclude<SitePageId, 'feedback' | 'delete-account'>

export function sitePageFromPath(pathname: string): SitePageId | null {
  const id = pathname.replace(/^\/+|\/+$/g, '')
  return (SITE_PAGE_IDS as readonly string[]).includes(id) ? (id as SitePageId) : null
}

/** Paths that belong to the signed-in app (or will after P1-05). */
const APP_PATH_PREFIXES = [
  '/today',
  '/activities',
  '/numbers',
  '/medicines',
  '/reminders',
  '/insights',
  '/review',
  '/settings',
  '/admin',
] as const

/**
 * True for `/` and known public/app paths. Unknown paths should show Not Found.
 */
export function isKnownPath(pathname: string): boolean {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (path === '/') return true
  if (path === '/start') return true
  if (/^\/e\/[a-z0-9]+$/i.test(path)) return true
  if (sitePageFromPath(path)) return true
  return APP_PATH_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  )
}

export const SITE_PAGE_TITLES: Record<SitePageId, string> = {
  about: 'About · Resuming',
  privacy: 'Privacy · Resuming',
  terms: 'Terms · Resuming',
  feedback: 'Feedback · Resuming',
  'delete-account': 'Delete your data · Resuming',
}

export type SocialLinkId =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'

export const COMPANY_NAME = 'Cheerful Games, Inc.'
export const COPYRIGHT_YEAR = 2026
export const PRODUCT_NAME = 'Resuming'
/** The marketing site; resuming.me stays the app. */
export const MARKETING_URL = 'https://resuming.app'

/**
 * Governing law for the Terms. Update to the state where Cheerful Games, Inc.
 * is incorporated or principally operates.
 */
export const GOVERNING_LAW = 'the State of Washington, United States'

/** Shown on About. */
export const LEGAL_LAST_UPDATED = `October 12, ${COPYRIGHT_YEAR}`

/** Shown on the Privacy Policy and the Terms. */
export const PRIVACY_LAST_UPDATED = `October 20, ${COPYRIGHT_YEAR}`
export const TERMS_LAST_UPDATED = `October 9, ${COPYRIGHT_YEAR}`

export interface SocialLink {
  id: SocialLinkId
  label: string
  href: string
}

/** Shown in the app footer. TikTok stays off until there is a Resuming account. */
export const SOCIAL_LINKS: SocialLink[] = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/resumingme' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/resumingme/' },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@resumingme' },
]

export const FOOTER_NAV: Array<{ id: SitePageId; label: string }> = [
  { id: 'about', label: 'About' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'feedback', label: 'Feedback' },
]
