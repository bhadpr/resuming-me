import { MLB_TITLES, MLS_TITLES, NBA_TITLES, NHL_TITLES } from './leagueTitles'

// resuming.me Worker. Static files and the single-page app come from ./dist.
// Only /e/<code>, /c/<code>, and /t/<code> run here first, so WhatsApp's link preview
// shows the event, the reminder list, or the walking challenge, not the generic card.

import { walkingShareLines, type PaceTeam, type ScorePhase } from '../src/lib/challengeScore'

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
  remove(): void
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
  photo_path?: string | null
}

const EVENT_PATH = /^\/e\/([a-z0-9]{6,12})\/?$/i
const LIST_PATH = /^\/c\/([a-z0-9]{6})\/?$/i
const CHALLENGE_PATH = /^\/t\/([abcdefghjkmnpqrstuvwxyz23456789]{12})\/?$/i
const CHALLENGE_CARD_PATH = /^\/t\/([abcdefghjkmnpqrstuvwxyz23456789]{12})\/card\.jpg$/i
const WALK_IMAGE = 'https://resuming.me/og-walk.jpg'
const CHALLENGE_PHOTO = /^[0-9a-f-]{36}\/[a-z0-9-]{8,64}\.jpg$/
const PHOTO_PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9-]{8,64}\.jpg$/

/** The event's own photo for the preview, while the event is live. */
function photoUrl(env: Env, row: SharedEventRow | null): string | null {
  if (!env.SUPABASE_URL || !row || row.status !== 'active' || !row.photo_path) return null
  if (!PHOTO_PATH.test(row.photo_path)) return null
  return `${env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/event-photos/${row.photo_path}`
}

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

const NFL_TITLES = new Set([
  'Arizona Cardinals',
  'Atlanta Falcons',
  'Baltimore Ravens',
  'Buffalo Bills',
  'Carolina Panthers',
  'Chicago Bears',
  'Cincinnati Bengals',
  'Cleveland Browns',
  'Dallas Cowboys',
  'Denver Broncos',
  'Detroit Lions',
  'Green Bay Packers',
  'Houston Texans',
  'Indianapolis Colts',
  'Jacksonville Jaguars',
  'Kansas City Chiefs',
  'Las Vegas Raiders',
  'Los Angeles Chargers',
  'Los Angeles Rams',
  'Miami Dolphins',
  'Minnesota Vikings',
  'New England Patriots',
  'New Orleans Saints',
  'New York Giants',
  'New York Jets',
  'Philadelphia Eagles',
  'Pittsburgh Steelers',
  'San Francisco 49ers',
  'Seattle Seahawks',
  'Tampa Bay Buccaneers',
  'Tennessee Titans',
  'Washington Commanders',
])

const CRICKET_TITLES = new Set([
  'Afghanistan',
  'Australia',
  'Bangladesh',
  'England',
  'India',
  'Ireland',
  'New Zealand',
  'Pakistan',
  'South Africa',
  'Sri Lanka',
  'West Indies',
  'Zimbabwe',
])

type ListKind = 'nfl' | 'nba' | 'nhl' | 'mlb' | 'mls' | 'cricket' | 'school'

const LIST_CARD: Record<ListKind, { image: string; description: string }> = {
  nfl: {
    image: 'https://resuming.me/og-nfl.jpg',
    description: 'Add the whole schedule and get reminders.',
  },
  nba: {
    image: 'https://resuming.me/og-nba.jpg',
    description: 'Add the whole schedule and get reminders.',
  },
  nhl: {
    image: 'https://resuming.me/og-nhl.jpg',
    description: 'Add the whole schedule and get reminders.',
  },
  mlb: {
    image: 'https://resuming.me/og-mlb.jpg',
    description: 'Add the whole schedule and get reminders.',
  },
  mls: {
    image: 'https://resuming.me/og-mls.jpg',
    description: 'Add the whole schedule and get reminders.',
  },
  cricket: {
    image: 'https://resuming.me/og-cricket.jpg',
    description: 'Add the whole schedule and get reminders.',
  },
  school: {
    image: 'https://resuming.me/og-school.jpg',
    description: 'Add the school calendar and get reminders.',
  },
}

