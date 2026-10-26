import { describe, expect, it } from 'vitest'
import { nflSearchKey } from './nflSearch'

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
})
