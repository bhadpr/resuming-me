const STORAGE_KEY = 'resuming-vital-targets'

function storage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage
  } catch {
    return null
  }
}

function loadTargets(): Record<string, number> {
  try {
    const parsed = JSON.parse(storage()?.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>
    const out: Record<string, number> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'number' && Number.isFinite(value) && value > 0) out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

/** Vitals have no server field for a target, so it stays on this device. */
export function vitalTarget(metricId: string): number | null {
  return loadTargets()[metricId] ?? null
}

export function setVitalTarget(metricId: string, value: number | null): void {
  const store = storage()
  if (!store) return
  const next = loadTargets()
  if (value == null) delete next[metricId]
  else next[metricId] = value
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Storage full or blocked: the vital still works without a target.
  }
}