function listKind(title: string, zipCodes: string[]): ListKind | null {
  if (zipCodes.some((zip) => /^\d{5}$/.test(zip))) return 'school'
  if (CRICKET_TITLES.has(title)) return 'cricket'
  if (NFL_TITLES.has(title)) return 'nfl'
  if (NBA_TITLES.has(title)) return 'nba'
  if (NHL_TITLES.has(title)) return 'nhl'
  if (MLB_TITLES.has(title)) return 'mlb'
  if (MLS_TITLES.has(title)) return 'mls'
  return null
}

function listPreview(title: string | null, kind: ListKind | null): { title: string; description: string } {
  if (!title) {
    return { title: 'List not available · Resuming', description: 'This list is no longer available.' }
  }
  return {
    title,
    description: kind ? LIST_CARD[kind].description : 'A list of reminders. Tap to add them on Resuming.',
  }
}

async function fetchList(
  env: Env,
  code: string,
): Promise<{ title: string; photo: string | null; kind: ListKind | null } | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  try {
    const response = await fetch(
      `${env.SUPABASE_URL.replace(/\/+$/, '')}/rest/v1/shared_lists?code=eq.${encodeURIComponent(code)}&status=eq.active&select=title,photo_path,zip_codes`,
      {
        headers: {
          apikey: env.SUPABASE_ANON_KEY,
          authorization: `Bearer ${env.SUPABASE_ANON_KEY}`,
        },
        signal: AbortSignal.timeout(2500),
      },
    )
    if (!response.ok) return null
    const rows = (await response.json()) as { title?: string; photo_path?: string | null; zip_codes?: string[] | null }[]
    const title = rows[0]?.title?.replace(/\s+/g, ' ').trim()
    if (!title) return null
    const zipCodes = (rows[0]?.zip_codes ?? []).filter((zip): zip is string => typeof zip === 'string')
    const kind = listKind(title, zipCodes)
    const path = rows[0]?.photo_path ?? ''
    const photo = kind
      ? LIST_CARD[kind].image
      : env.SUPABASE_URL && PHOTO_PATH.test(path)
        ? `${env.SUPABASE_URL.replace(/\/+$/, '')}/storage/v1/object/public/list-photos/${path}`
        : null
    return { title, photo, kind }
  } catch {
    return null
  }
}

interface ChallengeBoardRow {
  title: string | null
  shape: string
  status: string
  starts_on: string
  team_name: string | null
  pace: number | null
  record_pace: number | null
  total_steps: number | null
  record_total: number | null
  day_number: number | null
  frozen_day_number: number | null
  days_left: number | null
  record_days_left: number | null
  score_phase: string | null
  joined_count: number | null
  target: number | null
}

async function fetchChallenge(env: Env, code: string): Promise<ChallengeBoardRow[] | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/get_challenge_board`, {
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
    return (await response.json()) as ChallengeBoardRow[]
  } catch {
    return null
  }
}

async function fetchChallengePhotoPath(env: Env, code: string): Promise<string | null> {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null
  try {
    const response = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/challenge_card_photo`, {
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
    const path = (await response.json()) as string | null
    if (!path || !CHALLENGE_PHOTO.test(path)) return null
    return path
  } catch {
    return null
  }
}

function challengePhotoVersion(path: string | null): string | null {
  const file = path?.split('/').pop()?.replace(/\.jpg$/i, '') ?? ''
  if (!/^[a-z0-9-]{8,64}$/.test(file)) return null
  return file.slice(0, 8)
}

/** The card picture, served from resuming.me so WhatsApp can fetch it. */
async function challengeCardImage(env: Env, code: string): Promise<Response> {
  const path = await fetchChallengePhotoPath(env, code)
  const storage = env.SUPABASE_URL?.replace(/\/+$/, '')
  if (!path || !storage) return Response.redirect(WALK_IMAGE, 302)
  try {
    const upstream = await fetch(`${storage}/storage/v1/object/public/challenge-photos/${path}`, {
      signal: AbortSignal.timeout(4000),
    })
    if (!upstream.ok || !(upstream.headers.get('content-type') ?? '').includes('image')) {
      return Response.redirect(WALK_IMAGE, 302)
    }
    return new Response(upstream.body, {
      status: 200,
      headers: {
        'content-type': 'image/jpeg',
        'cache-control': 'public, max-age=86400',
        'x-robots-tag': 'noindex',
      },
    })
  } catch {
    return Response.redirect(WALK_IMAGE, 302)
  }
}

