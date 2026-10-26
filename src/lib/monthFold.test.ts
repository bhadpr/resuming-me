import { describe, expect, it } from 'vitest'
import { groupByMonth, monthsClosedByDefault } from './monthFold'

describe('groupByMonth', () => {
  it('keeps days in date order and splits on the month', () => {
    const groups = groupByMonth([
      { day: '2026-12-18', text: 'Winter' },
      { day: '2026-11-11', text: 'Veterans' },
      { day: '2026-11-26', text: 'Thanksgiving' },
    ])
    expect(groups.map((group) => group.key)).toEqual(['2026-11', '2026-12'])
    expect(groups[0]?.items.map((item) => item.text)).toEqual(['Veterans', 'Thanksgiving'])
  })
})

describe('monthsClosedByDefault', () => {
  it('closes months before today and leaves the rest open', () => {
    expect([...monthsClosedByDefault(['2026-09', '2026-10', '2026-11'], '2026-10-24')]).toEqual(['2026-09'])
  })

  it('keeps the latest month open when the whole list is past', () => {
    expect([...monthsClosedByDefault(['2026-01', '2026-02'], '2026-10-24')]).toEqual(['2026-01'])
  })
})
