import { describe, expect, it } from 'vitest'
import {
  activitySizeControl,
  continueLabel,
  defaultReminderTime,
  gapHeading,
  gapOptionsFor,
  gapReassurance,
  onboardingSummary,
  smallestStep,
  TIMER_MINUTE_STEPS,
  toggleSlip,
} from './onboardingFlow'

describe('onboarding flow copy', () => {
  it('reassures each gap and auto-advance copy stays short', () => {
    expect(gapReassurance('few_days')).toBe('Easy to pick back up.')
    expect(gapReassurance('never')).toContain('Two minutes')
    expect(gapHeading({ templateId: 'reading' })).toBe('When did you last do this?')
    expect(gapHeading({ templateId: 'water' })).toBe('How many glasses is your goal?')
    expect(gapOptionsFor({ templateId: 'water' }).map((option) => option.label)).toEqual([
      '2 glasses',
      '4 glasses',
      '6 glasses',
      '8 glasses',
      '10 glasses',
    ])
    expect(gapReassurance('glasses_8')).toContain('2,000 ml')
  })

  it('picks a reminder time from the slip chips', () => {
    expect(defaultReminderTime(['Mornings'])).toBe('08:00')
    expect(defaultReminderTime(['Evenings', 'Weekends'])).toBe('19:00')
    expect(defaultReminderTime(['Weekends'])).toBe('10:00')
    expect(defaultReminderTime(['Not sure'])).toBe('19:00')
  })

  it('labels continue with the selected count', () => {
    expect(continueLabel(2)).toBe('Continue with 2')
  })

  it('caps slip answers at two', () => {
    expect(toggleSlip(['Mornings', 'Evenings'], 'Weekends')).toEqual(['Mornings', 'Evenings'])
    expect(toggleSlip(['Mornings'], 'Mornings')).toEqual([])
  })

  it('summarizes the save screen', () => {
    expect(
      onboardingSummary({
        activities: [{}, {}, {}] as never,
        logs: [{}] as never,
        reminderTime: '19:00',
        reminderDeclined: false,
      }),
    ).toBe('3 activities · 1 resumed today · nudge at 19:00')
  })

  it('shrinks to the smallest step', () => {
    expect(smallestStep(TIMER_MINUTE_STEPS)).toBe(1)
  })

  it('does not offer minutes for a daily checkbox', () => {
    expect(
      activitySizeControl({ trackingMode: 'checkbox', type: 'daily', targetUnit: 'minutes' }),
    ).toBeNull()
    expect(
      activitySizeControl({ trackingMode: 'timer', type: 'daily', targetUnit: 'minutes' })?.suffix,
    ).toBe(' min')
    expect(
      activitySizeControl({ trackingMode: 'checkbox', type: 'weekly_n', targetUnit: null })?.suffix,
    ).toBe('×')
    expect(
      activitySizeControl({
        trackingMode: 'count',
        type: 'daily',
        targetUnit: 'glasses',
        templateId: 'water',
      }),
    ).toBeNull()
  })
})
