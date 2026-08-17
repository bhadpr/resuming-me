import { describe, it, expect } from 'vitest'
import { targetFieldsChanged, validateActivityInput } from './activities'
import { todayLocalDate, yesterdayLocalDate, startOfMonth, endOfMonth } from './dates'
import type { Activity } from './activities'

function baseActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Read',
    emoji: '📚',
    type: 'daily',
    tracking_mode: 'timer',
    target_value: 10,
    target_unit: 'minutes',
    target_effective_from: '2026-08-01',
    weekly_target: null,
    deadline: null,
    micro_steps: [],
    archived: false,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  }
}

describe('validateActivityInput', () => {
  it('requires name', () => {
    expect(
      validateActivityInput({
        name: '  ',
        emoji: '📚',
        type: 'daily',
        trackingMode: 'checkbox',
        targetValue: null,
        targetUnit: null,
        weeklyTarget: null,
        deadline: null,
      }),
    ).toBe('Name is required')
  })

  it('requires weekly target for weekly_n', () => {
    expect(
      validateActivityInput({
        name: 'Gym',
        emoji: '🏋️',
        type: 'weekly_n',
        trackingMode: 'count',
        targetValue: 1,
        targetUnit: null,
        weeklyTarget: null,
        deadline: null,
      }),
    ).toBe('Weekly target must be at least 1')
  })

  it('requires deadline for deadline type', () => {
    expect(
      validateActivityInput({
        name: 'Taxes',
        emoji: '🧾',
        type: 'deadline',
        trackingMode: 'checkbox',
        targetValue: null,
        targetUnit: null,
        weeklyTarget: null,
        deadline: null,
      }),
    ).toBe('Deadline date is required')
  })

  it('accepts a valid daily timer activity', () => {
    expect(
      validateActivityInput({
        name: 'Read',
        emoji: '📚',
        type: 'daily',
        trackingMode: 'timer',
        targetValue: 10,
        targetUnit: 'minutes',
        weeklyTarget: null,
        deadline: null,
      }),
    ).toBeNull()
  })
})

describe('targetFieldsChanged', () => {
  it('detects target value change', () => {
    expect(
      targetFieldsChanged(baseActivity(), {
        name: 'Read',
        emoji: '📚',
        type: 'daily',
        trackingMode: 'timer',
        targetValue: 15,
        targetUnit: 'minutes',
        weeklyTarget: null,
        deadline: null,
      }),
    ).toBe(true)
  })

  it('ignores non-target field edits', () => {
    expect(
      targetFieldsChanged(baseActivity(), {
        name: 'Reading',
        emoji: '📖',
        type: 'daily',
        trackingMode: 'timer',
        targetValue: 10,
        targetUnit: 'minutes',
        weeklyTarget: null,
        deadline: null,
      }),
    ).toBe(false)
  })
})

describe('dates', () => {
  it('formats today as YYYY-MM-DD', () => {
    expect(todayLocalDate(new Date(2026, 7, 11))).toBe('2026-08-11')
  })

  it('formats yesterday relative to given now', () => {
    expect(yesterdayLocalDate(new Date(2026, 7, 11))).toBe('2026-08-10')
  })

  it('finds start and end of a calendar month', () => {
    expect(startOfMonth('2026-08-17')).toBe('2026-08-01')
    expect(endOfMonth('2026-08-17')).toBe('2026-08-31')
    expect(endOfMonth('2026-02-01')).toBe('2026-02-28')
  })
})
