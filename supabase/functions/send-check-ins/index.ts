// Day 2 / 3 / 7 check-ins. Deploy:
//   supabase functions deploy send-check-ins --project-ref <ref>
// Hourly POST with Authorization: Bearer <service role>.
// Quiet hours, one a day, and stop-after-3 live in due_checkins().
// Email provider is Resend (RESEND_API_KEY + RESEND_FROM). Without them, nothing is sent.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE = 'https://resuming.me'

type DueRow = {
  user_id: string
  email: string
  day_n: number
  timezone: string
  checkin_token: string
}

function copyFor(day: number): { subject: string; text: string } {
  if (day === 2) {
    return {
      subject: 'Day 2 — one small resume is enough',
      text: 'Day 2. One small resume is enough. Open Today and pick the smallest one.',
    }
  }
  if (day === 3) {
    return {
      subject: 'Still here on day 3',
      text: 'Still here. Open Today and pick the smallest one.',
    }
  }
  return {
    subject: 'A week of Resuming',
    text: 'A week in. Insights can start to show your pattern.',
  }
}

async function sendEmail(args: {
  to: string
  subject: string
  text: string
}): Promise<{ skipped: boolean }> {
  const key = Deno.env.get('RESEND_API_KEY')
  const from = Deno.env.get('RESEND_FROM')
  if (!key || !from) {
    console.log('sendEmail skipped: set RESEND_API_KEY and RESEND_FROM')
    return { skipped: true }
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [args.to],
      subject: args.subject,
      text: args.text,
    }),
  })
  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Resend ${response.status}: ${body.slice(0, 200)}`)
  }
  return { skipped: false }
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Server misconfigured' }, 500)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const url = new URL(req.url)
  const unsubscribe = url.searchParams.get('unsubscribe')

  if (req.method === 'GET' && unsubscribe) {
    const { data, error } = await admin.rpc('opt_out_checkins', { p_token: unsubscribe })
    if (error) return json({ ok: false, error: error.message }, 400)
    const message = data
      ? 'Check-in emails are off. You can turn them back on in Settings.'
      : 'That link is no longer valid.'
    return new Response(`<!doctype html><title>Resuming</title><p>${message}</p>`, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html; charset=utf-8' },
    })
  }

  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${serviceRoleKey}`) return json({ ok: false, error: 'Unauthorized' }, 401)

  const { data, error } = await admin.rpc('due_checkins')
  if (error) return json({ ok: false, error: error.message }, 500)

  const due = (data ?? []) as DueRow[]
  let sent = 0
  let skipped = 0
  const failures: string[] = []

  for (const row of due) {
    const copy = copyFor(row.day_n)
    const open = `${SITE}/today?checkin=1`
    const optOut = `${supabaseUrl}/functions/v1/send-check-ins?unsubscribe=${row.checkin_token}`
    const text = `${copy.text}\n\nOpen Today: ${open}\n\nTurn these off: ${optOut}`
    try {
      const result = await sendEmail({ to: row.email, subject: copy.subject, text })
      if (result.skipped) {
        skipped += 1
        continue
      }
      const { error: insertError } = await admin.from('checkin_deliveries').insert({
        user_id: row.user_id,
        day_n: row.day_n,
      })
      if (insertError) throw insertError
      sent += 1
    } catch (err) {
      failures.push(err instanceof Error ? err.message : 'send failed')
    }
  }

  return json({ ok: failures.length === 0, sent, skipped, due: due.length, failures })
})
