import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GUEST_DRAFT_KEY,
  GUEST_DRAFT_TTL_MS,
  appendGuestCount,
  appendGuestLog,
  guestCountProgress,
  guestSessionSeconds,
  guestTimerProgress,
  guestDraftToPayload,
  clampStep,
  clearGuestDraft,
  createGuestDraft,
  ensureGuestDraft,
  isGuestDraftFresh,
  loadGuestDraft,
  sanitizeActivityName,
  saveGuestDraft,
  setGuestStep,
  upsertGuestActivity,
  type GuestDraft,
} from './guestDraft'

function memoryStorage() {
  const store = new Map<string, string>()
  const storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, String(value))
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
    get length() {
      return store.size
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  }
  vi.stubGlobal('localStorage', storage)
  return storage
}

function activity(localId: string, name = 'Reading'): GuestDraft['activities'][number] {
  return {
    localId,
    name,
    emoji: '📖',
    type: 'daily',
    trackingMode: 'timer',
    targetValue: 2,
    targetUnit: 'min',
    weeklyTarget: null,
    deadline: null,
    templateId: null,
    why: null,
    usuallyWhen: null,
  }
}

describe('guest draft helpers', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('sanitizes and caps custom names at 40 characters', () => {
    expect(sanitizeActivityName('  Side   project  ')).toBe('Side project')
    expect(sanitizeActivityName('x'.repeat(50))).toHaveLength(40)
  })

  it('clamps steps to 1..8', () => {
    expect(clampStep(0)).toBe(1)
    expect(clampStep(3.6)).toBe(4)
    expect(clampStep(99)).toBe(8)
  })

  it('expires drafts older than 7 days', () => {
    const old = createGuestDraft(new Date(Date.now() - GUEST_DRAFT_TTL_MS - 1000))
    expect(isGuestDraftFresh(old)).toBe(false)
    const fresh = createGuestDraft(new Date())
    expect(isGuestDraftFresh(fresh)).toBe(true)
  })
})

