import { DEFAULT_THEME, type ThemeId } from './themes'

/** Google Fonts CSS URLs for non-default themes (loaded on demand). */
const THEME_FONT_HREF: Record<Exclude<ThemeId, typeof DEFAULT_THEME>, string> = {
  resuming:
    'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600;9..144,700&family=JetBrains+Mono:wght@400;600&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  nocturne:
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Rajdhani:wght@500;600;700&display=swap',
  slate:
    'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&display=swap',
  fresh:
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@400;500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap',
  vault:
    'https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;600&family=Outfit:wght@400;500;600;700;800&display=swap',
}

const LINK_ATTR = 'data-resuming-theme-fonts'

function ensureGoogleFontsPreconnect(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector('link[data-resuming-fonts-preconnect]')) return

  const gstatic = document.createElement('link')
  gstatic.rel = 'preconnect'
  gstatic.href = 'https://fonts.gstatic.com'
  gstatic.crossOrigin = 'anonymous'
  gstatic.setAttribute('data-resuming-fonts-preconnect', '1')
  document.head.appendChild(gstatic)

  const google = document.createElement('link')
  google.rel = 'preconnect'
  google.href = 'https://fonts.googleapis.com'
  google.setAttribute('data-resuming-fonts-preconnect', '1')
  document.head.appendChild(google)
}

/** Inject stylesheet for a theme's fonts. Default (dawn) is self-hosted in index. */
export function loadThemeFonts(themeId: ThemeId): void {
  if (typeof document === 'undefined') return
  if (themeId === DEFAULT_THEME) return

  const href = THEME_FONT_HREF[themeId]
  const existing = document.querySelector<HTMLLinkElement>(
    `link[${LINK_ATTR}="${themeId}"]`,
  )
  if (existing) return

  ensureGoogleFontsPreconnect()

  const link = document.createElement('link')
  link.rel = 'stylesheet'
  link.href = href
  link.setAttribute(LINK_ATTR, themeId)
  document.head.appendChild(link)
}
