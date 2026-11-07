import { Capacitor } from '@capacitor/core'
import { challengeDayWindow } from './challengeScore'
import { saveWalkingSteps, walkingSyncDays } from './challenges'

/**
 * On open, send the raw Health Connect total for every walking day that is still open.
 * A later open replaces the total. The server caps it. Web and iPhone have nothing to send.
 */
export async function syncWalkingChallenges(now = new Date()): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  const days = await walkingSyncDays()
  if (days.length === 0) return

  const { HealthConnect } = await import('@devmaxime/capacitor-health-connect')
  const { availability } = await HealthConnect.checkAvailability()
  if (availability !== 'Available') return
  const granted = await HealthConnect.getGrantedPermissions()
  if (!granted.read.includes('Steps')) return

  const readings = new Map<string, number>()
  for (const item of days) {
    const key = `${item.timeZone}|${item.day}`
    if (readings.has(key)) continue
    const window = challengeDayWindow(item.day, item.timeZone)
    const end = window.end < now ? window.end : now
    if (end <= window.start) continue
    const result = await HealthConnect.aggregateRecords({
      start: window.start.toISOString(),
      end: end.toISOString(),
      type: 'Steps',
      groupBy: 'day',
    })
    const steps = result.aggregates.reduce((sum, row) => sum + (Number(row.value) || 0), 0)
    readings.set(key, Math.max(0, Math.round(steps)))
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
