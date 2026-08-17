import { describe, it, expect } from 'vitest'
import { validateMetricInput, STARTER_METRICS } from './metrics'

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

describe('STARTER_METRICS', () => {
  it('offers Weight and Sleep', () => {
    expect(STARTER_METRICS.map((m) => m.name)).toEqual(['Weight', 'Sleep'])
    for (const metric of STARTER_METRICS) {
      expect(validateMetricInput(metric)).toBeNull()
    }
  })
})
