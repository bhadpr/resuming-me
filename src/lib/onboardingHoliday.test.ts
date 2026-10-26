import { describe, expect, it } from 'vitest'
import { INDIA_HOLIDAY_LIST_ID, US_HOLIDAY_LIST_ID } from './sharedLists'
import { onboardingHolidayList } from './onboardingHoliday'

describe('onboarding holiday list', () => {
  it('offers the US catalog on a US clock', () => {
    expect(onboardingHolidayList('America/Los_Angeles')).toEqual({
      listId: US_HOLIDAY_LIST_ID,
      titleKey: 'reminders.community.usHolidays2026',
    })
  })

  it('offers the India catalog on an India clock', () => {
    expect(onboardingHolidayList('Asia/Kolkata')).toEqual({
      listId: INDIA_HOLIDAY_LIST_ID,
      titleKey: 'reminders.community.inHolidays2026',
    })
    expect(onboardingHolidayList('Asia/Calcutta')?.listId).toBe(INDIA_HOLIDAY_LIST_ID)
  })

  it('asks nothing where neither catalog belongs', () => {
    expect(onboardingHolidayList('America/Vancouver')).toBeNull()
    expect(onboardingHolidayList('Europe/London')).toBeNull()
  })
})
