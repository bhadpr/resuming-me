import { describe, expect, it } from 'vitest'
import { CRICKET_TEAMS, cricketSearchKey, cricketTeamByName, cricketTeamForGame, cricketTeamName } from './cricketSearch'

describe('cricket teams', () => {
  it('lists every team and keeps keys that the dropdown can store', () => {
    expect(CRICKET_TEAMS).toHaveLength(12)
    expect(cricketTeamName('IND')).toBe('India')
    expect(cricketTeamName('Bharat')).toBe('India')
    expect(cricketTeamName('Lions')).toBe('Sri Lanka')
    expect(cricketTeamByName('India')?.logo).toBe('/teams/cricket/india.png')
    expect(cricketTeamByName('Australia')?.logo).toBe('/teams/cricket/australia.png')
    expect(cricketSearchKey('Team India')).toBe('team india')
  })

  it('reads the followed team from the start of a game line', () => {
    expect(cricketTeamForGame('India vs Sri Lanka · ODI (1st of 3)')?.abbr).toBe('IND')
    expect(cricketTeamForGame('India at New Zealand · T20I (4th of 5)')?.abbr).toBe('IND')
    expect(cricketTeamForGame('Dinner with Sam')).toBeNull()
  })
})
