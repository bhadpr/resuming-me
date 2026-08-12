import { describe, it, expect } from 'vitest'
import { validateMetricInput } from './metrics'

describe('validateMetricInput', () => {
  it('requires name', () => {
    expect(
      validateMetricInput({ name: '  ', emoji: '⚖️', unit: 'lbs' }),
    ).toBe('Name is required')
  })

  it('requires unit', () => {
    expect(
      validateMetricInput({ name: 'Weight', emoji: '⚖️', unit: '' }),
    ).toBe('Unit is required')
  })

  it('accepts a valid metric', () => {
    expect(
      validateMetricInput({ name: 'Weight', emoji: '⚖️', unit: 'lbs' }),
    ).toBeNull()
  })
})
