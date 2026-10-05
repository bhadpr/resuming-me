import { describe, expect, it } from 'vitest'
import {
  PLAY_PACKAGE,
  codesFromReferrer,
  earnedRupees,
  marketingInstallLink,
  retentionBucket,
} from './marketing'

describe('marketingInstallLink', () => {
  it('builds a Play link whose referrer carries the group and member', () => {
    const link = marketingInstallLink('groupcode', 'membercode')
    const url = new URL(link)
    expect(url.hostname).toBe('play.google.com')
    expect(url.searchParams.get('id')).toBe(PLAY_PACKAGE)
    const referrer = url.searchParams.get('referrer') ?? ''
    expect(codesFromReferrer(referrer)).toEqual({
      groupCode: 'groupcode',
      memberCode: 'membercode',
    })
    expect(referrer).toContain('utm_medium=play')
  })

  it('ignores a Play install with no campaign', () => {
    expect(codesFromReferrer('utm_source=google-play&utm_medium=organic')).toBeNull()
    expect(codesFromReferrer('')).toBeNull()
  })
})

describe('retentionBucket', () => {
  it('counts five different days inside the first 30 as retained', () => {
    expect(retentionBucket('2026-10-01', 5, '2026-10-10')).toBe('retained')
    expect(retentionBucket('2026-10-01', 4, '2026-10-30')).toBe('in_progress')
    expect(retentionBucket('2026-10-01', 4, '2026-10-31')).toBe('ended_short')
    expect(retentionBucket('2026-10-01', 1, '2026-10-01')).toBe('in_progress')
  })
})

describe('earnedRupees', () => {
  it('pays the install rate plus the five-day rate, inside the cap', () => {
    expect(earnedRupees(1000, 100, 5, 50, 20000)).toBe(10000)
    expect(earnedRupees(1000, 200, 5, 50, 20000)).toBe(15000)
    expect(earnedRupees(1000, 400, 5, 50, 20000)).toBe(20000)
    expect(earnedRupees(10, 1, 5, 50, null, 0)).toBe(100)
  })

  it('pays nothing until the group reaches the minimum installs', () => {
    expect(earnedRupees(10, 5, 5, 50, null)).toBe(0)
    expect(earnedRupees(499, 40, 5, 50, null)).toBe(0)
    expect(earnedRupees(500, 40, 5, 50, null)).toBe(4500)
  })
})
