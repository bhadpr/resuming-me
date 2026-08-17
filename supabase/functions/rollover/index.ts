// Supabase Edge Function: timezone-aware daily/weekly postponement rollover.
// Deploy: supabase functions deploy rollover --project-ref <ref>
// Schedule via SQL in migrations/20260812000000_rollover_cron.sql

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function localDateInTimeZone(utc: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(utc)
}

function addDays(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  dt.setDate(dt.getDate() + days)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function startOfWeekMonday(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12, 0, 0, 0)
  const day = dt.getDay()
  const diff = day === 0 ? -6 : 1 - day
  dt.setDate(dt.getDate() + diff)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function endOfWeekSunday(date: string): string {
  return addDays(startOfWeekMonday(date), 6)
}

function startOfMonth(date: string): string {
  const [y, m] = date.split('-')
  return `${y}-${m}-01`
}

function endOfMonth(date: string): string {
  const [y, m] = startOfMonth(date).split('-').map(Number)
  const dt = new Date(y, m, 0, 12, 0, 0, 0)
  const yy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

type Activity = {
  id: string
  user_id: string
  type: string
  tracking_mode: string
  target_value: number | null
  target_unit: string | null
  weekly_target: number | null
  archived: boolean
  created_at: string
}

type LogEntry = {
  activity_id: string
  type: string
  date: string
  duration_seconds: number | null
}

function targetToSeconds(a: Activity): number {
  const value = a.target_value ?? 0
  return a.target_unit === 'seconds' ? value : value * 60
}

function dailyMet(a: Activity, entries: LogEntry[], date: string): boolean {
  if (a.tracking_mode === 'timer') {
    const seconds = entries
      .filter((e) => e.activity_id === a.id && e.type === 'session' && e.date === date)
      .reduce((s, e) => s + (e.duration_seconds ?? 0), 0)
    return seconds >= targetToSeconds(a)
  }
  const target = a.tracking_mode === 'checkbox' ? 1 : (a.target_value ?? 1)
  const count = entries.filter(
    (e) => e.activity_id === a.id && e.type === 'completed' && e.date === date,
  ).length
  return count >= target
}

function weeklyMet(a: Activity, entries: LogEntry[], weekStart: string): boolean {
  const weekEnd = endOfWeekSunday(weekStart)
  const target = a.weekly_target ?? 1
  if (a.tracking_mode === 'timer') {
    const min = Math.max(1, targetToSeconds(a))
    const qualifying = entries.filter(
      (e) =>
        e.activity_id === a.id &&
        e.type === 'session' &&
        e.date >= weekStart &&
        e.date <= weekEnd &&
        (e.duration_seconds ?? 0) >= min,
    ).length
    return qualifying >= target
  }
  const count = entries.filter(
    (e) =>
      e.activity_id === a.id &&
      e.type === 'completed' &&
      e.date >= weekStart &&
      e.date <= weekEnd,
  ).length
  return count >= target
}

function monthlyMet(a: Activity, entries: LogEntry[], monthStart: string): boolean {
  const monthEnd = endOfMonth(monthStart)
  const count = entries.filter(
    (e) =>
      e.activity_id === a.id &&
      e.type === 'completed' &&
      e.date >= monthStart &&
      e.date <= monthEnd,
  ).length
  return count >= 1
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const { data: profiles, error: profileError } = await admin
      .from('profiles')
      .select('id, timezone')

    if (profileError) throw profileError

    const nowUtc = new Date()
    let written = 0

    for (const profile of profiles ?? []) {
      const timezone = profile.timezone || 'UTC'
      const localToday = localDateInTimeZone(nowUtc, timezone)
      const yesterday = addDays(localToday, -1)
      const dailyFrom = addDays(yesterday, -14)
      const monthlyFrom = startOfMonth(addDays(startOfMonth(localToday), -40))
      const from = dailyFrom < monthlyFrom ? dailyFrom : monthlyFrom

      const { data: activities } = await admin
        .from('activities')
        .select(
          'id, user_id, type, tracking_mode, target_value, target_unit, weekly_target, archived, created_at',
        )
        .eq('user_id', profile.id)
        .eq('archived', false)

      const acts = (activities ?? []) as Activity[]
      if (acts.length === 0) continue

      const ids = acts.map((a) => a.id)
      const { data: entries } = await admin
        .from('log_entries')
        .select('activity_id, type, date, duration_seconds')
        .in('activity_id', ids)
        .gte('date', from)
        .lte('date', localToday)

      const logs = (entries ?? []) as LogEntry[]
      const postponedDates = new Set(
        logs
          .filter((e) => e.type === 'postponed')
          .map((e) => `${e.activity_id}:${e.date}`),
      )

      const toInsert: Array<{
        user_id: string
        activity_id: string
        type: string
        date: string
      }> = []

      for (let i = 0; i < 14; i++) {
        const closedDay = addDays(yesterday, -i)
        for (const a of acts) {
          if (a.type !== 'daily') continue
          if (closedDay < a.created_at.slice(0, 10)) continue
          if (postponedDates.has(`${a.id}:${closedDay}`)) continue
          if (dailyMet(a, logs, closedDay)) continue
          toInsert.push({
            user_id: profile.id,
            activity_id: a.id,
            type: 'postponed',
            date: closedDay,
          })
          postponedDates.add(`${a.id}:${closedDay}`)
        }
      }

      for (let w = 0; w < 3; w++) {
        const weekEnd = addDays(yesterday, -w * 7)
        const weekStart = startOfWeekMonday(weekEnd)
        const sunday = endOfWeekSunday(weekStart)
        if (sunday > yesterday) continue
        for (const a of acts) {
          if (a.type !== 'weekly_n') continue
          if (sunday < a.created_at.slice(0, 10)) continue
          if (postponedDates.has(`${a.id}:${sunday}`)) continue
          if (weeklyMet(a, logs, weekStart)) continue
          toInsert.push({
            user_id: profile.id,
            activity_id: a.id,
            type: 'postponed',
            date: sunday,
          })
          postponedDates.add(`${a.id}:${sunday}`)
        }
      }

      let monthEnd = endOfMonth(addDays(startOfMonth(localToday), -1))
      for (let m = 0; m < 2; m++) {
        if (monthEnd > yesterday) {
          monthEnd = endOfMonth(addDays(startOfMonth(monthEnd), -1))
          continue
        }
        const monthStart = startOfMonth(monthEnd)
        for (const a of acts) {
          if (a.type !== 'monthly') continue
          if (monthEnd < a.created_at.slice(0, 10)) continue
          if (postponedDates.has(`${a.id}:${monthEnd}`)) continue
          if (monthlyMet(a, logs, monthStart)) continue
          toInsert.push({
            user_id: profile.id,
            activity_id: a.id,
            type: 'postponed',
            date: monthEnd,
          })
          postponedDates.add(`${a.id}:${monthEnd}`)
        }
        monthEnd = endOfMonth(addDays(monthStart, -1))
      }

      if (toInsert.length > 0) {
        const { error: insertError } = await admin.from('log_entries').insert(toInsert)
        if (insertError && insertError.code !== '23505') throw insertError
        written += toInsert.length
      }
    }

    return new Response(JSON.stringify({ ok: true, written }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
