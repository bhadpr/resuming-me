const NFL_SEARCH_KEY = 'resuming-nfl-search'

/** A team mark: the short city name on the team's colors. */
export type NflTeam = {
  name: string
  keys: readonly string[]
  abbr: string
  color: string
  accent: string
  ink: string
}

/** The 32 teams. Keys match the stored search list, including a city or a short code. */
const NFL_ROSTER: readonly NflTeam[] = [
  { name: 'Arizona Cardinals', keys: ['arizona', 'phoenix', 'glendale', 'cardinals', 'arizona cardinals', 'ari'], abbr: 'ARI', color: '#97233F', accent: '#FFB612', ink: '#fff' },
  { name: 'Atlanta Falcons', keys: ['atlanta', 'falcons', 'atlanta falcons', 'atl'], abbr: 'ATL', color: '#A71930', accent: '#000000', ink: '#fff' },
  { name: 'Baltimore Ravens', keys: ['baltimore', 'ravens', 'baltimore ravens', 'bal'], abbr: 'BAL', color: '#241773', accent: '#9E7C0C', ink: '#fff' },
  { name: 'Buffalo Bills', keys: ['buffalo', 'bills', 'buffalo bills', 'buf'], abbr: 'BUF', color: '#00338D', accent: '#C60C30', ink: '#fff' },
  { name: 'Carolina Panthers', keys: ['carolina', 'charlotte', 'panthers', 'carolina panthers', 'car'], abbr: 'CAR', color: '#0085CA', accent: '#101820', ink: '#fff' },
  { name: 'Chicago Bears', keys: ['chicago', 'bears', 'chicago bears', 'chi'], abbr: 'CHI', color: '#0B162A', accent: '#C83803', ink: '#fff' },
  { name: 'Cincinnati Bengals', keys: ['cincinnati', 'bengals', 'cincinnati bengals', 'cin'], abbr: 'CIN', color: '#FB4F14', accent: '#000000', ink: '#fff' },
  { name: 'Cleveland Browns', keys: ['cleveland', 'browns', 'cleveland browns', 'cle'], abbr: 'CLE', color: '#311D00', accent: '#FF3C00', ink: '#fff' },
  { name: 'Dallas Cowboys', keys: ['dallas', 'arlington', 'cowboys', 'dallas cowboys', 'dal'], abbr: 'DAL', color: '#003594', accent: '#869397', ink: '#fff' },
  { name: 'Denver Broncos', keys: ['denver', 'broncos', 'denver broncos', 'den'], abbr: 'DEN', color: '#FB4F14', accent: '#002244', ink: '#fff' },
  { name: 'Detroit Lions', keys: ['detroit', 'lions', 'detroit lions', 'det'], abbr: 'DET', color: '#0076B6', accent: '#B0B7BC', ink: '#fff' },
  { name: 'Green Bay Packers', keys: ['green bay', 'packers', 'green bay packers', 'gb'], abbr: 'GB', color: '#203731', accent: '#FFB612', ink: '#fff' },
  { name: 'Houston Texans', keys: ['houston', 'texans', 'houston texans', 'hou'], abbr: 'HOU', color: '#03202F', accent: '#A71930', ink: '#fff' },
  { name: 'Indianapolis Colts', keys: ['indianapolis', 'colts', 'indianapolis colts', 'ind'], abbr: 'IND', color: '#002C5F', accent: '#A2AAAD', ink: '#fff' },
  { name: 'Jacksonville Jaguars', keys: ['jacksonville', 'jaguars', 'jacksonville jaguars', 'jax'], abbr: 'JAX', color: '#006778', accent: '#D7A22A', ink: '#fff' },
  { name: 'Kansas City Chiefs', keys: ['kansas city', 'chiefs', 'kansas city chiefs', 'kc'], abbr: 'KC', color: '#E31837', accent: '#FFB81C', ink: '#fff' },
  { name: 'Las Vegas Raiders', keys: ['las vegas', 'raiders', 'las vegas raiders', 'lv'], abbr: 'LV', color: '#000000', accent: '#A5ACAF', ink: '#fff' },
  { name: 'Los Angeles Chargers', keys: ['chargers', 'los angeles chargers', 'lac'], abbr: 'LAC', color: '#0080C6', accent: '#FFC20E', ink: '#fff' },
  { name: 'Los Angeles Rams', keys: ['rams', 'los angeles rams', 'lar'], abbr: 'LAR', color: '#003594', accent: '#FFA300', ink: '#fff' },
  { name: 'Miami Dolphins', keys: ['miami', 'dolphins', 'miami dolphins', 'mia'], abbr: 'MIA', color: '#008E97', accent: '#FC4C02', ink: '#fff' },
  { name: 'Minnesota Vikings', keys: ['minnesota', 'minneapolis', 'vikings', 'minnesota vikings', 'min'], abbr: 'MIN', color: '#4F2683', accent: '#FFC62F', ink: '#fff' },
  { name: 'New England Patriots', keys: ['new england', 'boston', 'foxborough', 'patriots', 'new england patriots', 'ne'], abbr: 'NE', color: '#002244', accent: '#C60C30', ink: '#fff' },
  { name: 'New Orleans Saints', keys: ['new orleans', 'saints', 'new orleans saints', 'no'], abbr: 'NO', color: '#D3BC8D', accent: '#101820', ink: '#101820' },
  { name: 'New York Giants', keys: ['giants', 'new york giants', 'nyg'], abbr: 'NYG', color: '#0B2265', accent: '#A71930', ink: '#fff' },
  { name: 'New York Jets', keys: ['jets', 'new york jets', 'nyj'], abbr: 'NYJ', color: '#125740', accent: '#FFFFFF', ink: '#fff' },
  { name: 'Philadelphia Eagles', keys: ['philadelphia', 'eagles', 'philadelphia eagles', 'phi'], abbr: 'PHI', color: '#004C54', accent: '#A5ACAF', ink: '#fff' },
  { name: 'Pittsburgh Steelers', keys: ['pittsburgh', 'steelers', 'pittsburgh steelers', 'pit'], abbr: 'PIT', color: '#FFB612', accent: '#101820', ink: '#101820' },
  { name: 'San Francisco 49ers', keys: ['san francisco', 'santa clara', 'bay area', '49ers', 'san francisco 49ers', 'sf'], abbr: 'SF', color: '#AA0000', accent: '#B3995D', ink: '#fff' },
  { name: 'Seattle Seahawks', keys: ['seattle', 'seahawks', 'seattle seahawks', 'sea'], abbr: 'SEA', color: '#002244', accent: '#69BE28', ink: '#fff' },
  { name: 'Tampa Bay Buccaneers', keys: ['tampa bay', 'tampa', 'buccaneers', 'tampa bay buccaneers', 'tb'], abbr: 'TB', color: '#D50A0A', accent: '#FF7900', ink: '#fff' },
  { name: 'Tennessee Titans', keys: ['tennessee', 'nashville', 'titans', 'tennessee titans', 'ten'], abbr: 'TEN', color: '#0C2340', accent: '#4B92DB', ink: '#fff' },
  { name: 'Washington Commanders', keys: ['washington', 'dc', 'commanders', 'washington commanders', 'was'], abbr: 'WAS', color: '#5A1414', accent: '#FFB612', ink: '#fff' },
]

