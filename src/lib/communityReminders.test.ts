import { describe, expect, it } from 'vitest'
import {
  addedCommunityIds,
  cleanTitles,
  communityFormIssue,
  communityReminderInput,
  communityTitle,
  communityToShow,
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
    const shown = communityToShow([], '2026-10-14')
    expect(shown.map((row) => row.titles.en)).toEqual([
      'Vijayadashmi',
      'Halloween',
      'Diwali',
      'Guru Nanak Jayanti',
      'Thanksgiving',
      'Christmas',
    ])
    expect(shown.find((row) => row.titles.en === 'Diwali')?.titles.hi).toBe('दिवाली')
    expect(shown.find((row) => row.titles.en === 'Guru Nanak Jayanti')?.day).toBe('2026-11-24')
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
    )
    expect(shown.map((row) => row.titles.en)).toEqual([
      'Vijayadashmi',
      'Halloween',
      'Diwali',
      'Guru Nanak Jayanti',
      'Thanksgiving',
      'Christmas',
    ])
    expect(shown.find((row) => row.titles.en === 'Diwali')?.id).toBe('admin-diwali')
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
