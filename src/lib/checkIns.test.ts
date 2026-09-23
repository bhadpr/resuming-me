import { describe, expect, it } from 'vitest'
import { checkinDue, isQuietHour } from './checkIns'

const base = {
  onboardedAt: new Date('2026-09-01T15:00:00Z'),
  now: new Date('2026-09-03T15:00:00Z'),
  timeZone: 'UTC',
  optedOut: false,
  sentDays: [] as number[],
  unopenedCount: 0,
  sentToday: false,
}

describe('check-in schedule', () => {
  it('treats 22:00–07:00 as quiet', () => {
    expect(isQuietHour(22)).toBe(true)
    expect(isQuietHour(6)).toBe(true)
    expect(isQuietHour(7)).toBe(false)
    expect(isQuietHour(21)).toBe(false)
  })

  it('sends on day 2, 3, and 7 only', () => {
    expect(checkinDue(base)).toBe(2)
    expect(checkinDue({ ...base, now: new Date('2026-09-04T15:00:00Z') })).toBe(3)
    expect(checkinDue({ ...base, now: new Date('2026-09-08T15:00:00Z') })).toBe(7)
    expect(checkinDue({ ...base, now: new Date('2026-09-05T15:00:00Z') })).toBeNull()
  })

  it('stays quiet, skips a second send the same day, and stops after 3 unopened', () => {
    expect(checkinDue({ ...base, now: new Date('2026-09-03T23:30:00Z') })).toBeNull()
    expect(checkinDue({ ...base, sentToday: true })).toBeNull()
    expect(checkinDue({ ...base, unopenedCount: 3 })).toBeNull()
    expect(checkinDue({ ...base, optedOut: true })).toBeNull()
    expect(checkinDue({ ...base, sentDays: [2] })).toBeNull()
  })
})
