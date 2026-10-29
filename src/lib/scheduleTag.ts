import { cricketTeamForGame } from './cricketSearch'
import { leagueIdForGame, leagueTeamForGame } from './leagueTeams'
import { nflTeamForGame } from './nflSearch'

/** The row tag for a followed calendar: the league, or School when it is a school year. */
export function scheduleSourceKey(text: string): string {
  if (nflTeamForGame(text)) return 'reminders.sourceNfl'
  if (cricketTeamForGame(text)) return 'reminders.sourceCricket'
  const league = leagueIdForGame(text)
  if (league === 'nba') return 'reminders.sourceNba'
  if (league === 'nhl') return 'reminders.sourceNhl'
  if (league === 'mlb') return 'reminders.sourceMlb'
  if (league === 'mls') return 'reminders.sourceMls'
  return 'reminders.sourceSchool'
}

/** The detail heading for a followed calendar, plus the team when the line is a match. */
export function scheduleDetail(text: string): { titleKey: string; sport: boolean; team: string | null } {
  const sourceKey = scheduleSourceKey(text)
  const team =
    nflTeamForGame(text)?.name ?? cricketTeamForGame(text)?.name ?? leagueTeamForGame(text)?.name ?? null
  return {
    titleKey: sourceKey === 'reminders.sourceSchool' ? 'reminders.listLockedTitle' : sourceKey,
    sport: sourceKey !== 'reminders.sourceSchool',
    team,
  }
}
