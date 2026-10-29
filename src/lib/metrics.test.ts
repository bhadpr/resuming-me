import { describe, expect, it } from 'vitest'
import { describeMetric, STARTER_METRICS, validateMetricInput, type Metric } from './metrics'

function metric(partial: Partial<Metric> = {}): Metric {
  return {
    id: 'm1',
    user_id: 'u',
    name: 'Blood Pressure',
    emoji: '❤️',
    unit: 'mmHg',
    archived: false,
    template_id: 'blood_pressure',
    name_overridden: false,
    created_at: '',
    updated_at: '',
    ...partial,
  }
}

describe('describeMetric', () => {
  it('uses the person’s own description', () => {
    expect(describeMetric(metric({ description: 'After breakfast' }))).toBe('After breakfast')
  })

  it('uses their target before the shared range', () => {
    expect(describeMetric(metric({ target_value: 70, unit: 'kg', template_id: 'weight', name: 'Weight' }))).toBe(
      'Target 70 kg',
    )
  })
})


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
  it('offers Weight and leaves Sleep out for now', () => {
    expect(STARTER_METRICS.map((m) => m.name)).toEqual([
      'Weight',
      'Daily Steps',
      'Blood Pressure',
      'Heart Rate',
      'Water',
      'Protein',
      'Fasting',
    ])
    for (const metric of STARTER_METRICS) {
      expect(validateMetricInput(metric)).toBeNull()
    }
  })
})
