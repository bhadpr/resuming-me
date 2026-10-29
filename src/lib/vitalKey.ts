import { habitTemplateId } from '../data/habitArt'

/** Catalog vitals. A second row with the same id is the same vital. */
const LISTED_VITALS = new Set([
  'weight',
  'blood_pressure',
  'heart_rate',
  'blood_sugar',
  'systolic',
  'diastolic',
  'water',
  'protein',
  'fasting',
  'steps',
])

export function isListedVital(item: {
  templateId?: string | null
  template_id?: string | null
  name?: string | null
  measure?: string | null
}): boolean {
  if (item.measure === 'log') return true
  const id = habitTemplateId(item)
  return id != null && LISTED_VITALS.has(id)
}

/** One key per vital. Daily Steps and a steps habit are the same key. */
export function vitalKey(item: {
  templateId?: string | null
  template_id?: string | null
  name?: string | null
}): string | null {
  const id = habitTemplateId(item)
  if (id) return id
  const name = item.name?.trim().toLowerCase()
  return name ? `name:${name}` : null
}

/** Keep the first row for each vital. Rows with no key stay. */
export function uniqueByVitalKey<T extends Parameters<typeof vitalKey>[0]>(items: readonly T[]): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const key = vitalKey(item)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(item)
  }
  return out
}

/** Drop rows whose vital is already in `taken`. */
export function skipVitalKeys<T extends Parameters<typeof vitalKey>[0]>(
  items: readonly T[],
  taken: ReadonlySet<string>,
): T[] {
  const seen = new Set(taken)
  const out: T[] = []
  for (const item of items) {
    const key = vitalKey(item)
    if (key && seen.has(key)) continue
    if (key) seen.add(key)
    out.push(item)
  }
  return out
}
