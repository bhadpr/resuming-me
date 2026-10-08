import { Capacitor } from '@capacitor/core'
import type { HealthConnectPlugin } from '@devmaxime/capacitor-health-connect'
import { addDays, todayLocalDate } from './dates'

export type PhoneSteps =
  | { status: 'count'; steps: number }
  | { status: 'unavailable' }
  | { status: 'denied' }
  | { status: 'needs-permission' }

export interface StepDay {
  date: string
  steps: number
}

export type PhoneStepsWeek =
  | { status: 'days'; days: StepDay[] }
  | { status: 'unavailable' }
  | { status: 'denied' }
  | { status: 'needs-permission' }

export function phoneStepsSupported(): boolean {
  return Capacitor.getPlatform() === 'android'
}

function localDayRange(now: Date): { start: string; end: string } {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return { start: start.toISOString(), end: now.toISOString() }
}

async function aggregateToday(
  health: HealthConnectPlugin,
  now: Date,
): Promise<PhoneSteps> {
  const range = localDayRange(now)
  const result = await health.aggregateRecords({
    start: range.start,
    end: range.end,
    type: 'Steps',
    groupBy: 'day',
  })
  const steps = result.aggregates.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
  return { status: 'count', steps: Math.max(0, Math.round(steps)) }
}

/** One total per local calendar day, oldest first, ending today. */
async function aggregateDays(
  health: HealthConnectPlugin,
  now: Date,
  count: number,
): Promise<StepDay[]> {
  const today = todayLocalDate(now)
  const dates = Array.from({ length: count }, (_, i) => addDays(today, i - count + 1))
  return Promise.all(
    dates.map(async (date) => {
      const [y, m, d] = date.split('-').map(Number)
      const start = new Date(y, m - 1, d)
      const next = new Date(y, m - 1, d + 1)
      const end = next < now ? next : now
      const result = await health.aggregateRecords({
        start: start.toISOString(),
        end: end.toISOString(),
        type: 'Steps',
        groupBy: 'day',
      })
      const steps = result.aggregates.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
      return { date, steps: Math.max(0, Math.round(steps)) }
    }),
  )
}

/** Today's steps from Health Connect. Web and iPhone stay unavailable. */
export async function readPhoneSteps(now = new Date()): Promise<PhoneSteps> {
  if (!phoneStepsSupported()) return { status: 'unavailable' }
  try {
    const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
    const { availability } = await HealthConnect.checkAvailability()
    if (availability !== 'Available') return { status: 'unavailable' }
    const granted = await HealthConnect.getGrantedPermissions()
    if (!granted.read.includes('Steps')) return { status: 'needs-permission' }
    return await aggregateToday(HealthConnect, now)
  } catch {
    return { status: 'unavailable' }
  }
}

export async function requestPhoneSteps(now = new Date()): Promise<PhoneSteps> {
  if (!phoneStepsSupported()) return { status: 'unavailable' }
  try {
    const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
    const { availability } = await HealthConnect.checkAvailability()
    if (availability !== 'Available') return { status: 'unavailable' }
    const next = await HealthConnect.requestPermissions({ read: ['Steps'], write: [] })
    if (!next.read.includes('Steps')) return { status: 'denied' }
    return await aggregateToday(HealthConnect, now)
  } catch {
    return { status: 'unavailable' }
  }
}

/**
 * Daily step totals for the last `count` days. Health Connect lets the app read
 * up to 30 days before Steps was first allowed, so a week needs no extra permission.
 */
export async function readPhoneStepsWeek(now = new Date(), count = 7): Promise<PhoneStepsWeek> {
  if (!phoneStepsSupported()) return { status: 'unavailable' }
  try {
    const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
    const { availability } = await HealthConnect.checkAvailability()
    if (availability !== 'Available') return { status: 'unavailable' }
    const granted = await HealthConnect.getGrantedPermissions()
    if (!granted.read.includes('Steps')) return { status: 'needs-permission' }
    return { status: 'days', days: await aggregateDays(HealthConnect, now, count) }
  } catch {
    return { status: 'unavailable' }
  }
}

export interface StepWeekSummary {
  metDays: number
  average: number
  best: number
}

/** Today is still in progress, so the average leaves it out unless it already beats the goal. */
export function summarizeStepWeek(days: StepDay[], goal: number, today = todayLocalDate()): StepWeekSummary {
  const metDays = days.filter((day) => day.steps >= goal).length
  const finished = days.filter((day) => day.date !== today || day.steps >= goal)
  const average = finished.length
    ? Math.round(finished.reduce((sum, day) => sum + day.steps, 0) / finished.length)
    : 0
  const best = days.reduce((max, day) => Math.max(max, day.steps), 0)
  return { metDays, average, best }
}
