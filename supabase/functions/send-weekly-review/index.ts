// Builds a weekly review on the server when the person has not opened the app,
// then emails it. The in-app card uses the same buildWeeklyReview function.
// Deploy: supabase functions deploy send-weekly-review --project-ref <ref>
// Hourly POST with Authorization: Bearer <service role>.
// Skips sending during quiet hours 22:00–07:00 local, and retries later.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'
import { addDays } from '../../../src/lib/dates.ts'
import { buildWeeklyReview } from '../../../src/lib/weeklyReview.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE = 'https://resuming.me'

type DueRow = {
  user_id: string
  email: string
  timezone: string
  local_date: string
  week_start: string
  payload: {
    headline?: string
    comebackLine?: string
    steadiestName?: string | null
  } | null
}

function localHour(timeZone: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const hour = fmt.formatToParts(new Date()).find((part) => part.type === 'hour')?.value
  return Number(hour ?? '12')
}

function quietHour(hour: number): boolean {
  return hour >= 22 || hour < 7
}

async function sendEmail(args: { to: string; subject: string; text: string }): Promise<{ skipped: boolean }> {
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
    body: JSON.stringify({ from, to: [args.to], subject: args.subject, text: args.text }),
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
  if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceRoleKey) return json({ ok: false, error: 'Server misconfigured' }, 500)

  const auth = req.headers.get('Authorization')
  if (auth !== `Bearer ${serviceRoleKey}`) return json({ ok: false, error: 'Unauthorized' }, 401)

  const admin = createClient(supabaseUrl, serviceRoleKey)
  const { data, error } = await admin.rpc('users_due_for_weekly_review')
  if (error) return json({ ok: false, error: error.message }, 500)

  const due = (data ?? []) as DueRow[]
  let sent = 0
  let skipped = 0
  let built = 0
  const failures: string[] = []

  for (const row of due) {
    try {
      let payload = row.payload
      if (!payload) {
        const from = addDays(row.week_start, -21)
        const [activities, entries, rests, pauses, fresh] = await Promise.all([
          admin.from('activities').select('*').eq('user_id', row.user_id).eq('archived', false),
          admin.from('log_entries').select('*').eq('user_id', row.user_id).gte('date', from),
          admin.from('rest_days').select('date').eq('user_id', row.user_id).gte('date', from),
          admin.from('activity_pauses').select('activity_id, paused_from, paused_until').eq('user_id', row.user_id),
          admin.from('fresh_starts').select('id, started_on, covers_from, covers_to').eq('user_id', row.user_id),
        ])
        if (activities.error) throw activities.error
        if (entries.error) throw entries.error
        if (rests.error) throw rests.error
        if (pauses.error) throw pauses.error
        if (fresh.error) throw fresh.error
        const review = buildWeeklyReview({
          activities: (activities.data ?? []) as Parameters<typeof buildWeeklyReview>[0]['activities'],
          entries: (entries.data ?? []) as Parameters<typeof buildWeeklyReview>[0]['entries'],
          today: row.local_date,
          weekStart: row.week_start,
          restDates: new Set((rests.data ?? []).map((item) => item.date as string)),
          pauses: (pauses.data ?? []).map((item) => ({
            activityId: item.activity_id as string,
            from: item.paused_from as string,
            until: (item.paused_until as string | null) ?? null,
          })),
          freshStarts: (fresh.data ?? []).map((item) => ({
            id: item.id as string,
            startedOn: item.started_on as string,
            coversFrom: item.covers_from as string,
            coversTo: item.covers_to as string,
          })),
        })
        const { error: saveError } = await admin.from('weekly_reviews').upsert(
          {
            user_id: row.user_id,
            week_start: row.week_start,
            payload: review,
          },
          { onConflict: 'user_id,week_start' },
        )
        if (saveError) throw saveError
        payload = review
        built += 1
      }

      if (quietHour(localHour(row.timezone || 'UTC'))) {
        skipped += 1
        continue
      }

      const headline = payload.headline ?? 'Your week in Resuming.'
      const comeback = payload.comebackLine ?? ''
      const steady = payload.steadiestName ? `Steadiest: ${payload.steadiestName}.` : ''
      const link = `${SITE}/review/${row.week_start}?source=email`
      const text = [headline, comeback, steady, '', `Open the review: ${link}`, '', 'Turn these off in Settings.']
        .filter(Boolean)
        .join('\n')
      const result = await sendEmail({ to: row.email, subject: headline, text })
      if (result.skipped) {
        skipped += 1
        continue
      }
      const { error: updateError } = await admin
        .from('weekly_reviews')
        .update({ emailed_at: new Date().toISOString() })
        .eq('user_id', row.user_id)
        .eq('week_start', row.week_start)
      if (updateError) throw updateError
      sent += 1
    } catch (err) {
      failures.push(err instanceof Error ? err.message : 'send failed')
    }
  }

  return json({ ok: failures.length === 0, sent, skipped, built, due: due.length, failures })
})
