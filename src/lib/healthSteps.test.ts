import { describe, expect, it } from 'vitest'
import {
  appleStepRead,
  fillStepDays,
  showAppleZeroStepsHint,
  showAppleZeroWeekHint,
  summarizeStepWeek,
  type StepDay,
} from './healthSteps'

const week: StepDay[] = [
  { date: '2026-10-02', steps: 12000 },
  { date: '2026-10-03', steps: 8000 },
  { date: '2026-10-04', steps: 0 },
  { date: '2026-10-05', steps: 10000 },
  { date: '2026-10-06', steps: 6000 },
  { date: '2026-10-07', steps: 4000 },
  { date: '2026-10-08', steps: 1500 },
]

describe('appleStepRead', () => {
  it('asks before the first Health prompt', () => {
    expect(appleStepRead(true, false, 0)).toEqual({ status: 'needs-permission' })
  })

  it('keeps a refused day as zero steps', () => {
    expect(appleStepRead(true, true, 0)).toEqual({ status: 'count', steps: 0 })
  })

  it('stays unavailable when Health is missing', () => {
    expect(appleStepRead(false, true, 40)).toEqual({ status: 'unavailable' })
  })
})

describe('fillStepDays', () => {
  it('fills a missing day with zero', () => {
    const days = fillStepDays([{ date: '2026-10-26', steps: 1200 }], new Date(2026, 9, 26, 15), 2)
    expect(days).toEqual([
      { date: '2026-10-25', steps: 0 },
      { date: '2026-10-26', steps: 1200 },
    ])
  })
})

describe('showAppleZeroStepsHint', () => {
  it('shows the Health hint only for a zero iPhone day', () => {
    expect(showAppleZeroStepsHint('ios', 0)).toBe(true)
    expect(showAppleZeroStepsHint('ios', 10)).toBe(false)
    expect(showAppleZeroStepsHint('android', 0)).toBe(false)
    expect(showAppleZeroWeekHint('ios', [{ steps: 4 }, { steps: 0 }])).toBe(true)
  })
})

describe('summarizeStepWeek', () => {
  it('counts days at or over the goal', () => {
    expect(summarizeStepWeek(week, 10000, '2026-10-08').metDays).toBe(2)
  })

  it('leaves an unfinished today out of the average', () => {
    expect(summarizeStepWeek(week, 10000, '2026-10-08').average).toBe(6667)
  })

  it('counts today once it beats the goal', () => {
    const done = week.map((day) => (day.date === '2026-10-08' ? { ...day, steps: 11000 } : day))
    const summary = summarizeStepWeek(done, 10000, '2026-10-08')
    expect(summary.metDays).toBe(3)
    expect(summary.average).toBe(7286)
    expect(summary.best).toBe(12000)
  })
})
