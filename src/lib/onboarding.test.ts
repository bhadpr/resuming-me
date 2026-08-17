import { describe, it, expect } from 'vitest'
import {
  applyDailyCadence,
  applyDailyCount,
  applyDeadlineDate,
  applyDraftName,
  applyRepeatingElse,
  applySessionMinutes,
  applyWeeklyCount,
  applyWeeklyTimes,
  chipAddsImmediately,
  draftFromChip,
  draftSummary,
  emptyNamedDraft,
  needsOnboarding,
  sessionSizeOptions,
  shouldShowInstallTip,
  STARTER_CHIPS,
  thisWeekDeadline,
  twoWeekDeadline,
  uniqueChipAlreadyAdded,
} from './onboarding'
import { validateActivityInput } from './activities'

describe('STARTER_CHIPS', () => {
  it('offers one postponement at a time, including else and a due-date task', () => {
    expect(STARTER_CHIPS.map((c) => c.id)).toEqual([
      'read',
      'walk',
      'meditation',
      'yoga',
      'run',
      'learn_ai',
      'kids',
      'subscriptions',
      'deadline',
      'else',
    ])
    expect(STARTER_CHIPS.find((c) => c.id === 'deadline')?.label).toBe(
      'A task with a due date',
    )
  })
})

describe('draftFromChip', () => {
  it('starts read, walk, meditation, yoga, run, and learn AI as small timers', () => {
    expect(draftFromChip('read')?.input.targetValue).toBe(2)
    expect(draftFromChip('walk')?.input.targetValue).toBe(5)
    expect(draftFromChip('meditation')?.name).toBe('Meditation')
    expect(draftFromChip('yoga')?.name).toBe('Yoga')
    expect(draftFromChip('run')?.name).toBe('Run')
    expect(draftFromChip('learn_ai')?.name).toBe('Learn AI')
  })

  it('lets play with kids be twice a day or a few times a week', () => {
    const daily = applyDailyCount(draftFromChip('kids')!, 2)
    expect(daily.input.type).toBe('daily')
    expect(daily.input.trackingMode).toBe('count')
    expect(daily.input.targetValue).toBe(2)
    expect(draftSummary(daily)).toBe('Daily · 2×')
    expect(validateActivityInput(daily.input)).toBeNull()

    const weekly = applyWeeklyCount(draftFromChip('kids')!, 3)
    expect(weekly.input.type).toBe('weekly_n')
    expect(weekly.input.trackingMode).toBe('count')
    expect(weekly.input.weeklyTarget).toBe(3)
    expect(draftSummary(weekly)).toBe('Weekly · 3× per week')
    expect(validateActivityInput(weekly.input)).toBeNull()
  })

  it('does not add play with kids until cadence is chosen', () => {
    expect(chipAddsImmediately('kids')).toBe(false)
    expect(chipAddsImmediately('subscriptions')).toBe(true)
  })

  it('adds review subscriptions as once a month', () => {
    const subs = draftFromChip('subscriptions')!
    expect(subs.input.type).toBe('monthly')
    expect(draftSummary(subs)).toBe('Once a month')
    expect(validateActivityInput(subs.input)).toBeNull()
  })

  it('produces valid activity inputs', () => {
    for (const id of [
      'read',
      'walk',
      'meditation',
      'yoga',
      'run',
      'learn_ai',
      'kids',
      'subscriptions',
    ] as const) {
      const draft = draftFromChip(id)
      expect(draft).not.toBeNull()
      expect(validateActivityInput(draft!.input)).toBeNull()
    }
  })

  it('does not invent a taxes template for deadline or else', () => {
    expect(draftFromChip('deadline')).toBeNull()
    expect(draftFromChip('else')).toBeNull()
  })
})

