/**
 * First-party, cookie-free measurement for resuming.app.
 *
 * Sends two kinds of events to the same Supabase `events` table the app uses, so they show up
 * next to the app's own numbers:
 *   site_viewed       once per page load: language, where the visitor came from, phone or computer
 *   site_cta_clicked  a tap on a Google Play link or a "try it in your browser" link
 *
 * What it never sends: IP address, full referrer URL, user agent, or anything typed on the page.
 * It does nothing when the visitor asks not to be tracked (Do Not Track or Global Privacy Control),
 * for automated browsers, for bots, and off the real site (localhost, previews).
 *
 * In the EU, the UK, Switzerland and the EEA (the worker sets <html data-consent="required">)
 * nothing is stored or sent until the visitor taps "Yes" on the banner. "No thanks" keeps it off,
 * and the footer link lets them change their mind.
 *
 * Reading the numbers: supabase/scripts/site_analytics.sql.
 */

const URL_BASE = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined
const VISITOR_KEY = 'resuming-site-visitor'
const CONSENT_KEY = 'resuming-site-consent'
const TEST_FLAG = 'resuming-site-measure-test'

type Props = Record<string, string | number | boolean | null>

function consentRequired(): boolean {
  return document.documentElement.dataset.consent === 'required'
}

/** 'yes' or 'no' once the visitor has chosen, otherwise null. */
function savedChoice(): 'yes' | 'no' | null {
  try {
    const value = localStorage.getItem(CONSENT_KEY)
    return value === 'yes' || value === 'no' ? value : null
  } catch {
    return null
  }
}

function enabled(): boolean {
  if (!URL_BASE || !ANON_KEY) return false
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
  if (nav.doNotTrack === '1' || nav.globalPrivacyControl) return false
  if (nav.webdriver) return false
  if (/bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(nav.userAgent)) return false
  if (consentRequired() && savedChoice() !== 'yes') return false
  const host = location.hostname
  const onRealSite = host === 'resuming.app' || host === 'www.resuming.app'
  // The flag lets a developer check the wiring from a local build.
  return onRealSite || localStorage.getItem(TEST_FLAG) === '1'
}

function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY)
    if (existing && existing.length >= 8) return existing
    const id = crypto.randomUUID()
    localStorage.setItem(VISITOR_KEY, id)
    return id
  } catch {
    return `anon-${Math.random().toString(36).slice(2, 12)}`
  }
}

function send(name: string, props: Props): void {
  if (!enabled()) return
  const body = JSON.stringify({
    anon_id: visitorId(),
    name,
    props,
    path: location.pathname.slice(0, 500),
    platform: 'website',
  })
  void fetch(`${URL_BASE}/rest/v1/events`, {
    method: 'POST',
    headers: {
      apikey: ANON_KEY!,
      Authorization: `Bearer ${ANON_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body,
    // Lets a click that leaves the page still be recorded.
    keepalive: true,
  }).catch(() => {
    /* Measurement must never get in the visitor's way. */
  })
}

function clip(value: string | null, max = 60): string | null {
  return value ? value.slice(0, max) : null
}

function referrerHost(): string | null {
  if (!document.referrer) return null
  try {
    const host = new URL(document.referrer).hostname.replace(/^www\./, '')
    return host === 'resuming.app' ? null : host
  } catch {
    return null
  }
}

function pageViewed(): void {
  const query = new URLSearchParams(location.search)
  send('site_viewed', {
    lang: document.documentElement.lang || 'en',
    referrer_host: clip(referrerHost()),
    utm_source: clip(query.get('utm_source')),
    utm_medium: clip(query.get('utm_medium')),
    utm_campaign: clip(query.get('utm_campaign')),
    device: matchMedia('(max-width: 899px)').matches ? 'phone' : 'computer',
  })
}

function whereOnPage(link: HTMLElement): string {
  if (link.closest('.site-header')) return 'header'
  if (link.closest('.hero')) return 'hero'
  if (link.closest('.final')) return 'final'
  if (link.closest('#try')) return 'try'
  return 'page'
}

function kindOfLink(href: string): string | null {
  if (href.includes('play.google.com')) return 'play'
  if (/^https:\/\/resuming\.me\/start/.test(href)) return 'web'
  return null
}

function clicked(event: MouseEvent): void {
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[href]')
  if (!link) return
  const kind = kindOfLink(link.href)
  if (!kind) return
  send('site_cta_clicked', { kind, where: whereOnPage(link) })
}

/** Only asked where the law asks. Elsewhere nothing is shown. */
function setUpConsent(): void {
  const banner = document.querySelector<HTMLElement>('[data-consent-banner]')
  const reopen = document.querySelector<HTMLElement>('[data-consent-open]')
  if (!banner || !consentRequired()) return

  if (reopen) {
    reopen.hidden = false
    reopen.addEventListener('click', () => {
      banner.hidden = false
      banner.querySelector<HTMLElement>('[data-consent-choice]')?.focus()
    })
  }
  if (savedChoice() === null) banner.hidden = false

  banner.addEventListener('click', (event) => {
    const button = (event.target as Element | null)?.closest<HTMLElement>('[data-consent-choice]')
    if (!button) return
    const yes = button.dataset.consentChoice === 'yes'
    try {
      localStorage.setItem(CONSENT_KEY, yes ? 'yes' : 'no')
      // Saying no also removes the id we may have stored earlier.
      if (!yes) localStorage.removeItem(VISITOR_KEY)
    } catch {
      /* Without storage there is nothing to keep, and nothing is sent without a saved yes. */
    }
    banner.hidden = true
    // This visit counts from the moment they agree.
    if (yes) pageViewed()
  })
}

setUpConsent()
pageViewed()
document.addEventListener('click', clicked)
