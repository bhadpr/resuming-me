import { readInstallAttribution, type InstallAttribution } from './installReferrer'
import { track } from './track'

const SENT_KEY = 'resuming-install-source-sent'

export interface InstallSource {
  /** "resuming.me", "google-play", "shared_event", a partner group's code, or "direct". */
  source: string
  /** "web", "organic", "play"... or null. */
  medium: string | null
  /** Which button or page, such as "landing", "hero" or a partner member. Null when not tagged. */
  content: string | null
}

/** A short lower-case word. Anything else is dropped, so a stray referrer cannot put free text in the table. */
function clean(value: string | null): string | null {
  const text = (value ?? '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40)
  return text === '' ? null : text
}

/**
 * Where an install came from, read from the Play install referrer (the decoded query string).
 * Our website and web-app buttons send utm_source=resuming.me; a partner's link sends the group as
 * utm_source and the member as utm_campaign; a shared event sends event=<code>. No referrer at all
 * means the app was not installed through a tagged link.
 */
export function installSourceFromReferrer(referrer: string | null | undefined): InstallSource {
  const params = new URLSearchParams(referrer ?? '')
  if (params.get('event')) return { source: 'shared_event', medium: null, content: null }
  const source = clean(params.get('utm_source'))
  if (!source) return { source: 'direct', medium: null, content: null }
  return {
    source,
    medium: clean(params.get('utm_medium')),
    content: clean(params.get('utm_content')) ?? clean(params.get('utm_campaign')),
  }
}

/**
 * Send `install_attributed` once for this install. Sent after the first open so the admin card can
 * match it to that open. Does nothing when Play does not answer; it tries again the next time.
 */
export async function trackInstallSource(read: () => Promise<InstallAttribution | null> = readInstallAttribution): Promise<void> {
  try {
    if (localStorage.getItem(SENT_KEY)) return
    const attribution = await read()
    if (!attribution?.ok) return
    const { source, medium, content } = installSourceFromReferrer(attribution.referrer)
    track('install_attributed', { source, medium, content })
    localStorage.setItem(SENT_KEY, '1')
  } catch {
    /* attribution must never get in the way of opening the app */
  }
}
