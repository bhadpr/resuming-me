import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { COMPANY_NAME, PRODUCT_NAME, SUPPORT_EMAIL, sitePageFromPath } from './site'

describe('sitePageFromPath', () => {
  it('maps legal and feedback paths', () => {
    expect(sitePageFromPath('/privacy')).toBe('privacy')
    expect(sitePageFromPath('/terms/')).toBe('terms')
    expect(sitePageFromPath('about')).toBe('about')
    expect(sitePageFromPath('/feedback')).toBe('feedback')
    expect(sitePageFromPath('/delete-account')).toBe('delete-account')
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
    expect(html).toContain('Export my data')
    expect(html).toContain('Delete my account')
  })

  it('ships a static delete-account page for store listings', () => {
    const html = readFileSync('public/delete-account.html', 'utf8')
    expect(html).toContain('Delete your account')
    expect(html).toContain(SUPPORT_EMAIL)
    expect(html).toContain('DELETE')
  })
})
