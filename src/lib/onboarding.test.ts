import { describe, it, expect } from 'vitest'
import { shouldShowInstallTip } from './onboarding'

describe('shouldShowInstallTip', () => {
  it('shows only for iOS Safari browser (not installed)', () => {
    expect(
      shouldShowInstallTip({
        dismissed: false,
        standalone: false,
        iosSafari: true,
      }),
    ).toBe(true)
    expect(
      shouldShowInstallTip({
        dismissed: false,
        standalone: true,
        iosSafari: true,
      }),
    ).toBe(false)
  })
})
