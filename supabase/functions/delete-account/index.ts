// Supabase Edge Function: delete the calling user's account and data.
// Deploy: supabase functions deploy delete-account --project-ref <ref>
// Requires SUPABASE_SERVICE_ROLE_KEY (set automatically in hosted functions).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

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
