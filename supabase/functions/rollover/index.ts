// Supabase Edge Function: formerly timezone-aware postponed backfill.
// P1-04: no longer inserts postponed rows. Kept deployable as a no-op.
// Deploy: supabase functions deploy rollover --project-ref <ref>

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  return new Response(JSON.stringify({ ok: true, written: 0, skipped: 'p1-04-no-auto-postponed' }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
