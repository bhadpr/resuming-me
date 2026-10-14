/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

/** Set by vite.config.ts: build date and commit, used as the web app version. */
declare const __APP_VERSION__: string

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_HABIT_CLASSIFY_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
