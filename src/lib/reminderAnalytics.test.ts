import { describe, expect, it } from 'vitest'
import { summarizeReminderEvents } from './reminderAnalytics'

describe('summarizeReminderEvents', () => {
  it('counts adds, dones, and choices without any reminder text', () => {
    const summary = summarizeReminderEvents([
      {
        name: 'reminder_added',
        props: { has_time: true, day_before: true, kind: 'doctor', every_year: false, signed_in: true },
        anon_id: 'a1',
        user_id: 'u1',
      },
      {
        name: 'reminder_added',
        props: { has_time: false, kind: 'event', every_year: true, signed_in: false },
        anon_id: 'a2',
        user_id: null,
      },
      { name: 'reminder_added', props: { has_time: false }, anon_id: 'a2', user_id: null },
      { name: 'reminder_done', props: { signed_in: true, from: 'notification' }, anon_id: 'a1', user_id: 'u1' },
      { name: 'reminder_done', props: null, anon_id: 'a3', user_id: null },
    ])
    expect(summary).toEqual({
      added: 3,
      done: 2,
      people: 3,
      withTime: 1,
      dayBefore: 1,
      everyYear: 1,
      signedIn: 1,
      doneFromNotification: 1,
      kinds: [
        { kind: 'doctor', count: 1 },
        { kind: 'event', count: 1 },
        { kind: 'other', count: 1 },
      ],
    })
  })
})
