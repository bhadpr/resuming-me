import { describe, it, expect } from 'vitest'
import { isActiveTimerStale, type ActiveTimerState } from './timerStorage'

const sample: ActiveTimerState = {
  activityId: 'reading-id',
  date: '2026-08-12',
  status: 'running',
  accumulatedSeconds: 0,
  segmentStartedAt: '2026-08-12T10:00:00.000Z',
  sessionStartedAt: '2026-08-12T10:00:00.000Z',
}

describe('isActiveTimerStale', () => {
  it('is stale when date is not today', () => {
    expect(
      isActiveTimerStale(
        { ...sample, date: '2026-08-11' },
        '2026-08-12',
        ['reading-id'],
      ),
    ).toBe(true)
  })

  it('is stale when activity id is not in the active list', () => {
    expect(
      isActiveTimerStale(sample, '2026-08-12', ['walk-id']),
    ).toBe(true)
  })

  it('is valid for today and a known activity', () => {
    expect(
      isActiveTimerStale(sample, '2026-08-12', ['reading-id']),
    ).toBe(false)
  })
})
