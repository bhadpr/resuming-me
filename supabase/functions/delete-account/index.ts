// Supabase Edge Function: delete the calling user's account and data.
// Deploy: supabase functions deploy delete-account --project-ref <ref>
// Requires SUPABASE_SERVICE_ROLE_KEY (set automatically in hosted functions).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { importPKCS8, SignJWT } from 'https://esm.sh/jose@5.9.6'

const APPLE_BUNDLE_ID = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.cheerfulgames.resuming'
const APPLE_SERVICES_ID = Deno.env.get('APPLE_SERVICES_ID') ?? 'com.cheerfulgames.resuming.signin'

function json(status: number, body: { ok: boolean; error?: string }): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function appleClientSecret(clientId: string): Promise<string> {
  const teamId = Deno.env.get('APPLE_TEAM_ID')
  const keyId = Deno.env.get('APPLE_KEY_ID')
  const privateKey = Deno.env.get('APPLE_PRIVATE_KEY')
  if (!teamId || !keyId || !privateKey) {
    throw new Error('Apple sign-in secret is not configured')
  }
  const pem = privateKey.includes('\\n') ? privateKey.replace(/\\n/g, '\n') : privateKey
  const key = await importPKCS8(pem, 'ES256')
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: keyId })
    .setIssuer(teamId)
    .setIssuedAt()
    .setExpirationTime('180d')
    .setAudience('https://appleid.apple.com')
    .setSubject(clientId)
    .sign(key)
}

async function exchangeAppleCode(code: string, clientId: string): Promise<string> {
  const secret = await appleClientSecret(clientId)
  const response = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      code,
      grant_type: 'authorization_code',
    }),
  })
  const payload = (await response.json().catch(() => ({}))) as { refresh_token?: string; error?: string }
  if (!response.ok || !payload.refresh_token) {
    throw new Error(payload.error || 'Apple did not return a refresh token')
  }
  return payload.refresh_token
}

async function revokeApple(token: string, clientId: string): Promise<void> {
  const secret = await appleClientSecret(clientId)
  const response = await fetch('https://appleid.apple.com/auth/revoke', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: secret,
      token,
      token_type_hint: 'refresh_token',
    }),
  })
  if (response.ok) return
  const text = await response.text()
  if (text.includes('invalid_grant') || text.includes('invalid_token')) return
  throw new Error(text || 'Could not revoke Apple sign-in')
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false, error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Server misconfigured' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const rawBody = await req.text()
    const body = rawBody
      ? (JSON.parse(rawBody) as { action?: string; authorizationCode?: string; refreshToken?: string })
      : {}

    if (body.action === 'remember') {
      const code = body.authorizationCode?.trim()
      const givenRefresh = body.refreshToken?.trim()
      if (!code && !givenRefresh) {
        return json(400, { ok: false, error: 'Missing Apple sign-in token' })
      }
      try {
        const clientId = code ? APPLE_BUNDLE_ID : APPLE_SERVICES_ID
        const refreshToken = code ? await exchangeAppleCode(code, clientId) : givenRefresh!
        const { error: saveError } = await admin.from('apple_sign_in_tokens').upsert({
          user_id: user.id,
          refresh_token: refreshToken,
          client_id: clientId,
          updated_at: new Date().toISOString(),
        })
        if (saveError) return json(500, { ok: false, error: saveError.message })
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not save Apple sign-in'
        return json(500, { ok: false, error: message })
      }
      return json(200, { ok: true })
    }

    const usesApple =
      user.identities?.some((identity) => identity.provider === 'apple') ||
      user.app_metadata?.provider === 'apple'
    if (usesApple) {
      const { data: saved, error: tokenError } = await admin
        .from('apple_sign_in_tokens')
        .select('refresh_token, client_id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (tokenError) return json(500, { ok: false, error: tokenError.message })
      if (saved?.refresh_token && saved.client_id) {
        try {
          await revokeApple(saved.refresh_token, saved.client_id)
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Could not revoke Apple sign-in'
          return json(500, { ok: false, error: message })
        }
      }
    }

    // feedback / page_views use ON DELETE SET NULL — remove identifiable rows first.
    const { error: feedbackError } = await admin
      .from('feedback')
      .delete()
      .eq('user_id', user.id)
    if (feedbackError) {
      return new Response(
        JSON.stringify({ ok: false, error: feedbackError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    const { error: pageViewsError } = await admin
      .from('page_views')
      .delete()
      .eq('user_id', user.id)
    if (pageViewsError) {
      return new Response(
        JSON.stringify({ ok: false, error: pageViewsError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    // Usage events keep only a blanked user id after deletion, so remove them (and the events this
    // device sent before sign-in). Also takes the email off any referral seat.
    const { error: usageError } = await admin.rpc('erase_user_usage', { p_user: user.id })
    if (usageError) {
      return new Response(JSON.stringify({ ok: false, error: usageError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Medicine and reminder photos are not removed by deleting the auth user.
    for (const bucket of ['medicine-photos', 'reminder-photos']) {
      try {
        const { data: photos, error: photoListError } = await admin.storage
          .from(bucket)
          .list(user.id, { limit: 1000 })
        if (!photoListError && photos && photos.length > 0) {
          await admin.storage
            .from(bucket)
            .remove(photos.map((file) => `${user.id}/${file.name}`))
        }
      } catch {
        /* bucket may not exist yet */
      }
    }

    // Shared event photos live under the event id, and the events go with the user below.
    try {
      const { data: events } = await admin
        .from('shared_events')
        .select('photo_path')
        .eq('owner_id', user.id)
        .not('photo_path', 'is', null)
      const paths = (events ?? []).map((row) => row.photo_path as string)
      if (paths.length > 0) await admin.storage.from('event-photos').remove(paths)
    } catch {
      /* bucket may not exist yet */
    }

    // Cascades: profiles, activities (+ history/logs), metrics (+ entries), medicines, reminders, reminder emails.
    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteError) {
      return new Response(JSON.stringify({ ok: false, error: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error'
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
