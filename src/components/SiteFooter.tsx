import type { ReactNode } from 'react'
import {
  COMPANY_NAME,
  COPYRIGHT_YEAR,
  FOOTER_NAV,
  SOCIAL_LINKS,
  type SitePageId,
  type SocialLinkId,
} from '../lib/site'

interface SiteFooterProps {
  onOpenPage: (id: SitePageId) => void
  compact?: boolean
  /** Native welcome: Privacy only, no social or marketing cluster. */
  privacyOnly?: boolean
}

const SOCIAL_ICONS: Record<SocialLinkId, ReactNode> = {
  facebook: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M14 8h3V5h-3c-2.76 0-5 2.24-5 5v2H6v3h3v7h3v-7h3l1-3h-4V9c0-.55.45-1 1-1z"
      />
    </svg>
  ),
  instagram: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H7zm5 3.5A4.5 4.5 0 1 1 7.5 13 4.5 4.5 0 0 1 12 8.5zm0 2A2.5 2.5 0 1 0 14.5 13 2.5 2.5 0 0 0 12 10.5zM17.25 6.75a1 1 0 1 1-2 0 1 1 0 0 1 2 0z"
      />
    </svg>
  ),
  tiktok: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.27 6.27 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.77 1.52V6.76a4.85 4.85 0 0 1-1-.07z"
      />
    </svg>
  ),
  youtube: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M23 12s0-3.2-.4-4.74a2.5 2.5 0 0 0-1.76-1.77C19.3 5.09 12 5.09 12 5.09s-7.3 0-8.84.4A2.5 2.5 0 0 0 1.4 7.26C1 8.8 1 12 1 12s0 3.2.4 4.74a2.5 2.5 0 0 0 1.76 1.77c1.54.4 8.84.4 8.84.4s7.3 0 8.84-.4a2.5 2.5 0 0 0 1.76-1.77C23 15.2 23 12 23 12zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"
      />
    </svg>
  ),
  x: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="m4 4 7.2 9.6L4 20h2.2l5-6.5 4 6.5H20l-7.5-10.1L19.6 4h-2.2l-4.6 6-3.8-6H4z"
      />
    </svg>
  ),
  linkedin: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M6.5 8.5h3V20h-3V8.5zM8 4a1.75 1.75 0 1 1 0 3.5A1.75 1.75 0 0 1 8 4zm4.5 4.5h2.87v1.72h.04c.4-.76 1.38-1.56 2.84-1.56 3.04 0 3.6 2 3.6 4.59V20h-3v-5.59c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.13 1.45-2.13 2.94V20h-3V8.5z"
      />
    </svg>
  ),
  pinterest: (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2C6.48 2 2 6.48 2 12c0 4.24 2.64 7.86 6.36 9.32-.09-.79-.17-2 .03-2.86.18-.78 1.17-4.97 1.17-4.97s-.3-.6-.3-1.49c0-1.4.81-2.44 1.82-2.44.86 0 1.27.64 1.27 1.41 0 .86-.55 2.15-.83 3.34-.24 1 .5 1.81 1.48 1.81 1.78 0 3.14-1.88 3.14-4.58 0-2.39-1.72-4.07-4.18-4.07-2.85 0-4.52 2.13-4.52 4.34 0 .86.33 1.78.74 2.28.08.1.09.19.07.29-.08.32-.25 1-.28 1.14-.04.18-.15.22-.34.13-1.25-.58-2.03-2.4-2.03-3.87 0-3.15 2.29-6.04 6.6-6.04 3.47 0 6.16 2.47 6.16 5.77 0 3.45-2.17 6.22-5.19 6.22-1.01 0-1.97-.53-2.29-1.15l-.62 2.37c-.23.86-.83 1.94-1.24 2.6.93.29 1.92.44 2.95.44 5.52 0 10-4.48 10-10S17.52 2 12 2z"
      />
    </svg>
  ),
}

export function SiteFooter({
  onOpenPage,
  compact = false,
  privacyOnly = false,
}: SiteFooterProps) {
  if (privacyOnly) {
    return (
      <footer className="site-footer site-footer-privacy">
        <nav className="site-footer-nav" aria-label="Legal">
          <button
            type="button"
            className="site-footer-link"
            onClick={() => onOpenPage('privacy')}
          >
            Privacy
          </button>
        </nav>
      </footer>
    )
  }

  return (
    <footer className={`site-footer ${compact ? 'site-footer-compact' : ''}`}>
      <nav className="site-footer-social" aria-label="Social media">
        {SOCIAL_LINKS.map((link) => (
          <a
            key={link.id}
            className="site-footer-social-link"
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
          >
            {SOCIAL_ICONS[link.id]}
          </a>
        ))}
      </nav>

      <nav className="site-footer-nav" aria-label="Company">
        {FOOTER_NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            className="site-footer-link"
            onClick={() => onOpenPage(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      <p className="site-footer-copy">
        © {COPYRIGHT_YEAR} {COMPANY_NAME}
      </p>
    </footer>
  )
}
