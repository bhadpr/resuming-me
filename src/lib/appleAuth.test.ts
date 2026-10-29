import { describe, expect, it } from 'vitest'
import { appleAccountError, appleSignInCancelled, sha256Hex } from './appleAuth'

describe('sha256Hex', () => {
  it('matches the hex hash Apple puts in the token', async () => {
    expect(await sha256Hex('hello')).toBe(
      '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
    )
  })
})

describe('appleAccountError', () => {
  it('points an email that already has Google back to Google', () => {
    expect(appleAccountError(new Error('User already registered')).message).toBe(
      'That email already uses Google. Sign in with Google to open the same account.',
    )
  })
})

describe('appleSignInCancelled', () => {
  it('treats the system cancel as a quiet stop', () => {
    expect(appleSignInCancelled(new Error('The operation was cancelled.'))).toBe(true)
    expect(appleSignInCancelled(new Error('AuthorizationError error 1001'))).toBe(true)
    expect(appleSignInCancelled(new Error('Apple sign-in did not return a token'))).toBe(false)
  })
})
