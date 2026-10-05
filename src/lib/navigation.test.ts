import { describe, expect, it } from 'vitest'
import { parseAppPath, safeNextPath, stashAuthNext, tabFromView, tabPath, takeAuthNext } from './navigation'

describe('safeNextPath', () => {
  it('allows same-origin relative paths', () => {
    expect(safeNextPath('/activities/123')).toBe('/activities/123')
    expect(safeNextPath('/insights?range=week')).toBe('/insights?range=week')
  })

  it('rejects open redirects', () => {
    expect(safeNextPath('https://evil.example')).toBeNull()
    expect(safeNextPath('//evil.example')).toBeNull()
    expect(safeNextPath('activities')).toBeNull()
    expect(safeNextPath(null)).toBeNull()
  })
})

describe('parseAppPath', () => {
  it('maps app screens', () => {
    expect(parseAppPath('/today')).toEqual({ name: 'today' })
    expect(parseAppPath('/activities')).toEqual({ name: 'activities', screen: 'list' })
    expect(parseAppPath('/activities/new')).toEqual({ name: 'activities', screen: 'form' })
    expect(parseAppPath('/activities/abc')).toEqual({
      name: 'activities',
      screen: 'detail',
      activityId: 'abc',
    })
    expect(parseAppPath('/activities/abc/edit')).toEqual({
      name: 'activities',
      screen: 'form',
      activityId: 'abc',
    })
    expect(parseAppPath('/numbers')).toEqual({ name: 'numbers', screen: 'list' })
    expect(parseAppPath('/numbers/new')).toEqual({ name: 'numbers', screen: 'form' })
    expect(parseAppPath('/numbers/m1')).toEqual({
      name: 'numbers',
      screen: 'detail',
      metricId: 'm1',
    })
    expect(parseAppPath('/medicines/new')).toEqual({ name: 'medicines' })
    expect(parseAppPath('/medicines/med-1')).toEqual({ name: 'medicines', medicineId: 'med-1' })
    expect(parseAppPath('/reminders/new')).toEqual({ name: 'reminders' })
    expect(parseAppPath('/reminders/r-1')).toEqual({ name: 'reminders', reminderId: 'r-1' })
    expect(parseAppPath('/insights')).toEqual({ name: 'insights' })
    expect(parseAppPath('/review/2026-09-14')).toEqual({ name: 'review', weekStart: '2026-09-14' })
    expect(parseAppPath('/settings')).toEqual({ name: 'settings' })
    expect(parseAppPath('/settings/themes')).toEqual({ name: 'themes' })
    expect(parseAppPath('/admin/analytics')).toEqual({ name: 'admin', page: 'analytics' })
    expect(parseAppPath('/admin/groups')).toEqual({ name: 'admin', page: 'groups' })
    expect(parseAppPath('/admin/groups/group-1')).toEqual({
      name: 'admin',
      page: 'groups',
      groupId: 'group-1',
    })
  })

  it('returns null for unknown paths', () => {
    expect(parseAppPath('/')).toBeNull()
    expect(parseAppPath('/about')).toBeNull()
    expect(parseAppPath('/nope')).toBeNull()
  })
})

describe('tab helpers', () => {
  it('maps views to tabs and paths', () => {
    expect(tabFromView({ name: 'numbers', screen: 'list' })).toBe('metrics')
    expect(tabFromView({ name: 'medicines', medicineId: 'med-1' })).toBe('metrics')
    expect(tabFromView({ name: 'reminders' })).toBe('today')
    expect(tabPath('metrics')).toBe('/numbers')
    expect(tabPath('today')).toBe('/today')
  })
})

describe('auth next stash', () => {
  it('round-trips a safe path through sessionStorage', () => {
    stashAuthNext('/activities/1')
    expect(takeAuthNext()).toBe('/activities/1')
    expect(takeAuthNext()).toBeNull()
  })

  it('ignores unsafe values', () => {
    stashAuthNext('//evil')
    expect(takeAuthNext()).toBeNull()
  })
})
