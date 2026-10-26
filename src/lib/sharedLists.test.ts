import { describe, expect, it, vi } from 'vitest'
import { isSharedListCode, listCodeFromReferrer, sharedListCodeFromUrl, sharedListFormIssue, sharedListInstallLink, sharedListItemsFromCsv, sharedListUrl, takeInstallListCode } from './sharedLists'

const item = { text: 'Winter break', day: '2026-12-22', time: '' }

describe('shared list form', () => {
  it('accepts a title and one dated reminder', () => {
    expect(sharedListFormIssue({ title: 'Springfield holidays', items: [item] })).toBeNull()
    expect(sharedListFormIssue({ title: 'Springfield holidays', items: [{ ...item, time: '09:30' }] })).toBeNull()
  })

  it('refuses an empty list, a bad day, a bad time, and a web link', () => {
    expect(sharedListFormIssue({ title: '', items: [item] })).toBe('title')
    expect(sharedListFormIssue({ title: 'Holidays', items: [{ text: '', day: '', time: '' }] })).toBe('empty')
    expect(sharedListFormIssue({ title: 'Holidays', items: [{ ...item, day: '2026-02-31' }] })).toBe('item')
    expect(sharedListFormIssue({ title: 'Holidays', items: [{ ...item, time: '25:00' }] })).toBe('item')
    expect(sharedListFormIssue({ title: 'See example.com', items: [item] })).toBe('links')
    expect(sharedListFormIssue({ title: 'Holidays', items: [{ ...item, text: 'Tap bit.ly/x' }] })).toBe('links')
  })

  it('builds the public link', () => {
    expect(sharedListUrl('ab12cd')).toBe('https://resuming.me/c/ab12cd')
    expect(isSharedListCode('ab12cd')).toBe(true)
    expect(isSharedListCode('nope')).toBe(false)
  })
})

describe('shared list csv', () => {
  it('reads a header, a US date, a half day, and a time', () => {
    const result = sharedListItemsFromCsv(
      'Holiday,Date,Type,Time\nThanksgiving,11/25/2026,,\n"Early release, grades K-5",11/24/2026,Half day,12:30 PM\n',
    )
    expect(result).toEqual({
      ok: true,
      items: [
        { text: 'Thanksgiving', day: '2026-11-25', time: '' },
        { text: 'Early release, grades K-5 · Half day', day: '2026-11-24', time: '12:30' },
      ],
      zipCodes: [],
    })
  })

  it('reads ZIP codes from the first row that has them', () => {
    const once = sharedListItemsFromCsv(
      'Holiday,Date,Zip codes\nThanksgiving,11/26/2026,98052 98053\nWinter break,12/21/2026,\n',
    )
    expect(once.ok && once.zipCodes).toEqual(['98052', '98053'])
    const repeated = sharedListItemsFromCsv(
      'Holiday,Date,Zip codes\nThanksgiving,11/26/2026,"98052, 98053"\nWinter break,12/21/2026,98074\n',
    )
    expect(repeated.ok && repeated.zipCodes).toEqual(['98052', '98053'])
    expect(sharedListItemsFromCsv('Holiday,Date,Zip codes\nThanksgiving,11/26/2026,9805\n').ok).toBe(false)
  })

  it('reads a file with no header, and a day written out', () => {
    const plain = sharedListItemsFromCsv('25/11/2026,Thanksgiving\n2026-12-19,Winter break\n')
    expect(plain).toEqual({
      ok: true,
      items: [
        { text: 'Thanksgiving', day: '2026-11-25', time: '' },
        { text: 'Winter break', day: '2026-12-19', time: '' },
      ],
      zipCodes: [],
    })
    const written = sharedListItemsFromCsv('name,date\nWinter break,"November 25, 2026"\n')
    expect(written).toEqual({
      ok: true,
      items: [{ text: 'Winter break', day: '2026-11-25', time: '' }],
      zipCodes: [],
    })
  })

  it('stops on a bad date and on too many rows', () => {
    expect(sharedListItemsFromCsv('name,date\nRecess,13/40/2026\n').ok).toBe(false)
    const rows = ['name,date', ...Array.from({ length: 41 }, (_, i) => `Day ${i + 1},2026-11-01`)]
    const result = sharedListItemsFromCsv(rows.join('\n'))
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error).toContain('40')
  })
})

describe('links into the app', () => {
  it('reads the code from a resuming.me list link', () => {
    expect(sharedListCodeFromUrl('https://resuming.me/c/AB12CD')).toBe('ab12cd')
    expect(sharedListCodeFromUrl('https://www.resuming.me/c/ab12cd/')).toBe('ab12cd')
    expect(sharedListCodeFromUrl('https://evil.example/c/ab12cd')).toBeNull()
    expect(sharedListCodeFromUrl('https://resuming.me/e/ab12cd')).toBeNull()
    expect(sharedListCodeFromUrl('https://resuming.me/c/toolong')).toBeNull()
  })

  it('reads the list code from the install referrer, next to marketing codes', () => {
    expect(listCodeFromReferrer('list=ab12cd')).toBe('ab12cd')
    expect(listCodeFromReferrer('utm_source=g1&utm_medium=play&utm_campaign=m1&list=ab12cd')).toBe('ab12cd')
    expect(listCodeFromReferrer('event=ab12cd')).toBeNull()
    expect(listCodeFromReferrer('list=<script>')).toBeNull()
  })

  it('carries the code in the Play install referrer', () => {
    const url = new URL(sharedListInstallLink('ab12cd'))
    expect(url.searchParams.get('id')).toBe('com.cheerfulgames.resuming')
    expect(url.searchParams.get('referrer')).toBe('list=ab12cd')
  })

  it('takes the install code only once', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    })
    const read = async () => ({ referrer: 'list=ab12cd' })
    expect(await takeInstallListCode(read)).toBe('ab12cd')
    expect(await takeInstallListCode(read)).toBeNull()
    vi.unstubAllGlobals()
  })

  it('tries again next start when Play does not answer', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    })
    expect(await takeInstallListCode(async () => null)).toBeNull()
    expect(await takeInstallListCode(async () => ({ referrer: 'list=kyrsme' }))).toBe('kyrsme')
    vi.unstubAllGlobals()
  })
})
