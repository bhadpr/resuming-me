const CRICKET_SEARCH_KEY = 'resuming-cricket-search'

/** A team mark: the logo, plus colors if the picture is missing. */
export type CricketTeam = {
  name: string
  keys: readonly string[]
  abbr: string
  color: string
  accent: string
  ink: string
  logo: string
}

/** Teams with a schedule. Keys match the stored search list. */
export const CRICKET_TEAMS: readonly CricketTeam[] = [
  { name: 'Afghanistan', keys: ['afghanistan', 'afg', 'afghan atalan', 'afghanistan cricket team'], abbr: 'AFG', color: '#000', accent: '#D32011', ink: '#fff', logo: '/teams/cricket/afghanistan.png' },
  { name: 'Australia', keys: ['australia', 'aus', 'aussies', 'baggy greens', 'australian cricket team'], abbr: 'AUS', color: '#012169', accent: '#E4002B', ink: '#fff', logo: '/teams/cricket/australia.png' },
  { name: 'Bangladesh', keys: ['bangladesh', 'ban', 'tigers', 'bangla tigers', 'bangladesh cricket team'], abbr: 'BAN', color: '#006A4E', accent: '#F42A41', ink: '#fff', logo: '/teams/cricket/bangladesh.png' },
  { name: 'England', keys: ['england', 'eng', 'three lions', 'england cricket team'], abbr: 'ENG', color: '#012169', accent: '#CF081F', ink: '#fff', logo: '/teams/cricket/england.png' },
  { name: 'India', keys: ['india', 'team india', 'ind', 'men in blue', 'indian cricket team', 'bharat'], abbr: 'IND', color: '#0033A0', accent: '#FF9933', ink: '#fff', logo: '/teams/cricket/india.png' },
  { name: 'Ireland', keys: ['ireland', 'ire', 'irish cricket team', 'cricket ireland'], abbr: 'IRE', color: '#169B62', accent: '#FF883E', ink: '#fff', logo: '/teams/cricket/ireland.png' },
  { name: 'New Zealand', keys: ['new zealand', 'nz', 'blackcaps', 'black caps', 'kiwis'], abbr: 'NZ', color: '#012169', accent: '#CC0000', ink: '#fff', logo: '/teams/cricket/new-zealand.png' },
  { name: 'Pakistan', keys: ['pakistan', 'pak', 'men in green', 'green shirts', 'shaheens'], abbr: 'PAK', color: '#01411C', accent: '#fff', ink: '#fff', logo: '/teams/cricket/pakistan.png' },
  { name: 'South Africa', keys: ['south africa', 'sa', 'rsa', 'proteas'], abbr: 'SA', color: '#007A4D', accent: '#FFB612', ink: '#fff', logo: '/teams/cricket/south-africa.png' },
  { name: 'Sri Lanka', keys: ['sri lanka', 'sl', 'lions', 'sri lankan cricket team'], abbr: 'SL', color: '#8D153A', accent: '#F7B718', ink: '#fff', logo: '/teams/cricket/sri-lanka.png' },
  { name: 'West Indies', keys: ['west indies', 'wi', 'windies', 'caribbean cricket team'], abbr: 'WI', color: '#7B0041', accent: '#FFC72C', ink: '#fff', logo: '/teams/cricket/west-indies.png' },
  { name: 'Zimbabwe', keys: ['zimbabwe', 'zim', 'chevrons', 'zimbabwe cricket team'], abbr: 'ZIM', color: '#006400', accent: '#FFD200', ink: '#fff', logo: '/teams/cricket/zimbabwe.png' },
]

/** The team whose name is this list title, such as India. */
export function cricketTeamByName(name: string): CricketTeam | null {
  return CRICKET_TEAMS.find((team) => team.name === name) ?? null
}

/** The followed team on a game line. "India vs Sri Lanka" is India. */
export function cricketTeamForGame(text: string): CricketTeam | null {
  const value = text.trim().toLowerCase()
  const hits = CRICKET_TEAMS.filter(
    (team) => value === team.name.toLowerCase() || value.startsWith(`${team.name.toLowerCase()} `),
  )
  return hits.length === 1 ? hits[0] : null
}

/** One team when a saved name or short code belongs to exactly one team. */
export function cricketTeamName(raw: string | null): string | null {
  if (!raw) return null
  const key = cricketSearchKey(raw)
  if (!key) return null
  const hits = CRICKET_TEAMS.filter((team) => team.name.toLowerCase() === key || team.keys.includes(key))
  return hits.length === 1 ? hits[0].name : null
}

/** A team name or short code, ready to match the stored keys. */
export function cricketSearchKey(raw: string): string | null {
  const key = raw.trim().replace(/\s+/g, ' ').toLowerCase()
  if (key.length < 2 || key.length > 40) return null
  if (!/^[a-z0-9]+( [a-z0-9]+)*$/.test(key)) return null
  return key
}

export function readCricketSearch(): string | null {
  try {
    const value = localStorage.getItem(CRICKET_SEARCH_KEY) ?? ''
    return cricketSearchKey(value) ? value.trim().replace(/\s+/g, ' ') : null
  } catch {
    return null
  }
}

export function writeCricketSearch(value: string): void {
  try {
    const shown = value.trim().replace(/\s+/g, ' ')
    if (!cricketSearchKey(shown)) localStorage.removeItem(CRICKET_SEARCH_KEY)
    else localStorage.setItem(CRICKET_SEARCH_KEY, shown)
  } catch {
    /* the choice still works for this visit */
  }
}
