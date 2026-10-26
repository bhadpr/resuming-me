import { localEventTime } from './sharedEvents'

/** The clock a phone should keep. A zoned list shifts to this phone. An unzoned list stays as stored. */
export function reminderClock(
  item: { day: string; hour: number | null; minute: number | null },
  timeZone: string | null | undefined,
  deviceZone?: string,
): { day: string; hour: number | null; minute: number | null } {
  const day = item.day.slice(0, 10)
  if (!timeZone || item.hour == null || item.minute == null) {
    return { day, hour: item.hour, minute: item.minute }
  }
  const local = localEventTime(
    { day, hour: item.hour, minute: item.minute, timeZone },
    deviceZone,
  )
  if (!local) return { day, hour: item.hour, minute: item.minute }
  return local
}
