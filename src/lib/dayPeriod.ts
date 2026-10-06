import { habitTemplateId } from '../data/habitArt'

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'anytime'

export const DAY_PERIODS: readonly DayPeriod[] = ['morning', 'afternoon', 'evening', 'anytime']

export const DAY_PERIOD_CHANGED = 'resuming-day-period-changed'

const STORAGE_KEY = 'resuming-vital-when'

/** Morning before 12 pm, afternoon 12–5 pm, evening from 5 pm. */
export function periodForHour(hour: number | null | undefined): DayPeriod {
  if (hour == null) return 'anytime'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

/** Reads a stored "usually when" note. Older free text like "after dinner" still maps. */
export function parseDayPeriod(text: string | null | undefined): DayPeriod | null {
  const value = text?.trim().toLowerCase()
  if (!value) return null
  if (value === 'anytime' || value === 'any time') return 'anytime'
  if (/morning|breakfast|sunrise|wake|dawn/.test(value)) return 'morning'
  if (/afternoon|lunch|noon|midday/.test(value)) return 'afternoon'
  if (/evening|night|dinner|bed|sunset/.test(value)) return 'evening'
  return null
}

const TEMPLATE_PERIODS: Record<string, DayPeriod> = {
  walk: 'morning',
  running: 'morning',
  exercise: 'morning',
  stretching: 'morning',
  meditate: 'morning',
  relaxation: 'morning',
  bhastrika: 'morning',
  kapalabhati: 'morning',
  anuloma_viloma: 'morning',
  bhramari: 'morning',
  weight: 'morning',
  blood_pressure: 'morning',
  heart_rate: 'morning',
  rejuvenation: 'evening',
  prayer: 'evening',
  reading: 'evening',
  journaling: 'evening',
}

export function defaultPeriodFor(item: {
  templateId?: string | null
  template_id?: string | null
  name?: string | null
}): DayPeriod {
  const id = habitTemplateId(item)
  return (id && TEMPLATE_PERIODS[id]) || 'anytime'
}

/** An activity's part of the day: what the person chose, else the habit's usual time. */
export function activityPeriod(item: {
  usuallyWhen?: string | null
  usually_when?: string | null
  templateId?: string | null
  template_id?: string | null
  name?: string | null
}): DayPeriod {
  return parseDayPeriod(item.usuallyWhen ?? item.usually_when) ?? defaultPeriodFor(item)
}

export type TodayItemKind = 'medicine' | 'activity' | 'reminder' | 'vital'

const KIND_ORDER: Record<TodayItemKind, number> = { medicine: 0, activity: 1, reminder: 2, vital: 3 }

export interface TimedItem {
  period: DayPeriod
  kind: TodayItemKind
  /** Minutes after midnight, for items with a clock time. */
  minutes?: number | null
}

/** Today's items by part of the day: medicines, then activities, reminders, vitals. Empty parts are left out. */
export function groupByPeriod<T extends TimedItem>(items: readonly T[]): { period: DayPeriod; items: T[] }[] {
  return DAY_PERIODS.map((period) => ({
    period,
    items: items
      .filter((item) => item.period === period)
      .sort((a, b) => {
        const kind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
        if (kind !== 0) return kind
        if (a.minutes == null || b.minutes == null) return (a.minutes == null ? 1 : 0) - (b.minutes == null ? 1 : 0)
        return a.minutes - b.minutes
      }),
  })).filter((group) => group.items.length > 0)
}

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function loadVitalPeriods(): Record<string, DayPeriod> {
  try {
    const parsed = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const out: Record<string, DayPeriod> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (DAY_PERIODS.includes(value as DayPeriod)) out[id] = value as DayPeriod
    }
    return out
  } catch {
    return {}
  }
}

/** Vitals have no server field for this, so the choice stays on this device. */
export function vitalPeriod(metric: { id: string; template_id?: string | null; name?: string | null }): DayPeriod {
  return loadVitalPeriods()[metric.id] ?? defaultPeriodFor(metric)
}

export function setVitalPeriod(metricId: string, period: DayPeriod): void {
  const store = storage()
  if (!store) return
  try {
    store.setItem(STORAGE_KEY, JSON.stringify({ ...loadVitalPeriods(), [metricId]: period }))
    window.dispatchEvent(new Event(DAY_PERIOD_CHANGED))
  } catch {
    // Storage full or blocked: the default time still applies.
  }
}
