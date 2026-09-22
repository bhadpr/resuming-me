import { describe, expect, it } from 'vitest'
import { createZip, crc32 } from './zip'
import { EXPORT_TABLES, exportFilename, logEntriesToCsv } from './exportData'

describe('crc32 / zip', () => {
  it('matches known CRC32 for empty and hello', () => {
    expect(crc32(new Uint8Array())).toBe(0)
    expect(crc32(new TextEncoder().encode('hello'))).toBe(0x3610a686)
  })

  it('builds a zip with local + central headers', () => {
    const enc = new TextEncoder()
    const zip = createZip([
      { name: 'a.json', data: enc.encode('{"ok":true}') },
      { name: 'b.csv', data: enc.encode('id\n1\n') },
    ])
    expect(zip[0]).toBe(0x50) // P
    expect(zip[1]).toBe(0x4b) // K
    expect(zip.length).toBeGreaterThan(40)
  })
})

describe('export helpers', () => {
  it('names the zip with the local date', () => {
    expect(exportFilename('2026-09-22')).toBe('resuming-export-2026-09-22.zip')
  })

  it('includes every user-owned table from the Phase 1 export list', () => {
    expect([...EXPORT_TABLES]).toEqual([
      'profiles',
      'activities',
      'activity_target_history',
      'log_entries',
      'metrics',
      'metric_entries',
      'feedback',
    ])
  })

  it('csv-escapes notes with commas and quotes', () => {
    const csv = logEntriesToCsv([
      {
        id: '1',
        activity_id: 'a',
        user_id: 'u',
        type: 'session',
        source: 'timer',
        started_at: null,
        duration_seconds: 60,
        date: '2026-09-22',
        note: 'hi, "there"',
        created_at: 't',
        updated_at: null,
      },
    ])
    expect(csv).toContain('"hi, ""there"""')
    expect(csv.split('\n')[0]).toContain('duration_seconds')
  })
})