describe('guest draft storage', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('creates a draft once and restores the last step', () => {
    memoryStorage()
    const first = ensureGuestDraft('America/Los_Angeles')
    const again = ensureGuestDraft('UTC')
    expect(again.guestId).toBe(first.guestId)
    expect(again.timezone).toBe('America/Los_Angeles')

    setGuestStep(first, 4)
    expect(loadGuestDraft()?.step).toBe(4)
  })

  it('keeps many habits up to the guest cap and keeps answers across reload', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, activity('a', 'Reading'))
    draft = upsertGuestActivity(draft, activity('b', 'Walk'))
    draft = upsertGuestActivity(draft, activity('c', '  Meditate  '))
    draft = upsertGuestActivity(draft, activity('d', 'Guitar'))
    draft = saveGuestDraft({
      ...draft,
      gapAnswer: { a: 'a few days' },
      slipAnswer: ['Evenings', 'Weekends', 'Mornings'],
    })

    const loaded = loadGuestDraft()
    expect(loaded?.activities.map((a) => a.name)).toEqual([
      'Reading',
      'Walk',
      'Meditate',
      'Guitar',
    ])
    expect(loaded?.gapAnswer).toEqual({ a: 'a few days' })
    expect(loaded?.slipAnswer).toEqual(['Evenings', 'Weekends'])
  })

  it('stores a protein tap without a timer session', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, {
      ...activity('p', 'Protein'),
      trackingMode: 'count',
      targetValue: 20,
      targetUnit: 'g',
      templateId: 'protein',
    })
    draft = appendGuestCount(draft, 'p', '2026-09-23')
    const loaded = loadGuestDraft()
    expect(loaded?.logs).toHaveLength(1)
    expect(loaded?.logs[0]?.kind).toBe('count')
    expect(guestCountProgress(
      { targetValue: 20, targetUnit: 'g' },
      1,
    )).toMatchObject({ value: 5, done: false, label: '5 g / 20 g' })
    let next = loaded!
    for (let tap = 0; tap < 4; tap += 1) next = appendGuestCount(next, 'p', '2026-09-23')
    expect(loadGuestDraft()?.logs).toHaveLength(5)
    expect(guestCountProgress({ targetValue: 20, targetUnit: 'g' }, 5)).toMatchObject({
      value: 25,
      done: true,
      label: '25 g / 20 g',
    })
    draft = upsertGuestActivity(loadGuestDraft()!, {
      ...activity('f', 'Fasting'),
      trackingMode: 'count',
      targetValue: 4,
      targetUnit: 'hours',
      templateId: 'fasting',
    })
    draft = appendGuestCount(draft, 'f', '2026-09-23')
    draft = appendGuestCount(draft, 'f', '2026-09-23')
    expect(loadGuestDraft()?.logs.filter((log) => log.localActivityId === 'f')).toHaveLength(2)
    expect(guestCountProgress({ targetValue: 4, targetUnit: 'hours' }, 2)).toMatchObject({
      value: 8,
      done: true,
      label: '8 hours / 4 hours',
    })
  })

  it('keeps timer sessions of at least one second and adds later bouts the same day', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, {
      ...activity('b', 'Bhastrika'),
      targetValue: 3,
      targetUnit: 'minutes',
      templateId: 'bhastrika',
    })
    draft = appendGuestLog(draft, {
      localActivityId: 'b',
      startedAt: '2026-09-22T18:00:00.000Z',
      durationSeconds: 12,
      date: '2026-09-22',
    })
    expect(loadGuestDraft()?.logs).toHaveLength(1)
    expect(guestSessionSeconds(draft, 'b', '2026-09-22')).toBe(12)

    draft = appendGuestLog(draft, {
      localActivityId: 'b',
      startedAt: '2026-09-22T18:05:00.000Z',
      durationSeconds: 120,
      date: '2026-09-22',
    })
    expect(guestSessionSeconds(draft, 'b', '2026-09-22')).toBe(132)
    expect(guestTimerProgress({ targetValue: 3, targetUnit: 'minutes' }, 132)).toMatchObject({
      done: false,
      label: '2.2 min / 3 min',
    })

    draft = appendGuestLog(draft, {
      localActivityId: 'b',
      startedAt: '2026-09-22T18:10:00.000Z',
      durationSeconds: 60,
      date: '2026-09-22',
    })
    expect(guestSessionSeconds(draft, 'b', '2026-09-22')).toBe(192)
    expect(guestTimerProgress({ targetValue: 3, targetUnit: 'minutes' }, 192).done).toBe(true)
  })

  it('does not store a zero-second session', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, activity('a'))
    draft = appendGuestLog(draft, {
      localActivityId: 'a',
      startedAt: '2026-09-22T18:00:00.000Z',
      durationSeconds: 0,
      date: '2026-09-22',
    })
    expect(loadGuestDraft()?.logs).toEqual([])

    appendGuestLog(draft, {
      localActivityId: 'a',
      startedAt: '2026-09-22T18:00:00.000Z',
      durationSeconds: 120,
      date: '2026-09-22',
    })
    expect(loadGuestDraft()?.logs).toHaveLength(1)
    expect(loadGuestDraft()?.logs[0]?.startedAt).toBe('2026-09-22T18:00:00.000Z')
  })

  it('keeps a one-minute walk and adds later walks the same day', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, {
      ...activity('w', 'Walking'),
      targetValue: 5,
      targetUnit: 'minutes',
      templateId: 'walk',
    })
    draft = appendGuestLog(draft, {
      localActivityId: 'w',
      startedAt: '2026-09-23T10:00:00.000Z',
      durationSeconds: 60,
      date: '2026-09-23',
    })
    expect(guestSessionSeconds(draft, 'w', '2026-09-23')).toBe(60)
    expect(guestTimerProgress({ targetValue: 5, targetUnit: 'minutes' }, 60)).toMatchObject({
      done: false,
      label: '1.0 min / 5 min',
    })
    for (let bout = 0; bout < 4; bout += 1) {
      draft = appendGuestLog(draft, {
        localActivityId: 'w',
        startedAt: `2026-09-23T11:0${bout}:00.000Z`,
        durationSeconds: 60,
        date: '2026-09-23',
      })
    }
    expect(loadGuestDraft()?.logs).toHaveLength(5)
    expect(guestSessionSeconds(draft, 'w', '2026-09-23')).toBe(300)
    expect(guestTimerProgress({ targetValue: 5, targetUnit: 'minutes' }, 300).done).toBe(true)
    draft = appendGuestLog(draft, {
      localActivityId: 'w',
      startedAt: '2026-09-23T12:00:00.000Z',
      durationSeconds: 60,
      date: '2026-09-23',
    })
    expect(guestSessionSeconds(draft, 'w', '2026-09-23')).toBe(360)
  })

  it('tracks each timer habit on its own, including a second one', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, {
      ...activity('b', 'Bhastrika'),
      targetValue: 3,
      targetUnit: 'minutes',
      templateId: 'bhastrika',
    })
    draft = upsertGuestActivity(draft, {
      ...activity('p', 'Piano'),
      targetValue: 2,
      targetUnit: 'minutes',
      templateId: null,
    })
    expect(guestTimerProgress({ targetValue: 3, targetUnit: 'minutes' }, 0)).toMatchObject({
      done: false,
      targetSeconds: 180,
      label: '0.0 min / 3 min',
    })
    draft = appendGuestLog(draft, {
      localActivityId: 'b',
      startedAt: '2026-09-23T10:00:00.000Z',
      durationSeconds: 180,
      date: '2026-09-23',
    })
    expect(guestSessionSeconds(draft, 'b', '2026-09-23')).toBe(180)
    expect(guestSessionSeconds(draft, 'p', '2026-09-23')).toBe(0)
    expect(guestTimerProgress({ targetValue: 3, targetUnit: 'minutes' }, 180).done).toBe(true)
    expect(guestTimerProgress({ targetValue: 2, targetUnit: 'minutes' }, 0).done).toBe(false)
  })

  it('drops a stale draft on load', () => {
    const storage = memoryStorage()
    const stale = createGuestDraft(new Date(Date.now() - GUEST_DRAFT_TTL_MS - 5000), 'UTC')
    storage.setItem(GUEST_DRAFT_KEY, JSON.stringify(stale))
    expect(loadGuestDraft()).toBeNull()
    expect(storage.getItem(GUEST_DRAFT_KEY)).toBeNull()
  })

  it('drops a retired habit such as Sleep so it is no longer selected', () => {
    const storage = memoryStorage()
    const draft = createGuestDraft(new Date(), 'UTC')
    draft.activities = [
      { ...activity('sleep', 'Sleep earlier'), templateId: 'sleep' },
      { ...activity('read', 'Reading'), templateId: 'reading' },
    ]
    draft.gapAnswer = { sleep: 'a few days', read: 'a week' }
    draft.logs = [
      {
        localActivityId: 'sleep',
        startedAt: '2026-09-22T18:00:00.000Z',
        durationSeconds: 60,
        date: '2026-09-22',
      },
    ]
    storage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft))

    const loaded = loadGuestDraft()
    expect(loaded?.activities.map((item) => item.templateId)).toEqual(['reading'])
    expect(loaded?.gapAnswer).toEqual({ read: 'a week' })
    expect(loaded?.logs).toEqual([])
    expect(JSON.parse(storage.getItem(GUEST_DRAFT_KEY) ?? '{}').activities).toHaveLength(1)
  })

  it('keeps an old Guitar pick selected as Music', () => {
    const storage = memoryStorage()
    const draft = createGuestDraft(new Date(), 'UTC')
    draft.activities = [{ ...activity('g', 'Guitar'), emoji: '🎸', templateId: 'guitar' }]
    storage.setItem(GUEST_DRAFT_KEY, JSON.stringify(draft))

    const loaded = loadGuestDraft()
    expect(loaded?.activities[0]?.templateId).toBe('music')
    expect(loaded?.activities[0]?.name).toBe('Music')
    expect(loaded?.activities[0]?.emoji).toBe('🎵')
  })

  it('clear removes the draft', () => {
    memoryStorage()
    ensureGuestDraft('UTC')
    clearGuestDraft()
    expect(loadGuestDraft()).toBeNull()
  })

  it('merge payload keeps timestamps and drops extra personal fields', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, activity('a', 'Reading'))
    draft = appendGuestLog(draft, {
      localActivityId: 'a',
      startedAt: '2026-09-22T18:00:00.000Z',
      durationSeconds: 120,
      date: '2026-09-22',
    })
    const payload = guestDraftToPayload(draft)
    expect(payload.logs[0]?.startedAt).toBe('2026-09-22T18:00:00.000Z')
    expect(payload).not.toHaveProperty('email')
    expect(JSON.stringify(payload)).not.toContain('note')
  })
})
