/** Email and Apple stay on the list and stay off until we turn them on. */
export const AUTH_PROVIDERS = [
  { id: 'google', label: 'Continue with Google', enabled: true },
  { id: 'email', label: 'Email me a link', enabled: false },
  { id: 'apple', label: 'Continue with Apple', enabled: false },
] as const

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]['id']
