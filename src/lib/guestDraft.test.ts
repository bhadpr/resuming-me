import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  GUEST_DRAFT_KEY,
  GUEST_DRAFT_TTL_MS,
  appendGuestLog,
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

  it('caps activities at 3 and keeps answers across reload', () => {
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
    expect(loaded?.activities.map((a) => a.name)).toEqual(['Reading', 'Walk', 'Meditate'])
    expect(loaded?.gapAnswer).toEqual({ a: 'a few days' })
    expect(loaded?.slipAnswer).toEqual(['Evenings', 'Weekends'])
  })

  it('does not store a session under 30 seconds', () => {
    memoryStorage()
    let draft = ensureGuestDraft('UTC')
    draft = upsertGuestActivity(draft, activity('a'))
    draft = appendGuestLog(draft, {
      localActivityId: 'a',
      startedAt: '2026-09-22T18:00:00.000Z',
      durationSeconds: 12,
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
