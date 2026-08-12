import { describe, it, expect } from 'vitest'
import {
  getStarterActivityTemplates,
  getStarterMetricTemplates,
  needsOnboarding,
  shouldShowInstallTip,
} from './onboarding'
import { validateActivityInput } from './activities'
import { validateMetricInput } from './metrics'

describe('getStarterActivityTemplates', () => {
  it('returns reading, gym, and taxes starters', () => {
    const templates = getStarterActivityTemplates('2026-08-12')
    expect(templates.map((t) => t.id)).toEqual([
      'reading',
      'walk',
      'run',
      'gym',
      'meditation',
      'taxes',
    ])
  })

  it('produces valid activity inputs', () => {
    for (const t of getStarterActivityTemplates('2026-08-12')) {
      expect(validateActivityInput(t.input)).toBeNull()
    }
  })

  it('sets taxes deadline 30 days out', () => {
    const taxes = getStarterActivityTemplates('2026-08-12').find((t) => t.id === 'taxes')
    expect(taxes?.input.deadline).toBe('2026-09-11')
    expect(taxes?.input.type).toBe('deadline')
  })
})

describe('getStarterMetricTemplates', () => {
  it('includes weight with a valid unit', () => {
    const templates = getStarterMetricTemplates()
    expect(templates).toHaveLength(1)
    expect(validateMetricInput(templates[0].input)).toBeNull()
  })
})

describe('needsOnboarding', () => {
  it('is true when empty and not dismissed', () => {
    expect(needsOnboarding(0, false)).toBe(true)
  })

  it('is false when dismissed or already has activities', () => {
    expect(needsOnboarding(0, true)).toBe(false)
    expect(needsOnboarding(2, false)).toBe(false)
  })
})

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
    expect(
      shouldShowInstallTip({
        dismissed: true,
        standalone: false,
        iosSafari: true,
      }),
    ).toBe(false)
  })
})
