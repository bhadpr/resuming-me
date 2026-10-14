import { describe, expect, it } from 'vitest'
import { communityPhotoUrl, eventPhotoUrl, isEventPhotoPath, isReminderPhotoData, reminderPhotoSrc } from './eventPhotoUrl'

const PATH = '0b6f6a3e-5a7d-4c1e-9f1a-2b3c4d5e6f70/1f2e3d4c-5b6a-4789-8abc-def012345678.jpg'

describe('event photos', () => {
  it('accepts only <event id>/<name>.jpg', () => {
    expect(isEventPhotoPath(PATH)).toBe(true)
    expect(isEventPhotoPath('../secret.jpg')).toBe(false)
    expect(isEventPhotoPath(`${PATH}?x=1`)).toBe(false)
    expect(isEventPhotoPath('0b6f6a3e-5a7d-4c1e-9f1a-2b3c4d5e6f70/photo.png')).toBe(false)
    expect(isEventPhotoPath(null)).toBe(false)
  })

  it('builds the public storage address', () => {
    expect(eventPhotoUrl(PATH, 'https://abc.supabase.co/')).toBe(
      `https://abc.supabase.co/storage/v1/object/public/event-photos/${PATH}`,
    )
    expect(eventPhotoUrl('nope', 'https://abc.supabase.co')).toBeNull()
    expect(eventPhotoUrl(PATH, '')).toBeNull()
  })
})

describe('community photos', () => {
  it('builds the public address in its own bucket', () => {
    expect(communityPhotoUrl(PATH, 'https://abc.supabase.co/')).toBe(
      `https://abc.supabase.co/storage/v1/object/public/community-photos/${PATH}`,
    )
    expect(communityPhotoUrl('nope', 'https://abc.supabase.co')).toBeNull()
    expect(communityPhotoUrl(null, 'https://abc.supabase.co')).toBeNull()
  })
})

describe('reminder photos', () => {
  const DATA = 'data:image/jpeg;base64,/9j/4AAQ'

  it('accepts only a small JPEG data address', () => {
    expect(isReminderPhotoData(DATA)).toBe(true)
    expect(isReminderPhotoData('data:image/png;base64,iVBOR')).toBe(false)
    expect(isReminderPhotoData('https://example.com/a.jpg')).toBe(false)
    expect(isReminderPhotoData(`data:image/jpeg;base64,${'A'.repeat(500_000)}`)).toBe(false)
    expect(isReminderPhotoData(undefined)).toBe(false)
  })

  it('prefers the reminder photo on this device, then the stored one, then the shared event photo', () => {
    expect(reminderPhotoSrc({ photoData: DATA, photoUrl: 'https://x/signed', sharedPhotoPath: PATH })).toBe(DATA)
    expect(reminderPhotoSrc({ photoUrl: 'https://x/signed', sharedPhotoPath: PATH })).toBe('https://x/signed')
    expect(reminderPhotoSrc({ sharedPhotoPath: PATH })).toContain(`/event-photos/${PATH}`)
    expect(reminderPhotoSrc({ sharedPhotoPath: PATH, communityPhotoPath: PATH })).toContain(`/event-photos/${PATH}`)
    expect(reminderPhotoSrc({ communityPhotoPath: PATH })).toContain(`/community-photos/${PATH}`)
    expect(reminderPhotoSrc({})).toBeNull()
  })
})
