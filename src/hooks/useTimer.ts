import { useCallback, useEffect, useState } from 'react'
import { todayLocalDate } from '../lib/dates'
import { computeElapsedSeconds } from '../lib/timer'
import {
  clearActiveTimer,
  isActiveTimerStale,
  loadActiveTimer,
  saveActiveTimer,
  type ActiveTimerState,
} from '../lib/timerStorage'

export function useTimer(
  activeActivityIds: readonly string[] = [],
  today = todayLocalDate(),
  tickMs = 250,
) {
  const [active, setActive] = useState<ActiveTimerState | null>(() => {
    const stored = loadActiveTimer()
    if (!stored) return null
    if (stored.date !== todayLocalDate()) {
      clearActiveTimer()
      return null
    }
    return stored
  })
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const stored = loadActiveTimer()
    if (!stored) {
      setActive(null)
      return
    }
    if (
      activeActivityIds.length > 0 &&
      isActiveTimerStale(stored, today, activeActivityIds)
    ) {
      clearActiveTimer()
      setActive(null)
      return
    }
    setActive(stored)
  }, [activeActivityIds, today])

  useEffect(() => {
    if (!active || active.status !== 'running') return
    const id = window.setInterval(() => setNowMs(Date.now()), tickMs)
    return () => window.clearInterval(id)
  }, [active, tickMs])

  const elapsedSeconds = active
    ? computeElapsedSeconds({
        status: active.status,
        accumulatedSeconds: active.accumulatedSeconds,
        segmentStartedAt: active.segmentStartedAt,
        nowMs,
      })
    : 0

  const start = useCallback((activityId: string) => {
    const existing = loadActiveTimer()
    if (existing && existing.activityId !== activityId) {
      throw new Error('Stop the current timer before starting another activity.')
    }
    if (existing && existing.activityId === activityId) {
      setActive(existing)
      return
    }

    const now = new Date().toISOString()
    const next: ActiveTimerState = {
      activityId,
      date: todayLocalDate(),
      status: 'running',
      accumulatedSeconds: 0,
      segmentStartedAt: now,
      sessionStartedAt: now,
    }
    saveActiveTimer(next)
    setActive(next)
    setNowMs(Date.now())
  }, [])

  const pause = useCallback(() => {
    setActive((prev) => {
      if (!prev || prev.status !== 'running') return prev
      const elapsed = computeElapsedSeconds({
        status: 'running',
        accumulatedSeconds: prev.accumulatedSeconds,
        segmentStartedAt: prev.segmentStartedAt,
      })
      const next: ActiveTimerState = {
        ...prev,
        status: 'paused',
        accumulatedSeconds: elapsed,
        segmentStartedAt: null,
      }
      saveActiveTimer(next)
      return next
    })
  }, [])

  const resume = useCallback(() => {
    setActive((prev) => {
      if (!prev || prev.status !== 'paused') return prev
      const next: ActiveTimerState = {
        ...prev,
        status: 'running',
        segmentStartedAt: new Date().toISOString(),
      }
      saveActiveTimer(next)
      setNowMs(Date.now())
      return next
    })
  }, [])

  const stop = useCallback((): {
    activityId: string
    date: string
    durationSeconds: number
    startedAt: string
  } | null => {
    const prev = loadActiveTimer()
    if (!prev) return null

    const durationSeconds = computeElapsedSeconds({
      status: prev.status,
      accumulatedSeconds: prev.accumulatedSeconds,
      segmentStartedAt: prev.segmentStartedAt,
    })

    clearActiveTimer()
    setActive(null)

    return {
      activityId: prev.activityId,
      date: prev.date,
      durationSeconds: Math.max(1, durationSeconds),
      startedAt: prev.sessionStartedAt,
    }
  }, [])

  const discard = useCallback(() => {
    clearActiveTimer()
    setActive(null)
  }, [])

  return {
    active,
    elapsedSeconds,
    start,
    pause,
    resume,
    stop,
    discard,
  }
}
