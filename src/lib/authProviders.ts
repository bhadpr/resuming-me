/** Apple stays on the list and stays off until we turn it on. */
export const AUTH_PROVIDERS = [
  { id: 'google', label: 'Continue with Google', enabled: true },
  { id: 'email', label: 'Email me a link', enabled: true },
  { id: 'apple', label: 'Continue with Apple', enabled: false },
] as const

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]['id']
