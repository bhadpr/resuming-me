import { describe, expect, it } from 'vitest'
import { formatDistance, sessionWindow, tracksDistance, type DistanceSession } from './healthDistance'

function session(overrides: Partial<DistanceSession> = {}): DistanceSession {
  return {
    id: 's1',
    type: 'session',
    started_at: '2026-10-08T06:00:00.000Z',
    duration_seconds: 30 * 60,
    created_at: '2026-10-08T06:30:05.000Z',
    ...overrides,
  }
}

describe('tracksDistance', () => {
  it('covers walking and running only', () => {
    expect(tracksDistance('walk')).toBe(true)
    expect(tracksDistance('running')).toBe(true)
    expect(tracksDistance('exercise')).toBe(false)
    expect(tracksDistance(null)).toBe(false)
  })
})

describe('sessionWindow', () => {
  it('runs from start to when the session was saved', () => {
    expect(sessionWindow(session())).toEqual({
      start: new Date('2026-10-08T06:00:00.000Z'),
      end: new Date('2026-10-08T06:30:05.000Z'),
    })
  })

  it('includes time the timer sat paused', () => {
    const window = sessionWindow(session({ created_at: '2026-10-08T06:50:00.000Z' }))
    expect(window?.end).toEqual(new Date('2026-10-08T06:50:00.000Z'))
  })

  it('falls back to start plus duration for a late offline sync', () => {
    const window = sessionWindow(session({ created_at: '2026-10-08T15:00:00.000Z' }))
    expect(window?.end).toEqual(new Date('2026-10-08T06:30:00.000Z'))
  })

  it('skips manual entries with no start time', () => {
    expect(sessionWindow(session({ started_at: null }))).toBeNull()
    expect(sessionWindow(session({ type: 'completed' }))).toBeNull()
  })
})

describe('formatDistance', () => {
  it('hides tiny readings', () => {
    expect(formatDistance(0)).toBeNull()
    expect(formatDistance(40)).toBeNull()
  })

  it('uses metres under a kilometre and km above', () => {
    expect(formatDistance(843)).toBe('840 m')
    expect(formatDistance(2140)).toBe('2.1 km')
    expect(formatDistance(12600)).toBe('13 km')
  })
})
