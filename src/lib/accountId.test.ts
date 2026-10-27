import { describe, expect, it } from 'vitest'
import { SIGN_IN_AGAIN, accountIdOrSignIn } from './accountId'

describe('accountIdOrSignIn', () => {
  it('uses the account id from the auth server', () => {
    expect(accountIdOrSignIn('6b1e0c3a-1b2c-4d5e-8f90-123456789abc')).toBe(
      '6b1e0c3a-1b2c-4d5e-8f90-123456789abc',
    )
  })

  it('asks for a fresh sign-in when the account is missing', () => {
    expect(() => accountIdOrSignIn(undefined, 'invalid claim: missing sub claim')).toThrow(SIGN_IN_AGAIN)
  })

  it('keeps a network failure as a network failure', () => {
    expect(() => accountIdOrSignIn(undefined, 'TypeError: Load failed')).toThrow('TypeError: Load failed')
  })
})
