export const CHECKIN_DAYS = [2, 3, 7] as const
export type CheckinDay = (typeof CHECKIN_DAYS)[number]

/** Local hours when we stay quiet: 22:00–07:00. */
export function isQuietHour(hour: number): boolean {
  return hour >= 22 || hour < 7
}

export function localParts(
  instant: Date,
  timeZone: string,
): { date: string; hour: number } {
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
  const hour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone,
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(instant),
  )
  return { date, hour: Number.isFinite(hour) ? hour : 0 }
}

function daySpan(fromDate: string, toDate: string): number {
  const from = Date.parse(`${fromDate}T00:00:00Z`)
  const to = Date.parse(`${toDate}T00:00:00Z`)
  return Math.round((to - from) / 86_400_000)
}

export type CheckinDecisionInput = {
  onboardedAt: Date
  now: Date
  timeZone: string
  optedOut: boolean
  /** day_n values already sent */
  sentDays: readonly number[]
  unopenedCount: number
  /** A check-in already went out on the user's local today. */
  sentToday: boolean
}

/**
 * At most one check-in a day, only on day 2, 3, or 7,
 * never during quiet hours, and never after 3 unopened sends.
 */
export function checkinDue(input: CheckinDecisionInput): CheckinDay | null {
  if (input.optedOut) return null
  if (input.unopenedCount >= 3) return null
  if (input.sentToday) return null

  const zone = input.timeZone || 'UTC'
  const now = localParts(input.now, zone)
  if (isQuietHour(now.hour)) return null

  const started = localParts(input.onboardedAt, zone)
  const span = daySpan(started.date, now.date)
  if (span !== 2 && span !== 3 && span !== 7) return null
  if (input.sentDays.includes(span)) return null
  return span
}

export function checkinCopy(day: CheckinDay): { subject: string; text: string } {
  if (day === 2) {
    return {
      subject: 'Day 2 — one small resume is enough',
      text: 'Day 2. One small resume is enough. Open Today and pick the smallest one.',
    }
  }
  if (day === 3) {
    return {
      subject: 'Still here on day 3',
      text: 'Still here. Open Today and pick the smallest one.',
    }
  }
  return {
    subject: 'A week of Resuming',
    text: 'A week in. Insights can start to show your pattern.',
  }
}
