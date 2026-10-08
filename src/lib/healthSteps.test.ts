import { describe, expect, it } from 'vitest'
import { summarizeStepWeek, type StepDay } from './healthSteps'

const week: StepDay[] = [
  { date: '2026-10-02', steps: 12000 },
  { date: '2026-10-03', steps: 8000 },
  { date: '2026-10-04', steps: 0 },
  { date: '2026-10-05', steps: 10000 },
  { date: '2026-10-06', steps: 6000 },
  { date: '2026-10-07', steps: 4000 },
  { date: '2026-10-08', steps: 1500 },
]

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
