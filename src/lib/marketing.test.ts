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
  it('pays only for five-day people, inside the cap', () => {
    expect(earnedRupees(2000, 500, 0, 20, 20000)).toBe(10000)
    expect(earnedRupees(2000, 700, 0, 20, 20000)).toBe(14000)
    expect(earnedRupees(2000, 1000, 0, 20, 20000)).toBe(20000)
    expect(earnedRupees(5000, 2500, 0, 20, 20000)).toBe(20000)
    expect(earnedRupees(2000, 2000, 0, 20, null)).toBe(40000)
  })

  it('pays nothing until the group has the minimum five-day people', () => {
    expect(earnedRupees(5000, 499, 0, 20, 20000)).toBe(0)
    expect(earnedRupees(5000, 0, 0, 20, 20000)).toBe(0)
    expect(earnedRupees(10, 1, 0, 20, null, 0)).toBe(20)
  })

  it('does not count installs toward the minimum', () => {
    expect(earnedRupees(600, 40, 5, 50, null)).toBe(0)
  })

  it('still adds an install rate when a group has one', () => {
    expect(earnedRupees(1000, 500, 5, 20, null)).toBe(15000)
  })
})

describe('payableNow', () => {
  const base = {
    installs: 1500,
    settledInstalls: 1200,
    settledRetained: 600,
    playInstalls: 1500,
    installRate: 0,
    retainedRate: 20,
    cap: 20000,
    minRetained: 500,
  }

  it('waits for the Play Console number', () => {
    expect(payableNow({ ...base, playInstalls: null })).toBeNull()
  })

  it('pays only settled five-day people when Google Play agrees', () => {
    expect(payableNow(base)).toEqual({ installs: 1200, retained: 600, rupees: 12000 })
  })

  it('scales down to the lower number when Google Play shows fewer installs', () => {
    expect(payableNow({ ...base, playInstalls: 750 })).toEqual({ installs: 600, retained: 300, rupees: 0 })
    expect(payableNow({ ...base, playInstalls: 1200, minRetained: 0 })).toEqual({
      installs: 960,
      retained: 480,
      rupees: 9600,
    })
  })

  it('never pays more than we counted when Google Play shows more', () => {
    expect(payableNow({ ...base, playInstalls: 5000 })?.installs).toBe(1200)
  })

  it('keeps the cap and the minimum', () => {
    expect(payableNow({ ...base, settledRetained: 1500 })?.rupees).toBe(20000)
    expect(payableNow({ ...base, cap: 5000 })?.rupees).toBe(5000)
    expect(payableNow({ ...base, settledRetained: 499 })?.rupees).toBe(0)
  })

  it('never counts more five-day people than installs', () => {
    expect(payableNow({ ...base, settledInstalls: 500, settledRetained: 900 })).toEqual({
      installs: 500,
      retained: 500,
      rupees: 10000,
    })
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
