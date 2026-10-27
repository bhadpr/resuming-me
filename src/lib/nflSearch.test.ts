import { describe, expect, it } from 'vitest'
import { NFL_TEAMS, nflSearchKey, nflTeamByName, nflTeamForGame, nflTeamName } from './nflSearch'

describe('nfl search key', () => {
  it('matches a city, a team, or a short code', () => {
    expect(nflSearchKey(' Seattle ')).toBe('seattle')
    expect(nflSearchKey('SEA')).toBe('sea')
    expect(nflSearchKey('New York')).toBe('new york')
    expect(nflSearchKey('49ers')).toBe('49ers')
  })

  it('rejects a blank, a single letter, and punctuation', () => {
    expect(nflSearchKey('')).toBeNull()
    expect(nflSearchKey('a')).toBeNull()
    expect(nflSearchKey('sea!')).toBeNull()
  })

  it('turns a saved city or code into one team', () => {
    expect(NFL_TEAMS).toHaveLength(32)
    expect(nflTeamName('Seattle')).toBe('Seattle Seahawks')
    expect(nflTeamName('SEA')).toBe('Seattle Seahawks')
    expect(nflTeamName('Los Angeles')).toBeNull()
    expect(nflTeamName('New York')).toBeNull()
  })

  it('picks the followed team from a game line', () => {
    expect(nflTeamForGame('Seattle Seahawks vs Chicago Bears')?.abbr).toBe('SEA')
    expect(nflTeamForGame('Seattle Seahawks at Las Vegas Raiders')?.abbr).toBe('SEA')
    expect(nflTeamForGame('Los Angeles Chargers vs Denver Broncos')?.abbr).toBe('LAC')
    expect(nflTeamByName('Seattle Seahawks')?.abbr).toBe('SEA')
    expect(nflTeamForGame('Dinner with Sam')).toBeNull()
  })
})
