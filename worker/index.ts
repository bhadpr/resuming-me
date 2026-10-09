// resuming.me Worker. Static files and the single-page app come from ./dist.
// Only /e/<code> runs here first, so WhatsApp's link preview shows the event, not the generic Resuming card.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> }
  /** Set in the Cloudflare dashboard. Without them, /e/ pages keep the generic preview. */
  SUPABASE_URL?: string
  SUPABASE_ANON_KEY?: string
}

interface RewriterElement {
  setAttribute(name: string, value: string): void
  setInnerContent(content: string): void
  append(content: string, options?: { html: boolean }): void
}

declare class HTMLRewriter {
  on(selector: string, handlers: { element(element: RewriterElement): void }): HTMLRewriter
  transform(response: Response): Response
}

interface SharedEventRow {
  code: string
  text: string | null
  from_line: string | null
  day: string
  hour: number | null
  minute: number | null
  status: string
}

const EVENT_PATH = /^\/e\/([a-z0-9]{6,12})\/?$/i

async function fetchEvent(env: Env, code: string): Promise<SharedEventRow | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_shared_event`, {
      method: 'POST',
      headers: {
        apikey: env.SUPABASE_ANON_KEY,
        authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ p_code: code }),
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) return null
    const rows = (await response.json()) as SharedEventRow[]
    return rows[0] ?? null
  } catch {
    return null
  }
}

/** "Sun, 7 Sep, 7:00 pm". The day is a calendar date, so it is read in UTC. */
function formatWhen(row: SharedEventRow): string {
  const [year, month, date] = row.day.split('-').map(Number)
  const day = new Date(Date.UTC(year, month - 1, date)).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
  if (row.hour == null || row.minute == null) return day
  const hour12 = row.hour % 12 === 0 ? 12 : row.hour % 12
  const suffix = row.hour < 12 ? 'am' : 'pm'
  return `${day}, ${hour12}:${String(row.minute).padStart(2, '0')} ${suffix}`
}

/** Safe inside a double-quoted attribute whether or not the rewriter escapes. */
function attr(value: string): string {
  return value.replace(/"/g, '\u201d').replace(/[<>]/g, '').replace(/\s+/g, ' ').trim()
}

function preview(row: SharedEventRow | null): { title: string; description: string } {
  if (!row || row.status === 'switched_off' || !row.text) {
    return { title: 'Event not available · Resuming', description: 'This event is no longer available.' }
  }
  if (row.status === 'cancelled') {
    return { title: `${row.text} · Resuming`, description: 'The organizer cancelled this event.' }
  }
  const from = row.from_line ? `${row.from_line} · ` : ''
  return {
    title: row.text,
    description: `${from}${formatWhen(row)}. Tap to get a reminder on Resuming.`,
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const page = await env.ASSETS.fetch(request)
    const url = new URL(request.url)
    const match = EVENT_PATH.exec(url.pathname)
    if (!match || !(page.headers.get('content-type') ?? '').includes('text/html')) return page

    const code = match[1].toLowerCase()
    const { title, description } = preview(await fetchEvent(env, code))
    const pageUrl = `https://resuming.me/e/${code}`
    const set = (value: string) => ({
      element(element: RewriterElement) {
        element.setAttribute('content', attr(value))
      },
    })

    const rewritten = new HTMLRewriter()
      .on('title', {
        element(element) {
          element.setInnerContent(title)
        },
      })
      .on('meta[name="description"]', set(description))
      .on('meta[property="og:title"]', set(title))
      .on('meta[property="og:description"]', set(description))
      .on('meta[property="og:url"]', set(pageUrl))
      .on('meta[name="twitter:title"]', set(title))
      .on('meta[name="twitter:description"]', set(description))
      .on('link[rel="canonical"]', {
        element(element) {
          element.setAttribute('href', pageUrl)
        },
      })
      .on('head', {
        element(element) {
          element.append('<meta name="robots" content="noindex" />', { html: true })
        },
      })
      .transform(page)

    const response = new Response(rewritten.body, rewritten)
    response.headers.set('cache-control', 'public, max-age=60')
    response.headers.set('x-robots-tag', 'noindex')
    return response
  },
}
