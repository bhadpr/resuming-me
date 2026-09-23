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
  '/insights',
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
  'delete-account': 'Delete account · Resuming',
}

export type SocialLinkId =
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'youtube'
  | 'x'
  | 'linkedin'
  | 'pinterest'

export const COMPANY_NAME = 'Cheerful Games, Inc.'
export const COPYRIGHT_YEAR = 2026
export const PRODUCT_NAME = 'Resuming'

/**
 * Governing law for the Terms. Update to the state where Cheerful Games, Inc.
 * is incorporated or principally operates.
 */
export const GOVERNING_LAW = 'the State of Washington, United States'

/** Shown on Privacy / Terms / About as the policy effective date. */
export const LEGAL_LAST_UPDATED = `September 23, ${COPYRIGHT_YEAR}`

export interface SocialLink {
  id: SocialLinkId
  label: string
  href: string
}

/** Placeholder social destinations — replace with real handles when ready. */
export const SOCIAL_LINKS: SocialLink[] = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/cheerfulgames' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/cheerfulgames/' },
  { id: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@cheerfulgames' },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@cheerfulgames' },
  { id: 'x', label: 'X', href: 'https://x.com/cheerfulgames' },
  { id: 'linkedin', label: 'LinkedIn', href: 'https://www.linkedin.com/company/cheerfulgames' },
  { id: 'pinterest', label: 'Pinterest', href: 'https://www.pinterest.com/cheerfulgames/' },
]

export const FOOTER_NAV: Array<{ id: SitePageId; label: string }> = [
  { id: 'about', label: 'About' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'feedback', label: 'Feedback' },
]
