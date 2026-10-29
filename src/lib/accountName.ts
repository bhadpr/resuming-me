import type { User } from '@supabase/supabase-js'

function textValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The name Google or Apple sent with sign-in. An email link does not include one. */
export function accountName(user: User | null): string | null {
  if (!user) return null
  const sources = [user.user_metadata, ...(user.identities ?? []).map((identity) => identity.identity_data)]
  for (const source of sources) {
    if (!source || typeof source !== 'object') continue
    const record = source as Record<string, unknown>
    const full = textValue(record.full_name) ?? textValue(record.name)
    if (full) return full
    const joined = [textValue(record.given_name), textValue(record.family_name)].filter(Boolean).join(' ')
    if (joined) return joined
  }
  return null
}

/** First name for a greeting, such as Bhadresh from Bhadresh Prajapati. */
export function accountFirstName(user: User | null): string | null {
  const full = accountName(user)
  if (!full) return null
  return full.split(/\s+/)[0] || null
}
