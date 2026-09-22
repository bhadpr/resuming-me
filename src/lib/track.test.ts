import { describe, expect, it } from 'vitest'
import {
  comebackGapDays,
  sanitizeEventProps,
  smallerChoiceProp,
} from './track'

describe('smallerChoiceProp', () => {
  it('maps minutes to safe enums', () => {
    expect(smallerChoiceProp(2)).toBe('2_min')
    expect(smallerChoiceProp(1)).toBe('1_min')
    expect(smallerChoiceProp(null)).toBe('just_started')
  })
})

describe('comebackGapDays', () => {
  it('returns null under threshold', () => {
    expect(comebackGapDays('2026-09-20', '2026-09-22', 3)).toBeNull()
    expect(comebackGapDays('2026-09-21', '2026-09-22', 3)).toBeNull()
  })

  it('returns gap when 3+ days', () => {
    expect(comebackGapDays('2026-09-19', '2026-09-22', 3)).toBe(3)
    expect(comebackGapDays('2026-09-10', '2026-09-22', 3)).toBe(12)
  })

  it('returns null without a prior win', () => {
    expect(comebackGapDays(null, '2026-09-22')).toBeNull()
  })
})

describe('sanitizeEventProps', () => {
  it('strips personal text keys and keeps safe scalars', () => {
    expect(
      sanitizeEventProps({
        kind: 'session',
        minutes: 2,
        name: 'Meditate',
        notes: 'secret',
        title: 'nope',
      }),
    ).toEqual({ kind: 'session', minutes: 2 })
  })
})
