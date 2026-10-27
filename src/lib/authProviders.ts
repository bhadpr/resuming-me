import { APPLE_SIGN_IN } from '../config'

/** Apple, then Google, then email. */
export const AUTH_PROVIDERS = [
  { id: 'apple', label: 'Sign in with Apple', enabled: APPLE_SIGN_IN },
  { id: 'google', label: 'Continue with Google', enabled: true },
  { id: 'email', label: 'Email me a link', enabled: true },
] as const

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]['id']
