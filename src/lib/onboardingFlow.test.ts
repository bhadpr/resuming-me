import { describe, expect, it } from 'vitest'
import {
  EXERCISE_MINUTE_STEPS,
  WALKING_MINUTE_STEPS,
  activitySizeControl,
  applyWeekCadence,
  durationChipLabel,
  weekCadenceOf,
  continueLabel,
  defaultReminderTime,
  WATER_GLASS_NOTE,
  habitVideoCaption,
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
    expect(habitVideoCaption('kapalabhati', 'Kapalabhati')).toBe(
      'Follow along with this Kapalabhati video.',
    )
    expect(habitVideoCaption('water', 'Water')).toBe(
      'A short video will show why water is important.',
    )
    expect(gapHeading({ templateId: 'water' })).toBe('How many glasses is your goal?')
    expect(gapHeading({ templateId: 'protein' })).toBe('How much protein is your goal?')
    expect(gapHeading({ templateId: 'fasting' })).toBe('How many hours is your fast?')
    expect(gapOptionsFor({ templateId: 'fasting' }).map((option) => option.label)).toEqual([
      '4 hours',
      '8 hours',
      '12 hours',
      '16 hours',
      '20 hours',
    ])
    expect(gapReassurance('fasting_16')).toContain('16 hours')
    expect(gapOptionsFor({ templateId: 'protein' }).map((option) => option.label)).toEqual([
      '20 g',
      '30 g',
      '40 g',
      '50 g',
      '60 g',
      '70 g',
    ])
    expect(gapReassurance('protein_50')).toContain('common daily amount')
    expect(gapOptionsFor({ templateId: 'water' }).map((option) => option.label)).toEqual([
      '2 glasses',
      '4 glasses',
      '6 glasses',
      '8 glasses',
      '10 glasses',
    ])
    expect(gapReassurance('glasses_8')).toContain('2,000 ml')
    expect(gapOptionsFor({ templateId: 'sleep_hours' }).map((option) => option.label)).toEqual([
      '6 hours',
      '7 hours',
      '8 hours',
      '9 hours',
    ])
    expect(gapOptionsFor({ templateId: 'steps' }).map((option) => option.label)).toEqual([
      '6,000',
      '8,000',
      '10,000',
      '12,000',
      '15,000',
    ])
    expect(WATER_GLASS_NOTE).toBe('One glass is 250 ml.')
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
    ).toBe('3 habits · 1 resumed today · nudge at 7:00 pm')
  })

  it('sets daily, once a week, or twice a week without changing the session size', () => {
    const painting = {
      type: 'daily' as const,
      weeklyTarget: null,
      targetValue: 60,
      targetUnit: 'minutes',
    }
    expect(weekCadenceOf(painting)).toBe('daily')
    const once = applyWeekCadence(painting, 'once')
    expect(once).toMatchObject({ type: 'weekly_n', weeklyTarget: 1, targetValue: 60 })
    expect(weekCadenceOf(once)).toBe('once')
    const twice = applyWeekCadence(painting, 'twice')
    expect(twice).toMatchObject({ type: 'weekly_n', weeklyTarget: 2, targetValue: 60 })
    expect(weekCadenceOf(twice)).toBe('twice')
    expect(applyWeekCadence(twice, 'daily')).toMatchObject({ type: 'daily', weeklyTarget: null, targetValue: 60 })
  })

  it('shrinks to the smallest step', () => {
    expect(smallestStep(TIMER_MINUTE_STEPS)).toBe(1)
  })

  it('offers walking and exercise their own lengths', () => {
    const walking = activitySizeControl({
      trackingMode: 'timer',
      type: 'daily',
      targetUnit: 'minutes',
      templateId: 'walk',
    })
    expect(walking?.steps).toEqual(WALKING_MINUTE_STEPS)
    expect(walking?.steps.map((step) => durationChipLabel(step))).toEqual([
      '5 mins',
      '10 mins',
      '20 mins',
      '30 mins',
      '40 mins',
      '1 hour',
      '2 hours',
    ])
    const exercise = activitySizeControl({
      trackingMode: 'timer',
      type: 'daily',
      targetUnit: 'minutes',
      templateId: 'exercise',
    })
    expect(exercise?.steps).toEqual(EXERCISE_MINUTE_STEPS)
    expect(exercise?.steps.map((step) => durationChipLabel(step))).toEqual([
      '2 mins',
      '5 mins',
      '10 mins',
      '15 mins',
      '20 mins',
      '40 mins',
      '1 hour',
    ])
  })

  it('does not offer minutes for a daily checkbox', () => {
    expect(
      activitySizeControl({ trackingMode: 'checkbox', type: 'daily', targetUnit: 'minutes' }),
    ).toBeNull()
    expect(
      activitySizeControl({ trackingMode: 'timer', type: 'daily', targetUnit: 'minutes' })?.suffix,
    ).toBe(' min')
    expect(
      activitySizeControl({ trackingMode: 'checkbox', type: 'weekly_n', targetUnit: null }),
    ).toBeNull()
    expect(
      activitySizeControl({
        trackingMode: 'count',
        type: 'daily',
        targetUnit: 'glasses',
        templateId: 'water',
      }),
    ).toBeNull()
    expect(
      activitySizeControl({
        trackingMode: 'count',
        type: 'daily',
        targetUnit: 'g',
        templateId: 'protein',
      }),
    ).toBeNull()
  })
})
