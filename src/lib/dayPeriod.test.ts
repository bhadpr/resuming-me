import { describe, expect, it } from 'vitest'
import { activityPeriod, defaultPeriodFor, groupByPeriod, isPeriodPast, parseDayPeriod, periodForHour } from './dayPeriod'

describe('groupByPeriod', () => {
  it('orders parts of the day, then medicines, activities, reminders, vitals', () => {
    const groups = groupByPeriod([
      { id: 'bp', period: 'morning', kind: 'vital' },
      { id: 'call', period: 'evening', kind: 'reminder', minutes: 18 * 60 },
      { id: 'walk', period: 'morning', kind: 'activity' },
      { id: 'pill-9', period: 'morning', kind: 'medicine', minutes: 9 * 60 },
      { id: 'pill-8', period: 'morning', kind: 'medicine', minutes: 8 * 60 },
      { id: 'water', period: 'anytime', kind: 'activity' },
    ] as const)
    expect(groups.map((group) => group.period)).toEqual(['morning', 'evening', 'anytime'])
    expect(groups[0].items.map((item) => item.id)).toEqual(['pill-8', 'pill-9', 'walk', 'bp'])
  })

  it('keeps timed reminders before untimed ones in the same part', () => {
    const [group] = groupByPeriod([
      { id: 'later', period: 'anytime', kind: 'reminder', minutes: null },
      { id: 'a', period: 'anytime', kind: 'reminder', minutes: 60 },
    ])
    expect(group.items.map((item) => item.id)).toEqual(['a', 'later'])
  })
})

describe('periodForHour', () => {
  it('splits the day at noon and 5 pm', () => {
    expect(periodForHour(6)).toBe('morning')
    expect(periodForHour(11)).toBe('morning')
    expect(periodForHour(12)).toBe('afternoon')
    expect(periodForHour(16)).toBe('afternoon')
    expect(periodForHour(17)).toBe('evening')
    expect(periodForHour(23)).toBe('evening')
  })

  it('puts items without a time in anytime', () => {
    expect(periodForHour(null)).toBe('anytime')
  })
})

describe('isPeriodPast', () => {
  const at = (hour: number) => new Date(2026, 9, 6, hour, 0)

  it('marks earlier parts of the day as past', () => {
    expect(isPeriodPast('morning', at(9))).toBe(false)
    expect(isPeriodPast('morning', at(13))).toBe(true)
    expect(isPeriodPast('afternoon', at(13))).toBe(false)
    expect(isPeriodPast('afternoon', at(18))).toBe(true)
    expect(isPeriodPast('evening', at(23))).toBe(false)
  })

  it('never marks anytime as past', () => {
    expect(isPeriodPast('anytime', at(23))).toBe(false)
  })
})

describe('parseDayPeriod', () => {
  it('reads the stored choice and older free text', () => {
    expect(parseDayPeriod('morning')).toBe('morning')
    expect(parseDayPeriod('After lunch')).toBe('afternoon')
    expect(parseDayPeriod('before bed')).toBe('evening')
    expect(parseDayPeriod('anytime')).toBe('anytime')
    expect(parseDayPeriod('whenever')).toBeNull()
    expect(parseDayPeriod(null)).toBeNull()
  })
})

describe('activityPeriod', () => {
  it('uses the habit default when nothing was chosen', () => {
    expect(activityPeriod({ templateId: 'walk', usuallyWhen: null })).toBe('morning')
    expect(activityPeriod({ template_id: 'rejuvenation', usually_when: null })).toBe('evening')
    expect(activityPeriod({ templateId: 'water' })).toBe('anytime')
  })

  it('prefers the person’s choice', () => {
    expect(activityPeriod({ templateId: 'walk', usuallyWhen: 'evening' })).toBe('evening')
  })

  it('puts vitals at anytime', () => {
    expect(defaultPeriodFor({ name: 'Weight' })).toBe('anytime')
    expect(defaultPeriodFor({ templateId: 'heart_rate' })).toBe('anytime')
    expect(defaultPeriodFor({ name: 'Blood Pressure' })).toBe('anytime')
  })
})
