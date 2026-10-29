const STORAGE_KEY = 'resuming-vital-targets'
const DIRECTION_KEY = 'resuming-vital-directions'
const NOTE_KEY = 'resuming-vital-notes'

export type VitalDirection = 'down' | 'up'

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

function loadDirections(): Record<string, VitalDirection> {
  try {
    const parsed = JSON.parse(storage()?.getItem(DIRECTION_KEY) ?? '{}') as Record<string, unknown>
    const out: Record<string, VitalDirection> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (value === 'down' || value === 'up') out[id] = value
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
  const current = loadTargets()
  const next = { ...current }
  if (value == null) delete next[metricId]
  else next[metricId] = value
  try {
    store.setItem(STORAGE_KEY, JSON.stringify(next))
    // A new target can point the other way, so the direction is worked out again.
    if (current[metricId] !== next[metricId]) setVitalDirection(metricId, null)
  } catch {
    // Storage full or blocked: the vital still works without a target.
  }
}

function loadNotes(): Record<string, string> {
  try {
    const parsed = JSON.parse(storage()?.getItem(NOTE_KEY) ?? '{}') as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === 'string' && value.trim()) out[id] = value.trim()
    }
    return out
  } catch {
    return {}
  }
}

/** The person's own line for this vital, kept with the vital id on this device. */
export function vitalNote(metricId: string): string | null {
  return loadNotes()[metricId] ?? null
}

export function setVitalNote(metricId: string, note: string | null): void {
  const store = storage()
  if (!store) return
  const next = loadNotes()
  const clean = note?.replace(/\s+/g, ' ').trim().slice(0, 80) ?? ''
  if (!clean) delete next[metricId]
  else next[metricId] = clean
  try {
    store.setItem(NOTE_KEY, JSON.stringify(next))
  } catch {
    // The vital still works without the note.
  }
}

/** Weight only: whether the goal is to come down to the target or go up to it. */
export function vitalDirection(metricId: string): VitalDirection | null {
  return loadDirections()[metricId] ?? null
}

export function setVitalDirection(metricId: string, direction: VitalDirection | null): void {
  const store = storage()
  if (!store) return
  const next = loadDirections()
  if (direction == null) delete next[metricId]
  else next[metricId] = direction
  try {
    store.setItem(DIRECTION_KEY, JSON.stringify(next))
  } catch {
    // Without a stored direction the chart works it out again from the readings.
  }
}
