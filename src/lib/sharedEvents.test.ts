import { describe, expect, it, vi } from 'vitest'
import type { Reminder } from './reminderSchedule'
import {
  cleanFromLine,
  eventCodeFromReferrer,
  formatSharedWhen,
  hasWebLink,
  isShareableReminder,
  isSharedEventCode,
  localEventTime,
  replacementReminder,
  sharedEventBlock,
  sharedEventCodeFromUrl,
  takeInstallEventCode,
  sharedEventInstallLink,
  sharedEventMessage,
  whatsAppShareUrl,
  type SharedEvent,
} from './sharedEvents'

function reminder(patch: Partial<Reminder> = {}): Reminder {
  return {
    id: 'r1',
    text: 'Ganesh Aarti',
    day: '2026-09-07',
    hour: 19,
    minute: 0,
    remindBefore: false,
    kind: 'event',
    everyYear: false,
    doneAt: null,
    ...patch,
  }
}

function event(patch: Partial<SharedEvent> = {}): SharedEvent {
  return {
    id: 'e1',
    code: 'ab12cd',
    text: 'Ganesh Aarti',
    from: null,
    day: '2026-09-07',
    hour: 19,
    minute: 0,
    timeZone: 'Asia/Kolkata',
    kind: 'event',
    status: 'active',
    takingAdds: true,
    ...patch,
  }
}

describe('hasWebLink', () => {
  it('catches links and bare domains', () => {
    for (const text of ['see wa.me/123', 'www.prize', 'http://x', 'claim at prize.com now', 'bit.ly/abc', 'sbi.co.in']) {
      expect(hasWebLink(text)).toBe(true)
    }
  })

  it('leaves times, abbreviations, and other scripts alone', () => {
    for (const text of ['Aarti at 7.30 pm', 'Gate no. 4, p.m.', 'Mr. Shah', 'income tax', 'हॉल नं. 2', null, '']) {
      expect(hasWebLink(text)).toBe(false)
    }
  })
})

describe('isShareableReminder', () => {
  it('shares open one-day reminders from today on', () => {
    expect(isShareableReminder(reminder(), '2026-09-07')).toBe(true)
    expect(isShareableReminder(reminder(), '2026-09-08')).toBe(false)
    expect(isShareableReminder(reminder({ everyYear: true }), '2026-09-01')).toBe(false)
    expect(isShareableReminder(reminder({ doneAt: '2026-09-07T10:00:00Z' }), '2026-09-01')).toBe(false)
  })
})

describe('replacementReminder', () => {
  it('keeps the details and drops the link to the old event', () => {
    const next = replacementReminder(reminder({ sharedEventId: 'e1', remindBefore: true, alertOff: true }))
    expect(next).toEqual({
      text: 'Ganesh Aarti',
      day: '2026-09-07',
      hour: 19,
      minute: 0,
      remindBefore: true,
      kind: 'event',
    })
  })
})

describe('codes and links', () => {
  it('accepts only short lowercase codes', () => {
    expect(isSharedEventCode('ab12cd')).toBe(true)
    expect(isSharedEventCode('AB12CD')).toBe(false)
    expect(isSharedEventCode('ab-12')).toBe(false)
  })

  it('carries the code in the Play install referrer', () => {
    const url = new URL(sharedEventInstallLink('ab12cd'))
    expect(url.hostname).toBe('play.google.com')
    expect(url.searchParams.get('referrer')).toBe('event=ab12cd')
  })

  it('cleans the From line', () => {
    expect(cleanFromLine('  Shivaji   Mandal ')).toBe('Shivaji Mandal')
    expect(cleanFromLine('   ')).toBeNull()
  })
})

