import { Capacitor } from '@capacitor/core'
import { challengeDayWindow } from './challengeScore'
import { saveWalkingSteps, walkingSyncDays } from './challenges'
import { HealthSteps } from './healthStepsPlugin'

/**
 * On open, send the raw step total for every walking day that is still open.
 * A later open replaces the total. The server caps it.
 * Android reads Health Connect. iPhone reads Apple Health.
 */
export async function syncWalkingChallenges(now = new Date()): Promise<void> {
  const platform = Capacitor.getPlatform()
  if (platform !== 'android' && platform !== 'ios') return
  const days = await walkingSyncDays()
  if (days.length === 0) return

  if (platform === 'android') {
    const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
    const { availability } = await HealthConnect.checkAvailability()
    if (availability !== 'Available') return
    const granted = await HealthConnect.getGrantedPermissions()
    if (!granted.read.includes('Steps')) return
  } else {
    const { available } = await HealthSteps.availability()
    if (!available) return
    const { asked } = await HealthSteps.authorization()
    if (!asked) return
  }

  const readings = new Map<string, number>()
  for (const item of days) {
    const key = `${item.timeZone}|${item.day}`
    if (readings.has(key)) continue
    const window = challengeDayWindow(item.day, item.timeZone)
    const end = window.end < now ? window.end : now
    if (end <= window.start) continue
    const steps =
      platform === 'android'
        ? await androidSteps(window.start, end)
        : await appleSteps(window.start, end)
    readings.set(key, steps)
  }

  const byCode = new Map<string, { day: string; raw: number }[]>()
  for (const item of days) {
    const raw = readings.get(`${item.timeZone}|${item.day}`)
    if (raw == null) continue
    const list = byCode.get(item.code) ?? []
    list.push({ day: item.day, raw })
    byCode.set(item.code, list)
  }
  await Promise.all([...byCode].map(([code, rows]) => saveWalkingSteps(code, rows)))
}

async function androidSteps(start: Date, end: Date): Promise<number> {
  const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
  const result = await HealthConnect.aggregateRecords({
    start: start.toISOString(),
    end: end.toISOString(),
    type: 'Steps',
    groupBy: 'day',
  })
  const steps = result.aggregates.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
  return Math.max(0, Math.round(steps))
}

async function appleSteps(start: Date, end: Date): Promise<number> {
  const result = await HealthSteps.query({
    start: start.toISOString(),
    end: end.toISOString(),
  })
  const steps = result.days.reduce((sum, day) => sum + (Number(day.steps) || 0), 0)
  return Math.max(0, Math.round(steps))
}
