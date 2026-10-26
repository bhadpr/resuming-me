import { describe, expect, it } from 'vitest'
import { communityRegion, isUsTimeZone, parseZipCodes } from './schoolZip'

describe('US time zones', () => {
  it('treats the Pacific and Eastern zones as the United States', () => {
    expect(isUsTimeZone('America/Los_Angeles')).toBe(true)
    expect(isUsTimeZone('America/New_York')).toBe(true)
    expect(isUsTimeZone('Pacific/Honolulu')).toBe(true)
  })

  it('picks the community catalogs from the clock', () => {
    expect(communityRegion('America/Los_Angeles')).toBe('us')
    expect(communityRegion('Asia/Kolkata')).toBe('in')
    expect(communityRegion('Asia/Calcutta')).toBe('in')
    expect(communityRegion('America/Vancouver')).toBeNull()
  })

  it('leaves Canada, Mexico, and India out', () => {
    expect(isUsTimeZone('America/Vancouver')).toBe(false)
    expect(isUsTimeZone('America/Mexico_City')).toBe(false)
    expect(isUsTimeZone('Asia/Kolkata')).toBe(false)
  })
})

describe('ZIP codes', () => {
  it('reads spaces, commas, and a single code', () => {
    expect(parseZipCodes('98052 98053 98074')).toEqual({ ok: true, zipCodes: ['98052', '98053', '98074'] })
    expect(parseZipCodes('98052, 98053')).toEqual({ ok: true, zipCodes: ['98052', '98053'] })
    expect(parseZipCodes('98052')).toEqual({ ok: true, zipCodes: ['98052'] })
    expect(parseZipCodes('')).toEqual({ ok: true, zipCodes: [] })
  })

  it('allows a large district and stops past 300 codes', () => {
    const codes = Array.from({ length: 300 }, (_, i) => String(10000 + i))
    const parsed = parseZipCodes(codes.join(' '))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.zipCodes).toHaveLength(300)
    expect(parseZipCodes([...codes, '10300'].join(' ')).ok).toBe(false)
  })

  it('drops a repeated code and refuses a short one', () => {
    expect(parseZipCodes('98052 98052')).toEqual({ ok: true, zipCodes: ['98052'] })
    expect(parseZipCodes('9805')).toEqual({ ok: false })
    expect(parseZipCodes('98052-1234')).toEqual({ ok: false })
  })
})
