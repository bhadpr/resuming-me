import { describe, expect, it } from 'vitest'
import {
  addedCommunityIds,
  cleanTitles,
  communityFormIssue,
  communityReminderInput,
  communityTitle,
  communityToShow,
  holidayInRegion,
  upcomingCommunity,
  type CommunityReminder,
} from './communityReminders'

const PHOTO = '0b6f6a3e-5a7d-4c1e-9f1a-2b3c4d5e6f70/1f2e3d4c-5b6a-4789-8abc-def012345678.jpg'

function item(patch: Partial<CommunityReminder> = {}): CommunityReminder {
  return {
    id: '0b6f6a3e-5a7d-4c1e-9f1a-2b3c4d5e6f70',
    titles: { en: 'Diwali', hi: 'दिवाली' },
    day: '2026-11-08',
    remindBefore: true,
    remindWeekBefore: false,
    kind: 'event',
    photoPath: PHOTO,
    active: true,
    ...patch,
  }
}

describe('holiday regions', () => {
  it('keeps each holiday on its region, and Christmas on both', () => {
    expect(holidayInRegion(item({ titles: { en: 'Thanksgiving' } }), 'us')).toBe(true)
    expect(holidayInRegion(item({ titles: { en: 'Thanksgiving' } }), 'in')).toBe(false)
    expect(holidayInRegion(item({ titles: { en: 'Diwali' } }), 'in')).toBe(true)
    expect(holidayInRegion(item({ titles: { en: 'Diwali' } }), 'us')).toBe(false)
    expect(holidayInRegion(item({ titles: { en: 'Christmas' } }), 'us')).toBe(true)
    expect(holidayInRegion(item({ titles: { en: 'Christmas' } }), 'in')).toBe(true)
    expect(holidayInRegion(item({ titles: { en: 'Veterans Day' } }), 'us')).toBe(true)
    expect(holidayInRegion(item({ titles: { en: 'Election Day' } }), 'in')).toBe(false)
    expect(holidayInRegion(item({ titles: { en: 'Republic Day' } }), 'in')).toBe(true)
    expect(holidayInRegion(item({ titles: { en: 'Holi' } }), 'us')).toBe(false)
    expect(holidayInRegion(item({ titles: { en: 'Independence Day' }, festival: 'in-independence' }), 'in')).toBe(true)
    expect(holidayInRegion(item({ titles: { en: 'Independence Day' }, festival: 'in-independence' }), 'us')).toBe(false)
    expect(holidayInRegion(item({ titles: { en: 'Independence Day' } }), 'us')).toBe(true)
  })
})

describe('community titles', () => {
  it('keeps known languages, tidied, and drops empty or unknown ones', () => {
    expect(cleanTitles({ en: '  Diwali  ', hi: '   ', xx: 'No', ta: 5 })).toEqual({ en: 'Diwali' })
    expect(cleanTitles(null)).toEqual({})
    expect(cleanTitles(['Diwali'])).toEqual({})
  })

  it('shows the person’s language, else English', () => {
    expect(communityTitle(item(), 'hi')).toBe('दिवाली')
    expect(communityTitle(item(), 'ta')).toBe('Diwali')
  })
})

describe('picking a community reminder', () => {
  it('makes a reminder for any time that day, with the alert and picture carried over', () => {
    expect(communityReminderInput(item(), 'hi')).toEqual({
      text: 'दिवाली',
      day: '2026-11-08',
      hour: null,
      minute: null,
      remindBefore: true,
      remindWeekBefore: false,
      kind: 'event',
      communityId: '0b6f6a3e-5a7d-4c1e-9f1a-2b3c4d5e6f70',
      communityPhotoPath: PHOTO,
    })
  })

  it('drops a picture path that is not one of ours', () => {
    expect(communityReminderInput(item({ photoPath: '../x.jpg' }), 'en').communityPhotoPath).toBeNull()
  })

  it('lists the ones already picked, once each', () => {
    expect(addedCommunityIds([{ communityId: 'a' }, { communityId: 'a' }, { communityId: null }, {}])).toEqual(['a'])
  })
})

