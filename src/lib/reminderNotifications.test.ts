import { describe, expect, it } from 'vitest'
import { reminderNotificationActionTypes } from './reminderNotifications'

const labels = { done: 'Done', tomorrow: 'Tomorrow', later: 'Later' }

describe('reminderNotificationActionTypes', () => {
  it('opens the iPhone app from Done, Tomorrow, and Later', () => {
    const types = reminderNotificationActionTypes(labels, true)
    expect(types[0]?.actions.map((action) => action.id)).toEqual([
      'reminder-done',
      'reminder-tomorrow',
      'reminder-later',
    ])
    expect(types[0]?.actions.every((action) => action.foreground)).toBe(true)
    expect(types[1]?.actions.map((action) => action.id)).toEqual(['reminder-done', 'reminder-later'])
    expect(types[1]?.actions.every((action) => action.foreground)).toBe(true)
  })

  it('leaves Android alert buttons in place', () => {
    const types = reminderNotificationActionTypes(labels, false)
    expect(types.flatMap((type) => type.actions).every((action) => action.foreground)).toBe(false)
  })
})
