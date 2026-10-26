const NFL_SEARCH_KEY = 'resuming-nfl-search'

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
