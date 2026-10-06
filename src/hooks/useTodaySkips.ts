import { useCallback, useEffect, useState } from 'react'
import { TODAY_SKIPS_CHANGED, isSkippedOn, skipOn, unskipOn } from '../lib/todaySkips'

export function useTodaySkips(date: string) {
  const [, setVersion] = useState(0)
  useEffect(() => {
    const refresh = () => setVersion((value) => value + 1)
    window.addEventListener(TODAY_SKIPS_CHANGED, refresh)
    return () => window.removeEventListener(TODAY_SKIPS_CHANGED, refresh)
  }, [])
  return {
    isSkipped: (key: string) => isSkippedOn(key, date),
    skip: useCallback((key: string) => skipOn(key, date), [date]),
    unskip: useCallback((key: string) => unskipOn(key, date), [date]),
  }
}
