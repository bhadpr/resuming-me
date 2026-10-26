/** Email stays off until that sign-in screen is built. Apple is first. */
export const AUTH_PROVIDERS = [
  { id: 'apple', label: 'Sign in with Apple', enabled: true },
  { id: 'google', label: 'Continue with Google', enabled: true },
  { id: 'email', label: 'Email me a link', enabled: false },
] as const

export type AuthProviderId = (typeof AUTH_PROVIDERS)[number]['id']
