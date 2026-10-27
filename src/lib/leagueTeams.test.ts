import { describe, expect, it } from 'vitest'
import { LEAGUE_TEAMS, leagueSearchKey, leagueTeamByName, leagueTeamForGame, leagueTeamName } from './leagueTeams'

describe('league teams', () => {
  it('keeps every league on its own dropdown', () => {
    expect(LEAGUE_TEAMS.nba).toHaveLength(30)
    expect(LEAGUE_TEAMS.nhl).toHaveLength(32)
    expect(LEAGUE_TEAMS.mlb).toHaveLength(30)
    expect(LEAGUE_TEAMS.mls).toHaveLength(30)
  })

  it('resolves a full name, and leaves a shared city alone', () => {
    expect(leagueTeamName('nba', 'Boston Celtics')).toBe('Boston Celtics')
    expect(leagueTeamName('nba', 'los angeles')).toBeNull()
    expect(leagueTeamName('mls', 'CF Montréal')).toBe('CF Montréal')
    expect(leagueSearchKey('CF Montréal')).toBe('cf montreal')
  })

  it('reads the followed team from a game line', () => {
    expect(leagueTeamForGame('Boston Celtics vs Brooklyn Nets')?.abbr).toBe('BOS')
    expect(leagueTeamForGame('Boston Celtics at Chicago Bulls · Regular season - NBA Cup group game')?.abbr).toBe('BOS')
    expect(leagueTeamByName('Seattle Sounders FC')?.abbr).toBe('SEA')
    expect(leagueTeamForGame('Dinner with Sam')).toBeNull()
  })
})
