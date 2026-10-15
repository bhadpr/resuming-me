import { describe, expect, it } from 'vitest'
import { growthWeeksToCsv, parseGrowthMetrics, parseGrowthSnapshots } from './growthMetrics'

const sample = {
  weeks: [
    {
      weekStart: '2026-09-21',
      signups: 3,
      sources: { 'android app': 1, 'google.com': 2 },
      activeUsers: 4,
      checkIns: 10,
      onboardingStarted: 8,
      onboardingFinished: 2,
      slips: 4,
      resumed: 1,
    },
    {
      weekStart: '2026-09-28',
      signups: 0,
      sources: {},
      activeUsers: 0,
      checkIns: 0,
      onboardingStarted: 0,
      onboardingFinished: 0,
      slips: 0,
      resumed: 0,
    },
  ],
  cohorts: [{ weekStart: '2026-09-21', size: 3, d1: 0.5, d7: 0.3333, d30: null }],
  headline: {
    signups: 3,
    d1: 0.5,
    d7: 0.3333,
    d30: null,
    dauYesterday: 2,
    mau: 5,
    avgDau: '1.5',
    stickiness: 0.3,
    onboardingStarted: 8,
    onboardingFinished: 2,
    onboardingCompletion: 0.25,
    checkInsPerActiveUserPerWeek: 2.5,
    slips: 4,
    resumed: 1,
    resumeRate: 0.25,
  },
}

describe('parseGrowthMetrics', () => {
  it('reads the headline, weeks and cohorts, biggest source first', () => {
    const metrics = parseGrowthMetrics(sample)
    expect(metrics.headline.resumeRate).toBe(0.25)
    expect(metrics.headline.avgDau).toBe(1.5)
    expect(metrics.headline.d30).toBeNull()
    expect(metrics.weeks[0]?.sources).toEqual([
      { source: 'google.com', count: 2 },
      { source: 'android app', count: 1 },
    ])
    expect(metrics.cohorts[0]).toEqual({ weekStart: '2026-09-21', size: 3, d1: 0.5, d7: 0.3333, d30: null })
  })

  it('has no rates and no rows when the database sent nothing', () => {
    const metrics = parseGrowthMetrics(null)
    expect(metrics.weeks).toEqual([])
    expect(metrics.cohorts).toEqual([])
    expect(metrics.headline.signups).toBe(0)
    expect(metrics.headline.resumeRate).toBeNull()
    expect(metrics.headline.stickiness).toBeNull()
  })
})

describe('parseGrowthSnapshots', () => {
  it('lists the newest month first and skips rows without a date', () => {
    const snapshots = parseGrowthSnapshots([
      { snapshot_date: '2026-09-01', metrics: { headline: { mau: 3 } } },
      { snapshot_date: '2026-10-01', metrics: { headline: { mau: 7, resumeRate: 0.4 } } },
      { metrics: {} },
    ])
    expect(snapshots.map((s) => s.date)).toEqual(['2026-10-01', '2026-09-01'])
    expect(snapshots[0]?.headline.mau).toBe(7)
    expect(snapshots[0]?.headline.resumeRate).toBe(0.4)
    expect(snapshots[1]?.headline.resumeRate).toBeNull()
  })
})

describe('growthWeeksToCsv', () => {
  it('writes one line per week with percentages and blanks for missing data', () => {
    const lines = growthWeeksToCsv(parseGrowthMetrics(sample)).split('\n')
    expect(lines[0]).toBe(
      'week_start,signups,top_source,active_users,check_ins,check_ins_per_active_user,onboarding_started,onboarding_finished,onboarding_completion_pct,d1_pct,d7_pct,d30_pct,slips,resumed,resume_rate_pct',
    )
    expect(lines[1]).toBe('2026-09-21,3,google.com,4,10,2.50,8,2,25,50,33.3,,4,1,25')
    expect(lines[2]).toBe('2026-09-28,0,,0,0,,0,0,,,,,0,0,')
  })

  it('quotes a source that contains a comma', () => {
    const metrics = parseGrowthMetrics({
      ...sample,
      weeks: [{ ...sample.weeks[0], sources: { 'a, b': 1 } }],
    })
    expect(growthWeeksToCsv(metrics).split('\n')[1]).toContain('"a, b"')
  })
})
