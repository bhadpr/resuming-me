import { useEffect, useMemo, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { DAILY_DIGEST_CHANGED } from '../lib/dailyDigest'
import {
  listenForDigestNotificationTap,
  syncDailyDigestSchedule,
} from '../lib/localNotifications'
import type { ActivityTodayProgress } from '../lib/today'

export function useDailyDigest(
  rows: ActivityTodayProgress[],
  ready: boolean,
  onOpenToday?: () => void,
): void {
  const onOpenTodayRef = useRef(onOpenToday)
  onOpenTodayRef.current = onOpenToday

  const digestItems = useMemo(
    () => rows.map((row) => ({ name: row.activity.name, done: row.done })),
    [rows],
  )
  const digestItemsRef = useRef(digestItems)
  digestItemsRef.current = digestItems
  const readyRef = useRef(ready)
  readyRef.current = ready

  useEffect(() => {
    if (!ready) return
    void syncDailyDigestSchedule(digestItems).catch(() => {})
  }, [ready, digestItems])

  useEffect(() => {
    function reschedule() {
      if (!readyRef.current) return
      void syncDailyDigestSchedule(digestItemsRef.current).catch(() => {})
    }

    window.addEventListener(DAILY_DIGEST_CHANGED, reschedule)

    let cancelled = false
    let removeAppListener = () => {}
    let removeTapListener = () => {}

    if (Capacitor.isNativePlatform()) {
      void (async () => {
        const { App } = await import('@capacitor/app')
        const handle = await App.addListener('appStateChange', ({ isActive }) => {
          if (isActive) reschedule()
        })
        if (cancelled) {
          void handle.remove()
          return
        }
        removeAppListener = () => {
          void handle.remove()
        }
      })()

      void listenForDigestNotificationTap(() => {
        onOpenTodayRef.current?.()
      }).then((remove) => {
        if (cancelled) {
          remove()
          return
        }
        removeTapListener = remove
      })
    }

    return () => {
      cancelled = true
      window.removeEventListener(DAILY_DIGEST_CHANGED, reschedule)
      removeAppListener()
      removeTapListener()
    }
  }, [])
}
