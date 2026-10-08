import { Capacitor } from '@capacitor/core'
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

  const native = Capacitor.isNativePlatform()
  client = createClient<Database>(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // Custom-scheme callbacks never land on window.location; handle them in nativeAuth.
      detectSessionInUrl: !native,
      // PKCE query params survive Android deep links; implicit hash tokens often do not.
      flowType: native ? 'pkce' : 'implicit',
    },
  })

  return client
}

/**
 * Sends a query without waiting for it. Supabase queries only run once awaited
 * or `.then()`-ed, so `void query` alone never reaches the server.
 */
export function sendQuery(query: PromiseLike<{ error: unknown }>, label: string): void {
  Promise.resolve(query).then(
    ({ error }) => {
      if (error) console.warn(`${label} failed`, error)
    },
    (error: unknown) => console.warn(`${label} failed`, error),
  )
}

/** Test-only helper to clear the singleton between tests if needed. */
export function __resetSupabaseClientForTests(): void {
  client = null
}