describe('session sizes', () => {
  it('lets read keep 10 minutes as the usual target', () => {
    const draft = applySessionMinutes(draftFromChip('read')!, 10)
    expect(draft.input.type).toBe('daily')
    expect(draft.input.targetValue).toBe(10)
    expect(validateActivityInput(draft.input)).toBeNull()
    expect(sessionSizeOptions('read').map((o) => o.minutes)).toEqual([2, 10])
  })

  it('lets read be twice a week for 10 minutes', () => {
    let draft = applyWeeklyTimes(draftFromChip('read')!, 2)
    draft = applySessionMinutes(draft, 10)
    expect(draft.input.type).toBe('weekly_n')
    expect(draft.input.trackingMode).toBe('timer')
    expect(draft.input.weeklyTarget).toBe(2)
    expect(draft.input.targetValue).toBe(10)
    expect(draftSummary(draft)).toBe('Weekly · 2× · 10 min')
    expect(validateActivityInput(draft.input)).toBeNull()
  })

  it('can switch a weekly draft back to daily minutes', () => {
    let draft = applyWeeklyTimes(draftFromChip('read')!, 2)
    draft = applyDailyCadence(draft)
    draft = applySessionMinutes(draft, 10)
    expect(draft.input.type).toBe('daily')
    expect(draft.input.weeklyTarget).toBeNull()
    expect(draft.input.targetValue).toBe(10)
  })

  it('gives custom repeating activities a 5 and 10 minute start', () => {
    expect(sessionSizeOptions('else').map((o) => o.minutes)).toEqual([5, 10])
  })
})

describe('something else', () => {
  it('names a repeating timer', () => {
    let draft = applyDraftName(emptyNamedDraft('else', ''), 'Practice guitar')
    draft = applyRepeatingElse(draft, 'timer')
    expect(draft.input.name).toBe('Practice guitar')
    expect(draft.input.trackingMode).toBe('timer')
    expect(draft.input.targetValue).toBe(5)
    expect(validateActivityInput(draft.input)).toBeNull()
  })

  it('asks how many times for a weekly repeating activity, then minutes', () => {
    let draft = applyDraftName(emptyNamedDraft('else'), 'Practice guitar')
    draft = applyRepeatingElse(draft, 'weekly', 3)
    draft = applySessionMinutes(draft, 10)
    expect(draft.input.type).toBe('weekly_n')
    expect(draft.input.trackingMode).toBe('timer')
    expect(draft.input.weeklyTarget).toBe(3)
    expect(draft.input.targetValue).toBe(10)
    expect(validateActivityInput(draft.input)).toBeNull()
  })

  it('can fork into a deadline', () => {
    let draft = applyDraftName(emptyNamedDraft('else', 'Visa paperwork'), 'Visa paperwork')
    draft = applyDeadlineDate(draft, '2026-08-31')
    expect(draft.input.type).toBe('deadline')
    expect(draft.input.deadline).toBe('2026-08-31')
    expect(validateActivityInput(draft.input)).toBeNull()
  })
})

describe('deadline dates', () => {
  it('uses Sunday this week when that is still ahead', () => {
    expect(thisWeekDeadline('2026-08-17')).toBe('2026-08-23')
  })

  it('rolls a week when today is already Sunday', () => {
    expect(thisWeekDeadline('2026-08-23')).toBe('2026-08-30')
  })

  it('sets two weeks out', () => {
    expect(twoWeekDeadline('2026-08-17')).toBe('2026-08-31')
  })
})

describe('draftSummary', () => {
  it('describes a deadline cadence', () => {
    let draft = applyDraftName(emptyNamedDraft('deadline'), 'Call the dentist')
    draft = applyDeadlineDate(draft, '2026-08-31')
    draft = { ...draft, deadlineCadence: 'few_days' }
    expect(draftSummary(draft)).toMatch(/remind every few days/)
  })
})

describe('uniqueChipAlreadyAdded', () => {
  it('blocks a second Read but allows another deadline', () => {
    const added = [draftFromChip('read')!]
    expect(uniqueChipAlreadyAdded('read', added)).toBe(true)
    expect(uniqueChipAlreadyAdded('deadline', added)).toBe(false)
  })
})

describe('needsOnboarding', () => {
  it('is true when empty and not dismissed', () => {
    expect(needsOnboarding(0, false)).toBe(true)
  })

  it('is false when dismissed or already has activities', () => {
    expect(needsOnboarding(0, true)).toBe(false)
    expect(needsOnboarding(2, false)).toBe(false)
  })
})

describe('shouldShowInstallTip', () => {
  it('shows only for iOS Safari browser (not installed)', () => {
    expect(
      shouldShowInstallTip({
        dismissed: false,
        standalone: false,
        iosSafari: true,
      }),
    ).toBe(true)
    expect(
      shouldShowInstallTip({
        dismissed: false,
        standalone: true,
        iosSafari: true,
      }),
    ).toBe(false)
  })
})
