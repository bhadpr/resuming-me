import { summarizePageViews } from './analytics'
import { describe, expect, it } from 'vitest'

describe('summarizePageViews', () => {
  it('aggregates views, visitors, and top pages', () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = [
      {
        path: '/app/today',
        visitor_id: 'v1',
        user_id: 'u1',
        referrer: 'https://www.google.com/',
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        created_at: `${today}T10:00:00.000Z`,
      },
      {
        path: '/app/today',
        visitor_id: 'v1',
        user_id: 'u1',
        referrer: null,
        user_agent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        created_at: `${today}T11:00:00.000Z`,
      },
      {
        path: '/',
        visitor_id: 'v2',
        user_id: null,
        referrer: null,
        user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120.0.0.0',
        created_at: `${today}T12:00:00.000Z`,
      },
    ]

    const summary = summarizePageViews(rows, '7d')
    expect(summary.totalViews).toBe(3)
    expect(summary.uniqueVisitors).toBe(2)
    expect(summary.signedInVisitors).toBe(1)
    expect(summary.viewsToday).toBe(3)
    expect(summary.topPages[0]).toMatchObject({ key: '/app/today', count: 2 })
    expect(summary.devices.some((d) => d.key === 'Mobile' && d.count === 2)).toBe(true)
    expect(summary.browsers.some((b) => b.key === 'Chrome')).toBe(true)
    expect(summary.topReferrers.some((r) => r.key === 'google.com')).toBe(true)
  })
})
