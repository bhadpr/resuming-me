import { LEAGUE_TEAMS, type LeagueId, type LeagueTeam } from './leagueTeamsData'

export type { LeagueId, LeagueTeam }
export { LEAGUE_TEAMS }

const STORAGE: Record<LeagueId, string> = {
  nba: 'resuming-nba-search',
  nhl: 'resuming-nhl-search',
  mlb: 'resuming-mlb-search',
  mls: 'resuming-mls-search',
}

/** Fold accents so "CF Montréal" matches the stored key "cf montreal". */
export function foldLeagueKey(raw: string): string {
  return raw
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

/** A city, team, or short code, ready to match the stored keys. */
export function leagueSearchKey(raw: string): string | null {
  const key = foldLeagueKey(raw)
  if (key.length < 2 || key.length > 40) return null
  if (!/^[a-z0-9.]+( [a-z0-9.]+)*$/.test(key)) return null
  return key
}

export function leagueTeams(league: LeagueId): readonly LeagueTeam[] {
  return LEAGUE_TEAMS[league]
}

/** The team whose name is this list title. */
export function leagueTeamByName(name: string): LeagueTeam | null {
  for (const teams of Object.values(LEAGUE_TEAMS)) {
    const team = teams.find((item) => item.name === name)
    if (team) return team
  }
  return null
}

/** The followed team on a game line. "Boston Celtics vs Brooklyn Nets" is Boston. */
export function leagueTeamForGame(text: string): LeagueTeam | null {
  const value = foldLeagueKey(text)
  const hits: LeagueTeam[] = []
  for (const teams of Object.values(LEAGUE_TEAMS)) {
    for (const team of teams) {
      const name = foldLeagueKey(team.name)
      if (value === name || value.startsWith(`${name} `)) hits.push(team)
    }
  }
  if (hits.length === 0) return null
  hits.sort((a, b) => b.name.length - a.name.length)
  return hits[0].name.length === hits[1]?.name.length ? null : hits[0]
}

/** One team when a saved city, name, or short code belongs to exactly one team in this league. */
export function leagueTeamName(league: LeagueId, raw: string | null): string | null {
  if (!raw) return null
  const key = leagueSearchKey(raw)
  if (!key) return null
  const hits = LEAGUE_TEAMS[league].filter((team) => foldLeagueKey(team.name) === key || team.keys.includes(key))
  return hits.length === 1 ? hits[0].name : null
}

export function readLeagueSearch(league: LeagueId): string | null {
  try {
    const value = localStorage.getItem(STORAGE[league]) ?? ''
    return leagueSearchKey(value) ? value.trim().replace(/\s+/g, ' ') : null
  } catch {
    return null
  }
}

export function writeLeagueSearch(league: LeagueId, value: string): void {
  try {
    const next = value.trim().replace(/\s+/g, ' ')
    if (leagueSearchKey(next)) localStorage.setItem(STORAGE[league], next)
    else localStorage.removeItem(STORAGE[league])
  } catch {
    // Private browsing can refuse storage. The dropdown still works for this visit.
  }
}
