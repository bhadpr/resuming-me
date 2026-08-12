import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let client: SupabaseClient<Database> | null = null

export function getSupabaseConfigError(): string | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return 'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env'
  }
  if (supabaseUrl.includes('YOUR_PROJECT_REF') || supabaseUrl.includes('abcdefghijklmnop')) {
    return 'VITE_SUPABASE_URL is still a placeholder. Paste the Project URL from Supabase → Settings → API.'
  }
  if (supabaseAnonKey === 'your_anon_key_here') {
    return 'VITE_SUPABASE_ANON_KEY is still a placeholder. Paste the anon/public key from Supabase → Settings → API.'
  }
  // Legacy JWT anon keys are typically 200+ chars; truncated keys break OAuth session recovery.
  if (supabaseAnonKey.length < 100) {
    return `VITE_SUPABASE_ANON_KEY looks truncated (${supabaseAnonKey.length} chars). Open Supabase → Settings → API and copy the full anon/public key into .env, then restart npm run dev.`
  }
  return null
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfigError() === null
}

/** Shared singleton — required so OAuth hash/session is handled once. */
export function createSupabaseClient(): SupabaseClient<Database> {
  if (client) return client

  const configError = getSupabaseConfigError()
  if (configError) {
    throw new Error(configError)
  }

  client = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'implicit',
    },
  })

  return client
}

/** Test-only helper to clear the singleton between tests if needed. */
export function __resetSupabaseClientForTests(): void {
  client = null
}
