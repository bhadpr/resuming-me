import { describe, expect, it } from 'vitest'
import { parseAuthCallbackUrl } from './nativeAuth'

describe('parseAuthCallbackUrl', () => {
  it('reads PKCE code from a custom-scheme callback', () => {
    const parsed = parseAuthCallbackUrl(
      'com.cheerfulgames.resuming://auth/callback?code=abc123',
    )
    expect(parsed.code).toBe('abc123')
    expect(parsed.accessToken).toBeNull()
    expect(parsed.error).toBeNull()
  })

  it('reads implicit tokens from the hash', () => {
    const parsed = parseAuthCallbackUrl(
      'com.cheerfulgames.resuming://auth/callback#access_token=tok&refresh_token=ref',
    )
    expect(parsed.accessToken).toBe('tok')
    expect(parsed.refreshToken).toBe('ref')
    expect(parsed.code).toBeNull()
  })

  it('reads OAuth error query params', () => {
    const parsed = parseAuthCallbackUrl(
      'com.cheerfulgames.resuming://auth/callback?error=access_denied&error_description=User%20cancelled',
    )
    expect(parsed.error).toBe('User cancelled')
  })
})
