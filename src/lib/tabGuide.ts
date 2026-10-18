export const TAB_GUIDE_DISMISS_KEY = 'resuming-tab-guide'
export const TAB_GUIDE_VISITS_KEY = 'resuming-tab-guide-visits'
/** Show on the first three arrivals at Today, then hide. */
export const TAB_GUIDE_SHOW_TIMES = 3

const REMOUNT_MS = 1500

let lastVisitAt = 0

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function readVisits(store: Storage): number {
  const raw = Number(store.getItem(TAB_GUIDE_VISITS_KEY))
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 0
}

/** True after Got it, or after Today has been opened enough times. */
export function tabGuideDismissed(store: Storage | null = storage()): boolean {
  if (!store) return false
  if (store.getItem(TAB_GUIDE_DISMISS_KEY) === '1') return true
  return readVisits(store) >= TAB_GUIDE_SHOW_TIMES
}

export function dismissTabGuide(store: Storage | null = storage()): void {
  if (!store) return
  store.setItem(TAB_GUIDE_DISMISS_KEY, '1')
}

/**
 * Count one arrival at Today. Remounts within 1.5s (React Strict Mode) do not count.
 * The third visit still shows the guide; the next one hides it.
 */
export function recordTabGuideVisit(
  store: Storage | null = storage(),
  now = Date.now(),
): number {
  if (!store || store.getItem(TAB_GUIDE_DISMISS_KEY) === '1') {
    return store ? readVisits(store) : 0
  }
  if (lastVisitAt > 0 && now - lastVisitAt < REMOUNT_MS) return readVisits(store)
  lastVisitAt = now
  const next = readVisits(store) + 1
  store.setItem(TAB_GUIDE_VISITS_KEY, String(next))
  if (next >= TAB_GUIDE_SHOW_TIMES) store.setItem(TAB_GUIDE_DISMISS_KEY, '1')
  return next
}

export function _resetTabGuideForTests(): void {
  lastVisitAt = 0
}
