import { communityRegion } from './schoolZip'
import { INDIA_HOLIDAY_LIST_ID, US_HOLIDAY_LIST_ID } from './sharedLists'

/** The holiday list offered during setup. One clock, one list, or none. */
export function onboardingHolidayList(zone?: string): {
  listId: string
  titleKey: 'reminders.community.usHolidays2026' | 'reminders.community.inHolidays2026'
} | null {
  const region = communityRegion(zone)
  if (region === 'us') return { listId: US_HOLIDAY_LIST_ID, titleKey: 'reminders.community.usHolidays2026' }
  if (region === 'in') return { listId: INDIA_HOLIDAY_LIST_ID, titleKey: 'reminders.community.inHolidays2026' }
  return null
}
