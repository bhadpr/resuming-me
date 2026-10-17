import { describe, expect, it } from 'vitest'
import { createGuestDraft, type GuestActivity } from './guestDraft'
import { guestDraftInsights } from './guestInsights'

function habit(localId: string, templateId: string | null, name: string): GuestActivity {
  return {
    localId,
    name,
    emoji: '•',
    type: 'daily',
    trackingMode: templateId === 'steps' ? 'count' : 'timer',
    targetValue: templateId === 'steps' ? 8000 : 10,
    targetUnit: templateId === 'weight' ? 'kg' : templateId === 'steps' ? 'steps' : 'min',
    weeklyTarget: null,
    deadline: null,
    templateId,
    why: null,
    usuallyWhen: null,
  }
}

describe('guest insights', () => {
  it('keeps habits and steps as activities and typed numbers as metrics', () => {
    const draft = createGuestDraft(new Date('2026-10-10T00:00:00.000Z'))
    draft.activities = [habit('walk', 'walk', 'Walk'), habit('steps', 'steps', 'Steps'), habit('wt', 'weight', 'Weight')]
    draft.logs = [
      {
        localActivityId: 'walk',
        startedAt: '2026-10-15T10:00:00.000Z',
        durationSeconds: 600,
        date: '2026-10-15',
      },
      {
        localActivityId: 'steps',
        startedAt: '2026-10-15T18:00:00.000Z',
        durationSeconds: 0,
        date: '2026-10-15',
        kind: 'count',
      },
    ]
    draft.readings = [{ localActivityId: 'wt', date: '2026-10-15', value: 70, secondaryValue: null }]

    const mapped = guestDraftInsights(draft)
    expect(mapped.activities.map((activity) => activity.template_id)).toEqual(['walk', 'steps'])
    expect(mapped.entries.map((entry) => entry.type)).toEqual(['session', 'completed'])
    expect(mapped.metrics.map((metric) => metric.unit)).toEqual(['kg'])
    expect(mapped.metricEntries[0]?.value).toBe(70)
  })
})
