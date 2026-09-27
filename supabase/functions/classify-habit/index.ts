// Supabase Edge Function: classify a typed habit as an activity or a vital.
// Deploy: supabase functions deploy classify-habit --project-ref <ref>
// Secret: supabase secrets set OPENAI_API_KEY=... --project-ref <ref>
// The anon key is enough to call it. Guests on the start screen are not signed in.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SYSTEM = `You classify one habit name for a quiet habit app.
Reply with JSON only, no markdown:
{"kind":"activity"|"vital","input":"minutes"|"grams"|"glasses"|"hours"|"sleep"|"steps"|"log"|"count","recommended":number|null,"options":number[]}
activity means something a person does. Use input minutes and a small recommended session from 2 to 30. options can be empty.
vital means a number they log.
Carbs, protein, fiber, sugar, and fat use grams. recommended is a common daily amount for a typical adult, not a prescription. options is 4 to 6 round numbers that include recommended.
Water uses glasses, recommended 8, options [2,4,6,8,10].
Sleep uses sleep, recommended 8, options [6,7,8,9].
Fasting uses hours. Steps uses steps.
Weight, blood pressure, and heart rate use log, recommended null, options [].
If you are unsure, use kind activity, input minutes, recommended 10, options [].`

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ ok: false }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = Deno.env.get('OPENAI_API_KEY')
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, error: 'AI is not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let name = ''
  try {
    const body = await req.json()
    name = typeof body?.name === 'string' ? body.name.trim().slice(0, 80) : ''
  } catch {
    name = ''
  }
  if (!name) {
    return new Response(JSON.stringify({ ok: false, error: 'Name is required' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: name },
        ],
      }),
    })
    if (!response.ok) {
      return new Response(JSON.stringify({ ok: false }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const payload = await response.json()
    const text = payload?.choices?.[0]?.message?.content
    if (typeof text !== 'string') {
      return new Response(JSON.stringify({ ok: false }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
    const parsed = JSON.parse(text)
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch {
    return new Response(JSON.stringify({ ok: false }), {
      status: 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