describe('sharedEventMessage', () => {
  it('puts the day, time, and link in plain words', () => {
    const message = sharedEventMessage(event(), 'en')
    expect(message).toContain('Ganesh Aarti')
    expect(message).toContain(formatSharedWhen(event(), 'en'))
    expect(message).toContain('https://resuming.me/e/ab12cd')
  })

  it('adds the From line when there is one', () => {
    expect(sharedEventMessage(event({ from: 'Shivaji Mandal' }), 'en')).toContain('(Shivaji Mandal)')
  })

  it('leaves out the time for an any-time event', () => {
    expect(formatSharedWhen(event({ hour: null, minute: null }), 'en')).not.toMatch(/\d:\d\d/)
  })

  it('makes a WhatsApp link with the whole message', () => {
    const url = new URL(whatsAppShareUrl('hello & bye'))
    expect(url.searchParams.get('text')).toBe('hello & bye')
  })
})

describe('links into the app', () => {
  it('reads the code from a resuming.me event link', () => {
    expect(sharedEventCodeFromUrl('https://resuming.me/e/AB12CD')).toBe('ab12cd')
    expect(sharedEventCodeFromUrl('https://www.resuming.me/e/ab12cd/')).toBe('ab12cd')
    expect(sharedEventCodeFromUrl('https://evil.example/e/ab12cd')).toBeNull()
    expect(sharedEventCodeFromUrl('com.cheerfulgames.resuming://auth/callback?code=x')).toBeNull()
    expect(sharedEventCodeFromUrl('https://resuming.me/today')).toBeNull()
  })

  it('reads the code from the install referrer, next to marketing codes', () => {
    expect(eventCodeFromReferrer('event=ab12cd')).toBe('ab12cd')
    expect(eventCodeFromReferrer('utm_source=g1&utm_medium=play&utm_campaign=m1&event=ab12cd')).toBe('ab12cd')
    expect(eventCodeFromReferrer('utm_source=g1&utm_campaign=m1')).toBeNull()
    expect(eventCodeFromReferrer('event=<script>')).toBeNull()
  })

  it('takes the install code only once', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    })
    const read = async () => ({ referrer: 'event=ab12cd' })
    expect(await takeInstallEventCode(read)).toBe('ab12cd')
    expect(await takeInstallEventCode(read)).toBeNull()
    vi.unstubAllGlobals()
  })

  it('tries again next start when Play does not answer', async () => {
    const store = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    })
    expect(await takeInstallEventCode(async () => null)).toBeNull()
    expect(await takeInstallEventCode(async () => ({ referrer: 'event=ab12cd' }))).toBe('ab12cd')
    vi.unstubAllGlobals()
  })
})

describe('localEventTime', () => {
  const aarti = { day: '2026-09-07', hour: 19, minute: 0, timeZone: 'Asia/Kolkata' }

  it('keeps the clock when the phone is in the same zone', () => {
    expect(localEventTime(aarti, 'Asia/Kolkata')).toBeNull()
  })

  it('moves the time to the phone, and the day when it crosses midnight', () => {
    expect(localEventTime(aarti, 'Asia/Dubai')).toEqual({ day: '2026-09-07', hour: 17, minute: 30 })
    expect(localEventTime(aarti, 'America/Los_Angeles')).toEqual({ day: '2026-09-07', hour: 6, minute: 30 })
    expect(localEventTime({ ...aarti, hour: 7 }, 'America/Los_Angeles')).toEqual({
      day: '2026-09-06',
      hour: 18,
      minute: 30,
    })
  })

  it('leaves any-time events and unknown zones alone', () => {
    expect(localEventTime({ ...aarti, hour: null, minute: null }, 'Asia/Dubai')).toBeNull()
    expect(localEventTime({ ...aarti, timeZone: 'Not/AZone' }, 'Asia/Dubai')).toBeNull()
  })
})

describe('sharedEventBlock', () => {
  it('says why an event cannot be added', () => {
    expect(sharedEventBlock(null, '2026-09-01')).toBe('unavailable')
    expect(sharedEventBlock(event({ status: 'switched_off', text: null }), '2026-09-01')).toBe('unavailable')
    expect(sharedEventBlock(event({ status: 'cancelled' }), '2026-09-01')).toBe('cancelled')
    expect(sharedEventBlock(event(), '2026-09-08')).toBe('ended')
    expect(sharedEventBlock(event({ takingAdds: false }), '2026-09-01')).toBe('closed')
    expect(sharedEventBlock(event(), '2026-09-07')).toBeNull()
  })
})
