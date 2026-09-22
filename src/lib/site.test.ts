import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  COMPANY_NAME,
  PRODUCT_NAME,
  SUPPORT_EMAIL,
  isKnownPath,
  sitePageFromPath,
} from './site'

describe('sitePageFromPath', () => {
  it('maps legal and feedback paths', () => {
    expect(sitePageFromPath('/privacy')).toBe('privacy')
    expect(sitePageFromPath('/terms/')).toBe('terms')
    expect(sitePageFromPath('about')).toBe('about')
    expect(sitePageFromPath('/feedback')).toBe('feedback')
  })

  it('ignores the home path and unknown routes', () => {
    expect(sitePageFromPath('/')).toBeNull()
    expect(sitePageFromPath('/app/today')).toBeNull()
  })

  it('ships a static privacy page Play can crawl without JavaScript', () => {
    const html = readFileSync('public/privacy.html', 'utf8')
    expect(html).toContain('Privacy Policy')
    expect(html).toContain(PRODUCT_NAME)
    expect(html).toContain(COMPANY_NAME)
    expect(html).toContain(SUPPORT_EMAIL)
    expect(html).toContain('We do not sell your personal information')
  })
})

describe('isKnownPath', () => {
  it('accepts home, public pages, and app prefixes', () => {
    expect(isKnownPath('/')).toBe(true)
    expect(isKnownPath('/about')).toBe(true)
    expect(isKnownPath('/today')).toBe(true)
    expect(isKnownPath('/activities/abc')).toBe(true)
  })

  it('rejects unknown paths', () => {
    expect(isKnownPath('/does-not-exist')).toBe(false)
  })
})

describe('SEO static files', () => {
  it('ships robots.txt and sitemap.xml', () => {
    const robots = readFileSync('public/robots.txt', 'utf8')
    expect(robots).toContain('Sitemap: https://resuming.me/sitemap.xml')
    expect(robots).toContain('Disallow: /today')
    const sitemap = readFileSync('public/sitemap.xml', 'utf8')
    expect(sitemap).toContain('https://resuming.me/about')
  })

  it('prerenders About for crawlers', () => {
    const html = readFileSync('public/about/index.html', 'utf8')
    expect(html).toContain('About')
    expect(html).toContain(PRODUCT_NAME)
    expect(html).toContain('no-shame')
  })
})
