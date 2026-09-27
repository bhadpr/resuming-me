import { describe, expect, it } from 'vitest'
import { classifyHabitLocally, parseHabitKindPayload } from './habitKind'

describe('classifyHabitLocally', () => {
  it('treats carb intake as a gram vital with a common daily amount', () => {
    const plan = classifyHabitLocally('Carbs intake')
    expect(plan.kind).toBe('vital')
    expect(plan.measure).toBe('grams')
    expect(plan.targetUnit).toBe('g')
    expect(plan.recommended).toBe(250)
    expect(plan.goalSteps).toEqual([100, 150, 200, 250, 300])
    expect(plan.targetValue).toBeNull()
    expect(plan.confident).toBe(true)
  })

  it('keeps a walk as a timed activity', () => {
    const plan = classifyHabitLocally('Go for a walk every day')
    expect(plan.kind).toBe('activity')
    expect(plan.measure).toBe('minutes')
    expect(plan.targetUnit).toBe('minutes')
    expect(plan.trackingMode).toBe('timer')
  })

  it('does not treat an unknown phrase as a vital', () => {
    const plan = classifyHabitLocally('go to Mountain')
    expect(plan.kind).toBe('activity')
    expect(plan.measure).toBe('minutes')
    expect(plan.confident).toBe(false)
  })

  it('logs weight instead of asking for minutes', () => {
    expect(classifyHabitLocally('Weight').measure).toBe('log')
    expect(classifyHabitLocally('Weight').trackingMode).toBe('checkbox')
  })
})

describe('parseHabitKindPayload', () => {
  it('accepts an AI answer and keeps the recommended amount in the choices', () => {
    const plan = parseHabitKindPayload({
      kind: 'vital',
      input: 'grams',
      recommended: 225,
      options: [150, 200, 300],
    })
    expect(plan?.measure).toBe('grams')
    expect(plan?.targetUnit).toBe('g')
    expect(plan?.recommended).toBe(225)
    expect(plan?.goalSteps).toEqual([150, 200, 225, 300])
  })

  it('rejects a malformed answer', () => {
    expect(parseHabitKindPayload({ kind: 'vital' })).toBeNull()
    expect(parseHabitKindPayload(null)).toBeNull()
  })
})
