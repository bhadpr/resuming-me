import { describe, expect, it } from 'vitest'
import { planFollowedListRefresh, type FollowedCopy, type FollowedDay } from './followedLists'

const listId = 'list-issaquah'
const teacher: FollowedDay = {
  id: 'teacher-day',
  listId,
  text: 'Teacher work day · Teacher day - no school',
  day: '2027-01-22',
  hour: null,
  minute: null,
  remindBefore: true,
  photoPath: null,
}

function copy(patch: Partial<FollowedCopy> = {}): FollowedCopy {
  return {
    id: 'mine',
    text: teacher.text,
    day: '2027-01-25',
    hour: null,
    minute: null,
    doneAt: null,
    sharedListItemId: teacher.id,
    sharedListId: listId,
    ...patch,
  }
}

describe('planFollowedListRefresh', () => {
  it('moves a day the calendar changed', () => {
    const plan = planFollowedListRefresh([copy()], [teacher], new Set([listId]))
    expect(plan.removeIds).toEqual([])
    expect(plan.add).toEqual([])
    expect(plan.updates).toEqual([
      {
        reminderId: 'mine',
        text: teacher.text,
        day: '2027-01-22',
        hour: null,
        minute: null,
        sharedListId: listId,
        sharedListItemId: teacher.id,
      },
    ])
  })

  it('leaves a day that already matches', () => {
    const plan = planFollowedListRefresh([copy({ day: '2027-01-22' })], [teacher], new Set([listId]))
    expect(plan.updates).toEqual([])
    expect(plan.removeIds).toEqual([])
    expect(plan.add).toEqual([])
  })

  it('does not add a community day that has already passed', () => {
    const veterans: FollowedDay = { ...teacher, id: 'veterans', text: 'Veterans Day · No school', day: '2026-11-11' }
    const plan = planFollowedListRefresh([], [veterans], new Set([listId]), '2026-11-12')
    expect(plan.add).toEqual([])
  })

  it('drops a day the calendar removed and adds a new one', () => {
    const veterans: FollowedDay = { ...teacher, id: 'veterans', text: 'Veterans Day · No school', day: '2026-11-11' }
    const plan = planFollowedListRefresh([copy()], [veterans], new Set([listId]))
    expect(plan.removeIds).toEqual(['mine'])
    expect(plan.add.map((day) => day.id)).toEqual(['veterans'])
  })

  it('leaves a day the person edited, and a finished day', () => {
    const edited = copy({ sharedListItemId: null, sharedListId: null, text: 'My note' })
    const done = copy({ id: 'done', doneAt: '2026-10-01T00:00:00.000Z' })
    const plan = planFollowedListRefresh([edited, done], [teacher], new Set([listId]))
    expect(plan.updates).toEqual([])
    expect(plan.removeIds).toEqual([])
  })

  it('leaves a calendar this load could not read', () => {
    const plan = planFollowedListRefresh([copy()], [], new Set())
    expect(plan.removeIds).toEqual([])
    expect(plan.updates).toEqual([])
  })

  it('remembers the calendar on a copy that does not have it yet', () => {
    const plan = planFollowedListRefresh(
      [copy({ day: '2027-01-22', sharedListId: null })],
      [teacher],
      new Set([listId]),
    )
    expect(plan.updates.map((update) => update.sharedListId)).toEqual([listId])
  })
})
