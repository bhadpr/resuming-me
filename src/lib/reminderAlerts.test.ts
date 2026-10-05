import { describe, expect, it } from 'vitest'
import { digestNotificationIds } from './dailyDigest'
import { medicineNotificationIds, medicineSnoozeIds } from './medicineSchedule'
import {
  REMINDER_NOTIFICATION_ID_BASE,
  REMINDER_NOTIFICATION_SLOTS,
  planReminderAlerts,
  reminderNotificationIds,
  untimedReminderNames,
  type ReminderAlertCopy,
} from './reminderAlerts'
import type { Reminder } from './reminderSchedule'

function reminder(id: string, day: string, extra: Partial<Reminder> = {}): Reminder {
  return {
    id,
    text: id,
    day,
    hour: null,
    minute: null,
    remindBefore: false,
    kind: 'other',
    everyYear: false,
    doneAt: null,
    ...extra,
  }
}

const copy: ReminderAlertCopy = {
  now: 'Now',
  dayBefore: (item) => (item.hour == null ? 'Tomorrow' : `Tomorrow ${item.hour}`),
}
const evening = { hour: 18, minute: 0 }
const now = new Date(2026, 9, 6, 10, 0)

describe('planReminderAlerts', () => {
  it('alerts at the time for timed reminders still ahead, soonest first', () => {
    const alerts = planReminderAlerts(
      [
        reminder('later', '2026-10-08', { hour: 9, minute: 15 }),
        reminder('soon', '2026-10-06', { hour: 11, minute: 30 }),
        reminder('past', '2026-10-06', { hour: 9, minute: 0 }),
        reminder('any', '2026-10-06'),
        reminder('done', '2026-10-06', { hour: 12, minute: 0, doneAt: now.toISOString() }),
      ],
      [],
      now,
      evening,
      copy,
    )
    expect(alerts.map((alert) => [alert.reminderId, alert.kind])).toEqual([
      ['soon', 'time'],
      ['later', 'time'],
    ])
    expect(alerts[0]).toMatchObject({
      id: REMINDER_NOTIFICATION_ID_BASE,
      title: 'soon',
      body: 'Now',
      at: new Date(2026, 9, 6, 11, 30),
    })
    expect(alerts[1].id).toBe(REMINDER_NOTIFICATION_ID_BASE + 1)
  })

  it('adds an evening alert the day before when asked', () => {
    const alerts = planReminderAlerts(
      [
        reminder('doctor', '2026-10-08', { hour: 11, minute: 0, remindBefore: true }),
        reminder('wedding', '2026-10-10', { remindBefore: true }),
        reminder('tomorrow', '2026-10-07', { remindBefore: true }),
        reminder('today', '2026-10-06', { remindBefore: true }),
      ],
      [],
      now,
      evening,
      copy,
    )
    const before = alerts.filter((alert) => alert.kind === 'before')
    expect(before.map((alert) => [alert.reminderId, alert.at, alert.body])).toEqual([
      ['tomorrow', new Date(2026, 9, 6, 18, 0), 'Tomorrow'],
      ['doctor', new Date(2026, 9, 7, 18, 0), 'Tomorrow 11'],
      ['wedding', new Date(2026, 9, 9, 18, 0), 'Tomorrow'],
    ])
  })

  it('skips a day-before alert whose evening has passed', () => {
    const late = new Date(2026, 9, 6, 19, 0)
    const alerts = planReminderAlerts(
      [reminder('tomorrow', '2026-10-07', { hour: 9, minute: 0, remindBefore: true })],
      [],
      late,
      evening,
      copy,
    )
    expect(alerts.map((alert) => alert.kind)).toEqual(['time'])
  })

  it('brings a snoozed reminder back, only while it is open', () => {
    const until = new Date(2026, 9, 6, 11, 0)
    const alerts = planReminderAlerts(
      [
        reminder('post', '2026-10-06', { hour: 9, minute: 0 }),
        reminder('closed', '2026-10-06', { hour: 9, minute: 0, doneAt: now.toISOString() }),
      ],
      [
        { reminderId: 'post', until },
        { reminderId: 'closed', until },
        { reminderId: 'gone', until },
        { reminderId: 'post', until: new Date(2026, 9, 6, 9, 30) },
      ],
      now,
      evening,
      copy,
    )
    expect(alerts.map((alert) => [alert.reminderId, alert.kind, alert.at])).toEqual([['post', 'snooze', until]])
  })

  it('arms only the soonest alerts when there are many', () => {
    const many = Array.from({ length: REMINDER_NOTIFICATION_SLOTS + 10 }, (_, index) =>
      reminder(`r${index}`, '2026-10-20', { hour: Math.floor(index / 60), minute: index % 60 }),
    )
    const alerts = planReminderAlerts(many, [], now, evening, copy)
    expect(alerts).toHaveLength(REMINDER_NOTIFICATION_SLOTS)
    expect(alerts[0].reminderId).toBe('r0')
    expect(alerts.at(-1)?.reminderId).toBe(`r${REMINDER_NOTIFICATION_SLOTS - 1}`)
  })
})

describe('untimedReminderNames', () => {
  it('names open reminders on Today that have no time', () => {
    const names = untimedReminderNames(
      [
        reminder('Post office', '2026-10-06'),
        reminder('From before', '2026-10-04'),
        reminder('Doctor', '2026-10-06', { hour: 11, minute: 0 }),
        reminder('Tomorrow', '2026-10-07'),
        reminder('Done', '2026-10-06', { doneAt: now.toISOString() }),
      ],
      '2026-10-06',
    )
    expect(names).toEqual(['From before', 'Post office'])
  })
})

describe('reminder notification ids', () => {
  it('do not overlap medicines or the daily notification', () => {
    const others = new Set([...digestNotificationIds(), 7198, 7199, ...medicineNotificationIds(), ...medicineSnoozeIds()])
    expect(reminderNotificationIds().some((id) => others.has(id))).toBe(false)
  })
})
