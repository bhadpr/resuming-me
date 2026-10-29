import { describe, expect, it } from 'vitest'
import { skipVitalKeys, uniqueByVitalKey, vitalKey } from './vitalKey'

describe('vitalKey', () => {
  it('treats Daily Steps and a steps habit as one vital', () => {
    expect(vitalKey({ name: 'Daily Steps' })).toBe('steps')
    expect(vitalKey({ template_id: 'steps', name: 'Steps' })).toBe('steps')
  })

  it('keeps the first copy', () => {
    const rows = uniqueByVitalKey([
      { template_id: 'weight', name: 'Weight' },
      { template_id: 'weight', name: 'Weight again' },
      { name: 'Mood' },
    ])
    expect(rows).toEqual([
      { template_id: 'weight', name: 'Weight' },
      { name: 'Mood' },
    ])
  })

  it('hides a metric when that vital is already a goal', () => {
    const metrics = skipVitalKeys(
      [{ name: 'Daily Steps' }, { name: 'Heart Rate' }],
      new Set(['steps']),
    )
    expect(metrics).toEqual([{ name: 'Heart Rate' }])
  })
})