export const NFL_TEAMS: readonly NflTeam[] = NFL_ROSTER

/** The team whose name is this list title, such as Seattle Seahawks. */
export function nflTeamByName(name: string): NflTeam | null {
  return NFL_TEAMS.find((team) => team.name === name) ?? null
}

/** The followed team on a game line. "Seattle Seahawks vs Chicago Bears" is Seattle. */
export function nflTeamForGame(text: string): NflTeam | null {
  const value = text.trim().toLowerCase()
  const hits = NFL_TEAMS.filter(
    (team) => value === team.name.toLowerCase() || value.startsWith(`${team.name.toLowerCase()} `),
  )
  return hits.length === 1 ? hits[0] : null
}

/** One team when a saved city, name, or short code belongs to exactly one team. */
export function nflTeamName(raw: string | null): string | null {
  if (!raw) return null
  const key = nflSearchKey(raw)
  if (!key) return null
  const hits = NFL_TEAMS.filter((team) => team.name.toLowerCase() === key || team.keys.includes(key))
  return hits.length === 1 ? hits[0].name : null
}

/** A city, team, or short code, ready to match the stored keys. */
export function nflSearchKey(raw: string): string | null {
  const key = raw.trim().replace(/\s+/g, ' ').toLowerCase()
  if (key.length < 2 || key.length > 40) return null
  if (!/^[a-z0-9]+( [a-z0-9]+)*$/.test(key)) return null
  return key
}

export function readNflSearch(): string | null {
  try {
    const value = localStorage.getItem(NFL_SEARCH_KEY) ?? ''
    return nflSearchKey(value) ? value.trim().replace(/\s+/g, ' ') : null
  } catch {
    return null
  }
}

export function writeNflSearch(value: string): void {
  try {
    const shown = value.trim().replace(/\s+/g, ' ')
    if (!nflSearchKey(shown)) localStorage.removeItem(NFL_SEARCH_KEY)
    else localStorage.setItem(NFL_SEARCH_KEY, shown)
  } catch {
    /* the search still works for this visit */
  }
}
