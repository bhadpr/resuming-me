export type SitePageId = 'about' | 'privacy' | 'terms' | 'feedback'

/** @deprecated Prefer SitePageId — kept for existing legal-only imports. */
export type LegalPageId = Exclude<SitePageId, 'feedback'>

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

/** Public support inbox — confirm this mailbox exists before launch. */
export const SUPPORT_EMAIL = 'support@cheerfulgames.com'

/**
 * Governing law for the Terms. Update to the state where Cheerful Games, Inc.
 * is incorporated or principally operates.
 */
export const GOVERNING_LAW = 'the State of Washington, United States'

/** Shown on Privacy / Terms / About as the policy effective date. */
export const LEGAL_LAST_UPDATED = `August 12, ${COPYRIGHT_YEAR}`

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
