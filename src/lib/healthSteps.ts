import { Capacitor } from '@capacitor/core'
import type { HealthConnectPlugin } from '@devmaxime/capacitor-health-connect'
import { addDays, todayLocalDate } from './dates'
import { track } from './track'

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
  const platform = Capacitor.getPlatform()
  return platform === 'android' || platform === 'ios'
}

/** Apple Health never says the person refused. A refusal arrives as zero steps. */
export function appleStepRead(available: boolean, asked: boolean, steps: number): PhoneSteps {
  if (!available) return { status: 'unavailable' }
  if (!asked) return { status: 'needs-permission' }
  return { status: 'count', steps: Math.max(0, Math.round(steps)) }
}

export function fillStepDays(days: readonly StepDay[], now: Date, count: number): StepDay[] {
  const today = todayLocalDate(now)
  const byDate = new Map(days.map((day) => [day.date, day.steps]))
  return Array.from({ length: count }, (_, index) => {
    const date = addDays(today, index - count + 1)
    return { date, steps: Math.max(0, Math.round(byDate.get(date) ?? 0)) }
  })
}

export function showAppleZeroStepsHint(platform: string, steps: number): boolean {
  return platform === 'ios' && steps === 0
}

export function showAppleZeroWeekHint(platform: string, days: readonly { steps: number }[]): boolean {
  return platform === 'ios' && days.some((day) => day.steps === 0)
}

async function requestAppleSteps(now: Date): Promise<PhoneSteps> {
  try {
    const { HealthSteps } = await import('./healthStepsPlugin')
    const { available } = await HealthSteps.availability()
    if (!available) {
      track('health_permission', { kind: 'steps', result: 'unavailable' })
      return { status: 'unavailable' }
    }
    await HealthSteps.requestAuthorization()
    track('health_permission', { kind: 'steps', result: 'granted' })
    const result = await readAppleSteps(now, 1)
    return result.status === 'days' ? { status: 'unavailable' } : result
  } catch {
    track('health_permission', { kind: 'steps', result: 'unavailable' })
    return { status: 'unavailable' }
  }
}

async function readAppleSteps(now: Date, count: number): Promise<PhoneSteps | PhoneStepsWeek> {
  try {
    const { HealthSteps } = await import('./healthStepsPlugin')
    const { available } = await HealthSteps.availability()
    const { asked } = await HealthSteps.authorization()
    if (!available) return count === 1 ? appleStepRead(false, asked, 0) : { status: 'unavailable' }
    if (!asked) return count === 1 ? appleStepRead(true, false, 0) : { status: 'needs-permission' }
    const today = todayLocalDate(now)
    const [year, month, day] = addDays(today, 1 - count).split('-').map(Number)
    const start = new Date(year, month - 1, day)
    const { days } = await HealthSteps.query({
      start: start.toISOString(),
      end: now.toISOString(),
    })
    const filled = fillStepDays(days, now, count)
    if (count === 1) return { status: 'count', steps: filled[0]?.steps ?? 0 }
    return { status: 'days', days: filled }
  } catch {
    return { status: 'unavailable' }
  }
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

/** Today's steps from Health Connect on Android, or Apple Health on iPhone. */
export async function readPhoneSteps(now = new Date()): Promise<PhoneSteps> {
  if (Capacitor.getPlatform() === 'ios') {
    const result = await readAppleSteps(now, 1)
    return result.status === 'days' ? { status: 'unavailable' } : result
  }
  if (Capacitor.getPlatform() !== 'android') return { status: 'unavailable' }
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
  if (Capacitor.getPlatform() === 'ios') return requestAppleSteps(now)
  if (Capacitor.getPlatform() !== 'android') return { status: 'unavailable' }
  try {
    const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
    const { availability } = await HealthConnect.checkAvailability()
    if (availability !== 'Available') {
      track('health_permission', { kind: 'steps', result: 'unavailable' })
      return { status: 'unavailable' }
    }
    const next = await HealthConnect.requestPermissions({ read: ['Steps'], write: [] })
    if (!next.read.includes('Steps')) {
      track('health_permission', { kind: 'steps', result: 'denied' })
      return { status: 'denied' }
    }
    track('health_permission', { kind: 'steps', result: 'granted' })
    return await aggregateToday(HealthConnect, now)
  } catch {
    track('health_permission', { kind: 'steps', result: 'unavailable' })
    return { status: 'unavailable' }
  }
}

/**
 * Daily step totals for the last `count` days. Health Connect lets the app read
 * up to 30 days before Steps was first allowed, so a week needs no extra permission.
 */
export async function readPhoneStepsWeek(now = new Date(), count = 7): Promise<PhoneStepsWeek> {
  if (Capacitor.getPlatform() === 'ios') {
    const result = await readAppleSteps(now, count)
    return result.status === 'count' ? { status: 'unavailable' } : result
  }
  if (Capacitor.getPlatform() !== 'android') return { status: 'unavailable' }
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
