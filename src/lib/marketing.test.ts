import { describe, expect, it } from 'vitest'
import {
  PLAY_PACKAGE,
  codesFromReferrer,
  earnedRupees,
  marketingInstallLink,
  payableNow,
  playGap,
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

describe('payableNow', () => {
  const base = {
    installs: 1000,
    settledInstalls: 800,
    settledRetained: 100,
    playInstalls: 1000,
    installRate: 5,
    retainedRate: 50,
    cap: null,
    minInstalls: 500,
  }

  it('waits for the Play Console number', () => {
    expect(payableNow({ ...base, playInstalls: null })).toBeNull()
  })

  it('pays only settled installs when Google Play agrees', () => {
    expect(payableNow(base)).toEqual({ installs: 800, retained: 100, rupees: 9000 })
  })

  it('scales down to the lower number when Google Play shows fewer installs', () => {
    expect(payableNow({ ...base, playInstalls: 500 })).toEqual({ installs: 400, retained: 50, rupees: 0 })
    expect(payableNow({ ...base, playInstalls: 900, minInstalls: 0 })).toEqual({
      installs: 720,
      retained: 90,
      rupees: 8100,
    })
  })

  it('never pays more than we counted when Google Play shows more', () => {
    expect(payableNow({ ...base, playInstalls: 5000 })?.installs).toBe(800)
  })

  it('keeps the cap and the minimum', () => {
    expect(payableNow({ ...base, cap: 5000 })?.rupees).toBe(5000)
    expect(payableNow({ ...base, settledInstalls: 499 })?.rupees).toBe(0)
  })

  it('pays nothing when we counted no installs', () => {
    expect(payableNow({ ...base, installs: 0, settledInstalls: 0, settledRetained: 0 })?.rupees).toBe(0)
  })
})

describe('playGap', () => {
  it('flags only a clearly larger count of ours', () => {
    expect(playGap(1000, 700)).toEqual({ missing: 300, percent: 30 })
    expect(playGap(1000, 950)).toBeNull()
    expect(playGap(30, 25)).toBeNull()
    expect(playGap(700, 1000)).toBeNull()
    expect(playGap(1000, null)).toBeNull()
  })
})
