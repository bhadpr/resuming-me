import { describe, expect, it } from 'vitest'
import type { Activity } from './activities'
import { pickMoment } from './moments'

function activity(): Activity {
  return {
    id: 'a1',
    user_id: 'u1',
    name: 'Reading',
    emoji: '📖',
    type: 'daily',
    tracking_mode: 'checkbox',
    target_value: null,
    target_unit: null,
    target_effective_from: '2026-09-01',
    weekly_target: null,
    deadline: null,
    why_matters: null,
    usually_when: null,
    micro_steps: [],
    archived: false,
    created_at: '2026-09-01T00:00:00Z',
    updated_at: '2026-09-01T00:00:00Z',
  }
}

describe('fresh-start moments', () => {
  it('shows one Monday banner and then stays quiet', () => {
    const first = pickMoment({
      today: '2026-09-21',
      birthday: null,
      seen: [],
      activities: [activity()],
      entries: [],
    })
    expect(first?.kind).toBe('monday')
    expect(first?.line).toContain('New week')
    expect(
      pickMoment({
        today: '2026-09-21',
        birthday: null,
        seen: [first!.id],
        activities: [activity()],
        entries: [],
      }),
    ).toBeNull()
  })

  it('prefers a birthday over Monday and skips it when none is saved', () => {
    const moment = pickMoment({
      today: '2026-09-21',
      birthday: '1990-09-21',
      seen: [],
      activities: [activity()],
      entries: [],
    })
    expect(moment?.kind).toBe('birthday')
    expect(
      pickMoment({
        today: '2026-09-23',
        birthday: null,
        seen: [],
        activities: [activity()],
        entries: [],
      }),
    ).toBeNull()
  })

  it('lets welcome-back win', () => {
    expect(
      pickMoment({
        today: '2026-09-21',
        birthday: '1990-09-21',
        seen: [],
        activities: [activity()],
        entries: [],
        welcomeBackVisible: true,
      }),
    ).toBeNull()
  })
})