describe('what people see', () => {
  it('hides a day that has passed, one switched off, and one without English, soonest first and by name on the same day', () => {
    const list = [
      item({ id: 'c', day: '2026-12-25', titles: { en: 'Christmas' } }),
      item({ id: 'past', day: '2026-10-20' }),
      item({ id: 'off', active: false }),
      item({ id: 'noEn', titles: { hi: 'दिवाली' } }),
      item({ id: 'b', day: '2026-11-08', titles: { en: 'Govardhan Puja' } }),
      item({ id: 'a', day: '2026-11-08', titles: { en: 'Diwali' } }),
      item({ id: 'today', day: '2026-10-24' }),
    ]
    expect(upcomingCommunity(list, '2026-10-24').map((row) => row.id)).toEqual(['today', 'a', 'b', 'c'])
  })

  it('keeps at most 10, soonest first', () => {
    const many = Array.from({ length: 12 }, (_, index) =>
      item({
        id: `day-${index}`,
        day: `2026-11-${String(index + 10).padStart(2, '0')}`,
        titles: { en: `Day ${index}` },
      }),
    )
    expect(communityToShow(many, '2026-10-14')).toHaveLength(10)
    expect(communityToShow(many, '2026-10-14')[0]?.titles.en).toBe('Vijayadashmi')
  })

  it('adds the 2026 festivals when the admin list does not already have them', () => {
    const shown = communityToShow([], '2026-10-14', 80)
    expect(shown.map((row) => `${row.day} ${row.titles.en}`)).toEqual([
      '2026-10-20 Vijayadashmi',
      '2026-10-31 Halloween',
      '2026-11-03 Election Day',
      '2026-11-08 Diwali',
      '2026-11-11 Veterans Day',
      '2026-11-24 Guru Nanak Jayanti',
      '2026-11-26 Thanksgiving',
      '2026-12-25 Christmas',
      "2027-01-01 New Year's Day",
      '2027-01-18 Martin Luther King Jr. Day',
      '2027-01-26 Republic Day',
      '2027-02-15 Presidents Day',
      '2027-03-10 Eid al-Fitr',
      '2027-03-23 Holi',
      '2027-03-26 Good Friday',
      '2027-04-15 Ram Navami',
      '2027-04-19 Mahavir Jayanti',
      '2027-05-17 Eid al-Adha',
      '2027-05-20 Buddha Purnima',
      '2027-05-31 Memorial Day',
      '2027-06-16 Muharram',
      '2027-06-19 Juneteenth',
      '2027-07-04 Independence Day',
      '2027-08-15 Independence Day',
      '2027-08-15 Milad-un-Nabi',
      '2027-08-25 Janmashtami',
      '2027-09-06 Labor Day',
      '2027-10-02 Gandhi Jayanti',
      '2027-10-09 Vijayadashmi',
      '2027-10-11 Columbus Day',
      '2027-10-29 Diwali',
      '2027-10-31 Halloween',
      '2027-11-02 Election Day',
      '2027-11-11 Veterans Day',
      '2027-11-14 Guru Nanak Jayanti',
      '2027-11-25 Thanksgiving',
      '2027-12-25 Christmas',
    ])
    expect(shown.find((row) => row.titles.en === 'Diwali')?.titles.hi).toBe('दिवाली')
    expect(shown.find((row) => row.day === '2027-08-15' && row.festival === 'in-independence')?.titles.hi).toBe('स्वतंत्रता दिवस')
    expect(shown.find((row) => row.day === '2027-07-04')?.festival).toBe('independence')
  })

  it('shows Vijayadashmi when the saved title is a lowercase spelling', () => {
    const shown = communityToShow(
      [item({ id: 'admin', day: '2026-10-20', titles: { en: 'vijayadashami' } })],
      '2026-10-14',
    )
    expect(shown.find((row) => row.id === 'admin')?.titles.en).toBe('Vijayadashmi')
  })

  it('does not repeat a festival the admin already listed', () => {
    const shown = communityToShow(
      [item({ id: 'admin-diwali', day: '2026-11-08', titles: { en: 'Diwali' } })],
      '2026-10-14',
      40,
    )
    expect(shown.filter((row) => row.titles.en === 'Diwali' && row.day.startsWith('2026'))).toHaveLength(1)
    expect(shown.find((row) => row.day === '2026-11-08')?.id).toBe('admin-diwali')
    expect(shown.find((row) => row.day === '2027-10-29')?.titles.en).toBe('Diwali')
    expect(shown.filter((row) => row.titles.en === 'Veterans Day')).toHaveLength(2)
  })
})

describe('the admin form', () => {
  it('needs an English title and a date', () => {
    expect(communityFormIssue({ titles: {}, day: '2026-11-08' })).toEqual({ field: 'title' })
    expect(communityFormIssue({ titles: { hi: 'दिवाली' }, day: '2026-11-08' })).toEqual({ field: 'title' })
    expect(communityFormIssue({ titles: { en: 'Diwali' }, day: '' })).toEqual({ field: 'day' })
    expect(communityFormIssue({ titles: { en: 'Diwali' }, day: '2026-11-08' })).toBeNull()
  })

  it('cuts a title that is too long to the reminder limit', () => {
    expect(cleanTitles({ en: 'x'.repeat(200) }).en).toHaveLength(120)
  })
})
