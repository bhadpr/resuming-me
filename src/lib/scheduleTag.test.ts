import { describe, expect, it } from 'vitest'
import { scheduleDetail, scheduleSourceKey } from './scheduleTag'

describe('scheduleSourceKey', () => {
  it('names the league on a game, and school on a school day', () => {
    expect(scheduleSourceKey('India vs Australia · Test (1st of 5)')).toBe('reminders.sourceCricket')
    expect(scheduleSourceKey('Seattle Seahawks vs Chicago Bears')).toBe('reminders.sourceNfl')
    expect(scheduleSourceKey('Boston Celtics vs Brooklyn Nets')).toBe('reminders.sourceNba')
    expect(scheduleSourceKey('Teacher work day · No school')).toBe('reminders.sourceSchool')
  })

  it('titles a match by its league and keeps a school day on the school calendar', () => {
    expect(scheduleDetail('India vs Australia · Test (1st of 5)')).toEqual({
      titleKey: 'reminders.sourceCricket',
      sport: true,
      team: 'India',
    })
    expect(scheduleDetail('Teacher work day · No school')).toEqual({
      titleKey: 'reminders.listLockedTitle',
      sport: false,
      team: null,
    })
  })
})