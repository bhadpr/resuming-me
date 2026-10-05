import { describe, expect, it } from 'vitest'
import { digestNotificationIds } from './dailyDigest'
import { todayLocalDate } from './dates'
import {
  applyMedicineSnoozes,
  dosesOnDate,
  medicineNotificationIds,
  medicineSnoozeIds,
  normalizeTimes,
  planMedicineAlarms,
  validateMedicineInput,
  type MedicineSchedule,
} from './medicineSchedule'

function dateForWeekday(weekday: number): string {
  return todayLocalDate(new Date(2024, 0, 7 + weekday))
}

const bottle: MedicineSchedule = {
  id: 'med-1',
  name: 'Morning tablet',
  photoUrl: null,
  weekdays: [1, 3, 5],
  times: [
    { hour: 20, minute: 0 },
    { hour: 8, minute: 0 },
    { hour: 8, minute: 0 },
  ],
}

describe('medicine schedule', () => {
  it('lists today’s doses on the chosen days and keeps a missed one', () => {
    const monday = dateForWeekday(1)
    const doses = dosesOnDate([bottle], monday, [])
    expect(doses.map((dose) => dose.hour)).toEqual([8, 20])
    expect(doses.every((dose) => !dose.taken)).toBe(true)
    expect(dosesOnDate([bottle], dateForWeekday(2), [])).toEqual([])
  })

  it('marks a taken slot and leaves the other', () => {
    const monday = dateForWeekday(1)
    const doses = dosesOnDate([bottle], monday, [
      { medicineId: 'med-1', date: monday, hour: 8, minute: 0 },
    ])
    expect(doses.find((dose) => dose.hour === 8)?.taken).toBe(true)
    expect(doses.find((dose) => dose.hour === 20)?.taken).toBe(false)
  })

  it('plans future alarms and skips a taken slot', () => {
    const now = new Date(2024, 0, 8, 7, 30, 0)
    const monday = todayLocalDate(now)
    const alarms = planMedicineAlarms(
      [bottle],
      [{ medicineId: 'med-1', date: monday, hour: 8, minute: 0 }],
      now,
    )
    expect(alarms.map((alarm) => alarm.at.getHours())).toEqual([20])
    expect(alarms[0]?.id).toBe(8000)
    expect(alarms[0]?.title).toBe('Morning tablet')
  })

  it('leaves a passed dose off the alarm list', () => {
    const now = new Date(2024, 0, 8, 9, 0, 0)
    const alarms = planMedicineAlarms([bottle], [], now)
    expect(alarms.map((alarm) => alarm.at.getHours())).toEqual([20])
    expect(dosesOnDate([bottle], todayLocalDate(now), []).map((dose) => dose.hour)).toEqual([8, 20])
  })

  it('uses ids the daily digest does not cancel', () => {
    const digestMax = Math.max(...digestNotificationIds())
    const medicineMin = Math.min(...medicineNotificationIds())
    expect(digestMax).toBeLessThan(medicineMin)
    expect(medicineMin).toBe(8000)
    expect(Math.max(...medicineNotificationIds())).toBeLessThan(Math.min(...medicineSnoozeIds()))
  })

  it('snoozes a passed dose for 30 minutes and leaves its clock alone', () => {
    const now = new Date(2024, 0, 8, 9, 0, 0)
    const monday = todayLocalDate(now)
    const alarms = planMedicineAlarms([bottle], [], now)
    const snoozed = applyMedicineSnoozes(alarms, [
      {
        medicineId: 'med-1',
        date: monday,
        hour: 8,
        minute: 0,
        until: new Date(now.getTime() + 30 * 60 * 1000),
        title: 'Morning tablet',
        body: 'Time to take this.',
      },
    ])
    expect(alarms.map((alarm) => alarm.hour)).toEqual([20])
    expect(snoozed.map((alarm) => alarm.hour)).toEqual([20, 8])
    expect(snoozed[1]).toMatchObject({ id: 8200, hour: 8, minute: 0 })
    expect(snoozed[1]?.at.getHours()).toBe(9)
    expect(snoozed[1]?.at.getMinutes()).toBe(30)
    expect(
      applyMedicineSnoozes(alarms, [
        {
          medicineId: 'med-1',
          date: monday,
          hour: 20,
          minute: 0,
          until: new Date(now.getTime() + 30 * 60 * 1000),
          title: 'Morning tablet',
          body: 'Time to take this.',
        },
      ]),
    ).toHaveLength(1)
  })

  it('asks for a name, a day, and at most four times', () => {
    expect(validateMedicineInput({ name: '  ', weekdays: [1], times: [{ hour: 8, minute: 0 }] })).toBe(
      'name',
    )
    expect(validateMedicineInput({ name: 'Tablet', weekdays: [], times: [{ hour: 8, minute: 0 }] })).toBe(
      'days',
    )
    expect(validateMedicineInput({ name: 'Tablet', weekdays: [1], times: [] })).toBe('times')
    expect(
      normalizeTimes([
        { hour: 12, minute: 0 },
        { hour: 8, minute: 0 },
        { hour: 9, minute: 0 },
        { hour: 10, minute: 0 },
        { hour: 11, minute: 0 },
      ]),
    ).toEqual([
      { hour: 8, minute: 0 },
      { hour: 9, minute: 0 },
      { hour: 10, minute: 0 },
      { hour: 12, minute: 0 },
    ])
  })

  it('keeps before, after, or with food on a time', () => {
    expect(
      normalizeTimes([
        { hour: 8, minute: 0, meal: 'before' },
        { hour: 20, minute: 0, meal: 'after' },
        { hour: 13, minute: 0, meal: 'with' },
      ]),
    ).toEqual([
      { hour: 8, minute: 0, meal: 'before' },
      { hour: 13, minute: 0, meal: 'with' },
      { hour: 20, minute: 0, meal: 'after' },
    ])
  })
})
