import { describe, expect, it } from 'vitest'
import {
  bpEnds,
  formatPair,
  formatPairDelta,
  habitGoalFor,
  pointStatus,
  vitalTargetFor,
  weightDirection,
  withinTarget,
  type VitalPoint,
} from './vitalChart'

const point = (value: number, secondary: number | null = null): VitalPoint => ({
  date: '2026-08-11',
  value,
  secondary,
})

describe('vitalTargetFor', () => {
  it('uses the fixed ranges for blood pressure and heart rate', () => {
    expect(vitalTargetFor({ name: 'Blood Pressure' }, null, null)).toEqual({ kind: 'bp', upper: 120, lower: 80 })
    expect(vitalTargetFor({ template_id: 'heart_rate' }, 99, null)).toEqual({ kind: 'band', low: 60, high: 100 })
  })

  it('uses the saved target for goals and weight, and draws but does not judge a custom one', () => {
    expect(vitalTargetFor({ name: 'Daily Steps' }, 10000, null)).toEqual({ kind: 'atLeast', value: 10000 })
    expect(vitalTargetFor({ name: 'Weight' }, 65, 'down')).toEqual({ kind: 'weight', value: 65, direction: 'down' })
    expect(vitalTargetFor({ name: 'Mood' }, 7, null)).toEqual({ kind: 'line', value: 7 })
  })

  it('has no target when none is saved', () => {
    expect(vitalTargetFor({ name: 'Weight' }, null, null)).toBeNull()
    expect(vitalTargetFor({ name: 'Daily Steps' }, null, null)).toBeNull()
  })
})

describe('habitGoalFor', () => {
  const habits = [
    { template_id: 'protein', target_value: 40, archived: false },
    { template_id: 'water', target_value: 8, archived: false },
    { template_id: 'fasting', target_value: 16, archived: true },
    { template_id: 'weight', target_value: 70, archived: false },
  ]

  it('uses the goal of the habit with the same template', () => {
    expect(habitGoalFor({ template_id: 'protein' }, habits)).toBe(40)
    expect(habitGoalFor({ name: 'Water' }, habits)).toBe(8)
  })

  it('ignores archived habits, missing habits, and vitals that are not daily goals', () => {
    expect(habitGoalFor({ template_id: 'fasting' }, habits)).toBeNull()
    expect(habitGoalFor({ template_id: 'steps' }, habits)).toBeNull()
    expect(habitGoalFor({ template_id: 'weight' }, habits)).toBeNull()
    expect(habitGoalFor({ template_id: 'blood_pressure' }, habits)).toBeNull()
  })
})

describe('blood pressure', () => {
  const target = vitalTargetFor({ name: 'Blood Pressure' }, null, null)

  it('judges each end against its own limit', () => {
    if (target?.kind !== 'bp') throw new Error('expected a blood pressure target')
    expect(bpEnds(target, point(118, 78))).toEqual({ upper: 'on', lower: 'on' })
    expect(bpEnds(target, point(126, 78))).toEqual({ upper: 'off', lower: 'on' })
    expect(bpEnds(target, point(118, 84))).toEqual({ upper: 'on', lower: 'off' })
    expect(bpEnds(target, point(118))).toEqual({ upper: 'on', lower: null })
  })

  it('is on target only when both numbers are below the limits', () => {
    expect(pointStatus(target, point(118, 78))).toBe('on')
    expect(pointStatus(target, point(120, 78))).toBe('off')
    expect(pointStatus(target, point(110, 80))).toBe('off')
    expect(pointStatus(target, point(110))).toBe('on')
  })
})

describe('other targets', () => {
  it('judges heart rate against the 60 to 100 range, inclusive', () => {
    const target = vitalTargetFor({ name: 'Heart Rate' }, null, null)
    expect(pointStatus(target, point(60))).toBe('on')
    expect(pointStatus(target, point(100))).toBe('on')
    expect(pointStatus(target, point(101))).toBe('off')
    expect(pointStatus(target, point(55))).toBe('off')
  })

  it('treats a day below a daily goal as off target', () => {
    const target = vitalTargetFor({ name: 'Daily Steps' }, 8000, null)
    expect(pointStatus(target, point(8000))).toBe('on')
    expect(pointStatus(target, point(7999))).toBe('off')
  })

  it('judges weight by the direction it started from', () => {
    const down = vitalTargetFor({ name: 'Weight' }, 65, 'down')
    expect(pointStatus(down, point(64))).toBe('on')
    expect(pointStatus(down, point(66))).toBe('off')
    const up = vitalTargetFor({ name: 'Weight' }, 65, 'up')
    expect(pointStatus(up, point(66))).toBe('on')
    expect(pointStatus(up, point(64))).toBe('off')
  })

  it('does not judge weight without a direction, or a custom target', () => {
    expect(pointStatus(vitalTargetFor({ name: 'Weight' }, 65, null), point(70))).toBeNull()
    expect(pointStatus(vitalTargetFor({ name: 'Mood' }, 7, null), point(3))).toBeNull()
    expect(pointStatus(null, point(3))).toBeNull()
  })
})

describe('weightDirection', () => {
  it('points down when the first reading is above the target, and up when below', () => {
    expect(weightDirection(65, 72)).toBe('down')
    expect(weightDirection(65, 58)).toBe('up')
    expect(weightDirection(65, 65)).toBeNull()
  })
})

describe('withinTarget', () => {
  it('counts the readings inside the target', () => {
    const target = vitalTargetFor({ name: 'Blood Pressure' }, null, null)
    const points = [point(118, 78), point(126, 82), point(110, 70), point(122, 90), point(100, 60)]
    expect(withinTarget(target, points)).toEqual({ met: 3, total: 5 })
  })

  it('is null when nothing can be judged', () => {
    expect(withinTarget(null, [point(70)])).toBeNull()
    expect(withinTarget(vitalTargetFor({ name: 'Weight' }, 65, null), [point(70)])).toBeNull()
    expect(withinTarget(vitalTargetFor({ name: 'Heart Rate' }, null, null), [])).toBeNull()
  })
})

describe('formatting', () => {
  it('writes a pair as 126/82 and a single number on its own', () => {
    expect(formatPair(126, 82)).toBe('126/82')
    expect(formatPair(72.5, null)).toBe('72.5')
  })

  it('writes a change for a pair with signs', () => {
    expect(formatPairDelta(2, -1)).toBe('+2/-1')
    expect(formatPairDelta(-0.5, null)).toBe('-0.5')
    expect(formatPairDelta(null, null)).toBe('—')
  })
})
