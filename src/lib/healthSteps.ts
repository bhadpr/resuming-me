import { Capacitor } from '@capacitor/core'
import type { HealthConnectPlugin } from '@devmaxime/capacitor-health-connect'

export type PhoneSteps =
  | { status: 'count'; steps: number }
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
