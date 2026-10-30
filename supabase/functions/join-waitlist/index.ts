// Saves an iPhone-launch or school-district waitlist email.
// Also looks up whether a US ZIP has a school district in Resuming.
// Deploy: supabase functions deploy join-waitlist --project-ref <ref>
// Set WAITLIST_SALT in the function secrets. Do not log emails or IP addresses.
// verify_jwt is false so the static site can call this without the anon key.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const ALLOWED = new Set([
  'https://resuming.app',
  'https://www.resuming.app',
  'http://127.0.0.1:4321',
  'http://localhost:4321',
  'http://127.0.0.1:4322',
  'http://localhost:4322',
])

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ZIP = /^\d{5}$/
const SOURCES = new Set(['iphone', 'school_holidays_waitlist'])

function cors(req: Request): Record<string, string> {
  const origin = req.headers.get('origin') ?? ''
  const allow = ALLOWED.has(origin) ? origin : ''
  return {
    ...(allow ? { 'Access-Control-Allow-Origin': allow, Vary: 'Origin' } : {}),
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }
}

function json(req: Request, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(req), 'Content-Type': 'application/json' },
  })
}

function clip(value: unknown, max: number): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.slice(0, max)
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || ''
  return forwarded.split(',')[0]?.trim() || 'unknown'
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) })
  if (req.method !== 'POST') return json(req, 405, { ok: false, error: 'method' })
  if (!ALLOWED.has(req.headers.get('origin') ?? '')) return json(req, 403, { ok: false, error: 'origin' })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json(req, 400, { ok: false, error: 'invalid_email' })
  }

  if (typeof body.company === 'string' && body.company.trim()) {
    return json(req, 200, { ok: true })
  }

  const url = Deno.env.get('SUPABASE_URL')
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!url || !key) return json(req, 500, { ok: false, error: 'unavailable' })
  const admin = createClient(url, key, { auth: { persistSession: false } })

  if (body.action === 'lookup') {
    const zip = typeof body.zip === 'string' ? body.zip.trim() : ''
    if (!ZIP.test(zip)) return json(req, 400, { ok: false, error: 'invalid_zip' })
    const { data, error } = await admin.from('covered_school_zips').select('district_name').eq('zip', zip).limit(8)
    if (error) {
      console.error('join-waitlist lookup failed')
      return json(req, 500, { ok: false, error: 'unavailable' })
    }
    const districts = [...new Set((data ?? []).map((row) => String(row.district_name ?? '').trim()).filter(Boolean))]
    return json(req, 200, { ok: true, districts })
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const source = typeof body.source === 'string' ? body.source : ''
  if (!EMAIL.test(email) || email.length > 254 || !SOURCES.has(source)) {
    return json(req, 400, { ok: false, error: 'invalid_email' })
  }
  const zip = typeof body.zip === 'string' ? body.zip.trim() : ''
  if (source === 'school_holidays_waitlist' && !ZIP.test(zip)) {
    return json(req, 400, { ok: false, error: 'invalid_email' })
  }

  const salt = Deno.env.get('WAITLIST_SALT')
  if (!salt) return json(req, 500, { ok: false, error: 'unavailable' })
  const ipHash = await sha256(clientIp(req) + salt)
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const { count, error: countError } = await admin
    .from('waitlist')
    .select('id', { count: 'exact', head: true })
    .eq('ip_hash', ipHash)
    .gte('created_at', since)
  if (countError) {
    console.error('join-waitlist count failed')
    return json(req, 500, { ok: false, error: 'unavailable' })
  }
  if ((count ?? 0) >= 5) return json(req, 429, { ok: false, error: 'rate_limited' })

  const language = clip(body.language, 8)
  const { error } = await admin.from('waitlist').upsert(
    {
      email,
      source,
      zip: source === 'school_holidays_waitlist' ? zip : null,
      page_path: clip(body.page_path, 200),
      utm_source: clip(body.utm_source, 80),
      utm_medium: clip(body.utm_medium, 80),
      utm_campaign: clip(body.utm_campaign, 80),
      utm_content: clip(body.utm_content, 80),
      language: language && /^[a-z]{2}$/.test(language) ? language : null,
      ip_hash: ipHash,
    },
    { onConflict: 'email,source', ignoreDuplicates: true },
  )
  if (error) {
    console.error('join-waitlist insert failed')
    return json(req, 500, { ok: false, error: 'unavailable' })
  }
  return json(req, 200, { ok: true })
})
