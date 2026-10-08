import { useCallback, useEffect, useState } from 'react'
import {
  DISTANCE_ACCESS_CHANGED,
  distanceAccess,
  readSessionDistance,
  recheckDistanceAccess,
  requestDistanceAccess,
  sessionWindow,
  type DistanceAccess,
  type DistanceSession,
} from '../lib/healthDistance'

/** Total Health Connect distance across these sessions (Android only). */
export function useSessionDistance(entries: DistanceSession[], readTotal = true) {
  const timed = entries.filter((entry) => sessionWindow(entry) != null)
  const key = readTotal
    ? JSON.stringify(
        timed.map(({ id, type, started_at, duration_seconds, created_at }) => ({
          id,
          type,
          started_at,
          duration_seconds,
          created_at,
        })),
      )
    : ''
  const active = timed.length > 0
  const [access, setAccess] = useState<DistanceAccess>('unknown')
  const [meters, setMeters] = useState<number | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!active) return
    let cancelled = false
    const refresh = () => {
      void distanceAccess().then((next) => {
        if (!cancelled) setAccess(next)
      })
    }
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      recheckDistanceAccess()
      refresh()
      setTick((n) => n + 1)
    }
    refresh()
    window.addEventListener(DISTANCE_ACCESS_CHANGED, refresh)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      window.removeEventListener(DISTANCE_ACCESS_CHANGED, refresh)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active])

  useEffect(() => {
    if (!active || !key || access !== 'granted') return
    let cancelled = false
    const sessions = JSON.parse(key) as DistanceSession[]
    void Promise.all(sessions.map(readSessionDistance)).then((values) => {
      if (cancelled) return
      const known = values.filter((value): value is number => value != null)
      setMeters(known.length ? known.reduce((sum, value) => sum + value, 0) : null)
    })
    return () => {
      cancelled = true
    }
  }, [active, access, key, tick])

  const connect = useCallback(() => {
    void requestDistanceAccess()
  }, [])

  return {
    access: active ? access : 'unavailable',
    meters: active && access === 'granted' ? meters : null,
    connect,
  }
}