function challengePreview(rows: ChallengeBoardRow[] | null): { title: string; description: string } {
  const first = rows?.[0]
  if (!first || first.status === 'switched_off' || first.status === 'deleted' || !first.title) {
    return { title: 'Walking challenge · Resuming', description: 'This challenge isn’t available.' }
  }
  const phase = (first.score_phase ?? 'before') as ScorePhase
  const teams: PaceTeam[] = rows!
    .filter((row) => row.team_name)
    .map((row) => ({ name: row.team_name as string, pace: row.pace }))
  const lines = walkingShareLines({
    shape: first.shape === 'together' ? 'together' : 'race',
    phase,
    dayNumber: first.day_number,
    frozenDayNumber: first.frozen_day_number,
    teams,
    recordTeams: rows!
      .filter((row) => row.team_name)
      .map((row) => ({ name: row.team_name as string, pace: row.record_pace })),
    total: first.total_steps,
    recordTotal: first.record_total,
    target: first.target,
    daysLeft: first.days_left,
    recordDaysLeft: first.record_days_left,
    joined: first.joined_count ?? 0,
    startsLabel: new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(
      new Date(`${first.starts_on}T12:00:00Z`),
    ),
  })
  const description = lines.current
  return { title: `${first.title} · Resuming`, description: description || first.title }
}

function rewritePreview(
  page: Response,
  title: string,
  description: string,
  pageUrl: string,
  photo: string | null,
  sized = false,
  width = '1200',
  height = '630',
  cacheControl = 'public, max-age=60',
): Response {
  const set = (value: string) => ({
    element(element: RewriterElement) {
      element.setAttribute('content', attr(value))
    },
  })
  const drop = {
    element(element: RewriterElement) {
      element.remove()
    },
  }

  let rewriter = new HTMLRewriter()
  if (photo) {
    rewriter = rewriter
      .on('meta[property="og:image"]', set(photo))
      .on('meta[name="twitter:image"]', set(photo))
    rewriter = sized
      ? rewriter
          .on('meta[property="og:image:width"]', set(width))
          .on('meta[property="og:image:height"]', set(height))
      : rewriter
          .on('meta[property="og:image:width"]', drop)
          .on('meta[property="og:image:height"]', drop)
  }

  const rewritten = rewriter
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
  response.headers.set('cache-control', cacheControl)
  response.headers.set('x-robots-tag', 'noindex')
  return response
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const cardMatch = CHALLENGE_CARD_PATH.exec(url.pathname)
    if (cardMatch) return challengeCardImage(env, cardMatch[1].toLowerCase())

    const page = await env.ASSETS.fetch(request)
    if (!(page.headers.get('content-type') ?? '').includes('text/html')) return page

    const eventMatch = EVENT_PATH.exec(url.pathname)
    if (eventMatch) {
      const code = eventMatch[1].toLowerCase()
      const row = await fetchEvent(env, code)
      const card = preview(row)
      return rewritePreview(page, card.title, card.description, `https://resuming.me/e/${code}`, photoUrl(env, row))
    }

    const challengeMatch = CHALLENGE_PATH.exec(url.pathname)
    if (challengeMatch) {
      const code = challengeMatch[1].toLowerCase()
      const card = challengePreview(await fetchChallenge(env, code))
      const path = await fetchChallengePhotoPath(env, code)
      const version = challengePhotoVersion(path)
      const photo = version ? `https://resuming.me/t/${code}/card.jpg?v=${version}` : WALK_IMAGE
      const shared = url.searchParams.get('v')
      const pageUrl =
        shared && /^[a-z0-9]{8}$/.test(shared) ? `https://resuming.me/t/${code}?v=${shared}` : `https://resuming.me/t/${code}`
      return rewritePreview(
        page,
        card.title,
        card.description,
        pageUrl,
        photo,
        photo === WALK_IMAGE,
        '1280',
        '720',
        'public, max-age=0, must-revalidate',
      )
    }

    const listMatch = LIST_PATH.exec(url.pathname)
    if (!listMatch) return page
    const code = listMatch[1].toLowerCase()
    const list = await fetchList(env, code)
    const card = listPreview(list?.title ?? null, list?.kind ?? null)
    return rewritePreview(
      page,
      card.title,
      card.description,
      `https://resuming.me/c/${code}`,
      list?.photo ?? null,
      list?.kind != null,
    )
  },
}

