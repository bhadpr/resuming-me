import { habitTemplateId } from '../data/habitArt'

export type DayPeriod = 'morning' | 'afternoon' | 'evening' | 'anytime'

export const DAY_PERIODS: readonly DayPeriod[] = ['morning', 'afternoon', 'evening', 'anytime']
/** Morning before 12 pm, afternoon 12–5 pm, evening from 5 pm. */
export function periodForHour(hour: number | null | undefined): DayPeriod {
  if (hour == null) return 'anytime'
  if (hour < 12) return 'morning'
  if (hour < 17) return 'afternoon'
  return 'evening'
}

/** True once that part of the day is over, e.g. Morning during the afternoon. Anytime never is. */
export function isPeriodPast(period: DayPeriod, now: Date = new Date()): boolean {
  if (period === 'anytime') return false
  return DAY_PERIODS.indexOf(period) < DAY_PERIODS.indexOf(periodForHour(now.getHours()))
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