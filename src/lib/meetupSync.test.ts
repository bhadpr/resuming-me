import { describe, expect, it } from 'vitest'
import { planMeetupRefresh, type MeetupSource } from './meetupSync'
import type { Reminder } from './reminderSchedule'

function reminder(patch: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    text: 'Dinner',
    description: null,
    day: '2026-10-25',
    hour: 17,
    minute: 20,
    remindBefore: true,
    kind: 'event',
    everyYear: false,
    doneAt: null,
    sharedEventId: 'e1',
    alertOff: true,
    ...patch,
  }
}

function source(patch: Partial<MeetupSource> = {}): MeetupSource {
  return {
    id: 'e1',
    meetup: true,
    text: 'Dinner',
    description: 'Our place',
    day: '2026-10-25',
    hour: 17,
    minute: 20,
    timeZone: 'America/Los_Angeles',
    remindBefore: true,
    remindLeadMinutes: null,
    photoPath: null,
    kind: 'event',
    status: 'active',
    ...patch,
  }
}

describe('planMeetupRefresh', () => {
  it('moves the day and time, and keeps the evening-before alert with them', () => {
    const [update] = planMeetupRefresh(
      [reminder({ description: null, day: '2026-10-24', hour: 18, minute: 0 })],
      [source({ day: '2026-11-02', hour: 19, minute: 0, timeZone: 'America/Los_Angeles' })],
      'America/Los_Angeles',
    )
    expect(update).toMatchObject({
      reminderId: 'r1',
      day: '2026-11-02',
      hour: 19,
      minute: 0,
      remindBefore: true,
      description: 'Our place',
    })
    expect(update).not.toHaveProperty('alertOff')
    expect(update).not.toHaveProperty('doneAt')
  })

  it('converts kickoff into the phone zone', () => {
    const [update] = planMeetupRefresh(
      [reminder()],
      [source()],
      'America/New_York',
    )
    expect(update).toMatchObject({ day: '2026-10-25', hour: 20, minute: 20, remindBefore: true })
  })

  it('leaves a done reminder on the day that person finished', () => {
    const plan = planMeetupRefresh(
      [reminder({ doneAt: '2026-10-25T00:00:00.000Z', day: '2026-10-25' })],
      [source({ day: '2026-11-02', hour: 19, minute: 0 })],
      'America/Los_Angeles',
    )
    expect(plan).toEqual([])
  })

  it('leaves a regular shared reminder frozen', () => {
    const plan = planMeetupRefresh([reminder()], [source({ meetup: false })], 'America/Los_Angeles')
    expect(plan).toEqual([])
  })
})
