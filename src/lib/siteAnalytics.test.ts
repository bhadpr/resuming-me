import { describe, expect, it } from 'vitest'
import { sourceLabel, summarizeSiteEvents } from './siteAnalytics'

const view = (anon: string, props: Record<string, unknown> = {}) => ({
  name: 'site_viewed',
  anon_id: anon,
  props: { device: 'computer', ...props },
})
const tap = (anon: string, kind: string, where = 'hero') => ({
  name: 'site_cta_clicked',
  anon_id: anon,
  props: { kind, where },
})

describe('sourceLabel', () => {
  it('prefers a tagged link, then the referring site, then direct', () => {
    expect(sourceLabel({ utm_source: 'reddit', utm_medium: 'post', referrer_host: 'reddit.com' })).toBe('reddit / post')
    expect(sourceLabel({ utm_source: 'whatsapp' })).toBe('whatsapp')
    expect(sourceLabel({ referrer_host: 'google.com' })).toBe('google.com')
    expect(sourceLabel({ utm_source: '  ', referrer_host: null })).toBe('direct')
    expect(sourceLabel({})).toBe('direct')
  })
})

describe('summarizeSiteEvents', () => {
  it('counts people once, however many times they came or tapped', () => {
    const summary = summarizeSiteEvents([
      view('a', { utm_source: 'reddit' }),
      view('a', { utm_source: 'reddit' }),
      view('b', { referrer_host: 'google.com', device: 'phone' }),
      view('c'),
      tap('a', 'play'),
      tap('a', 'play', 'final'),
      tap('b', 'web'),
    ])
    expect(summary.pageViews).toBe(4)
    expect(summary.visitors).toBe(3)
    expect(summary.tappedPlay).toBe(1)
    expect(summary.tappedBrowser).toBe(1)
    expect(summary.sources).toEqual([
      { source: 'direct', visitors: 1, tappedPlay: 0 },
      { source: 'google.com', visitors: 1, tappedPlay: 0 },
      { source: 'reddit', visitors: 1, tappedPlay: 1 },
    ])
    expect(summary.taps).toEqual([
      { key: 'Google Play · final', label: 'Google Play · final', count: 1 },
      { key: 'Google Play · hero', label: 'Google Play · hero', count: 1 },
      { key: 'Try in browser · hero', label: 'Try in browser · hero', count: 1 },
    ])
    expect(summary.devices).toEqual([
      { key: 'Computer', label: 'Computer', count: 2 },
      { key: 'Phone', label: 'Phone', count: 1 },
    ])
  })

  it('ignores unknown buttons and rows with no props', () => {
    const summary = summarizeSiteEvents([
      { name: 'site_viewed', anon_id: 'a', props: null },
      tap('a', 'share'),
      { name: 'site_cta_clicked', anon_id: 'a', props: null },
    ])
    expect(summary.pageViews).toBe(1)
    expect(summary.tappedPlay).toBe(0)
    expect(summary.taps).toEqual([])
  })

  it('handles an empty window', () => {
    expect(summarizeSiteEvents([])).toEqual({
      pageViews: 0,
      visitors: 0,
      tappedPlay: 0,
      tappedBrowser: 0,
      sources: [],
      taps: [],
      devices: [],
    })
  })
})
