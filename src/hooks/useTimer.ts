import { useCallback, useEffect, useState } from 'react'
import { todayLocalDate } from '../lib/dates'
import { computeElapsedSeconds } from '../lib/timer'
import {
  clearActiveTimer,
  isActiveTimerStale,
  loadActiveTimer,
  saveActiveTimer,
  type ActiveTimerState,
  type TimerStartOptions,
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

  const start = useCallback((activityId: string, options?: TimerStartOptions) => {
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
      ...(options && 'sessionTargetSeconds' in options
        ? { sessionTargetSeconds: options.sessionTargetSeconds }
        : {}),
      ...(options?.fromReentry ? { fromReentry: true } : {}),
    }
    saveActiveTimer(next)
    setActive(next)
    setNowMs(Date.now())
  }, [])

  const setSessionTarget = useCallback((sessionTargetSeconds: number | null) => {
    setActive((prev) => {
      if (!prev) return prev
      const next: ActiveTimerState = {
        ...prev,
        sessionTargetSeconds,
        fromReentry: true,
      }
      saveActiveTimer(next)
      return next
    })
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
    sessionTargetSeconds?: number | null
    fromReentry?: boolean
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
      durationSeconds: Math.max(0, Math.floor(durationSeconds)),
      startedAt: prev.sessionStartedAt,
      sessionTargetSeconds: prev.sessionTargetSeconds,
      fromReentry: prev.fromReentry,
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
    setSessionTarget,
    pause,
    resume,
    stop,
    discard,
  }
}
