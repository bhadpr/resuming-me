/**
 * iPhone keeps at most 64 waiting alerts and drops the rest.
 * Android keeps its own limits and does not use this.
 */

export const IOS_PENDING_LIMIT = 64
/** Left empty so a snooze or the Settings test alert can still be added. */
export const IOS_RESERVED_SLOTS = 4

export interface TimedNote {
  id: number
  at: Date
}

export interface IosAlertBudget<R extends TimedNote, D extends TimedNote> {
  reminders: R[]
  digests: D[]
  reentry: D | null
}

let cachedReminders: TimedNote[] = []
let cachedDigests: TimedNote[] = []
let cachedReentry: TimedNote | null = null

/** Soonest alerts that fit, with the next daily nudge and the come-back nudge kept. */
export function fitIosAlertBudget<R extends TimedNote, D extends TimedNote>(input: {
  reminders: readonly R[]
  digests: readonly D[]
  reentry: D | null
  limit?: number
  reserved?: number
}): IosAlertBudget<R, D> {
  const limit = input.limit ?? IOS_PENDING_LIMIT
  const reserved = input.reserved ?? IOS_RESERVED_SLOTS
  const capacity = Math.max(0, limit - reserved)

  const soonestDigest =
    [...input.digests].sort((a, b) => a.at.getTime() - b.at.getTime() || a.id - b.id)[0] ?? null
  const protectedIds = new Set<number>()
  if (soonestDigest) protectedIds.add(soonestDigest.id)
  if (input.reentry) protectedIds.add(input.reentry.id)

  const pool: Array<{ item: R | D; bucket: 'reminder' | 'digest' }> = [
    ...input.reminders.map((item) => ({ item, bucket: 'reminder' as const })),
    ...input.digests
      .filter((item) => item.id !== soonestDigest?.id)
      .map((item) => ({ item, bucket: 'digest' as const })),
  ]
  pool.sort((a, b) => a.item.at.getTime() - b.item.at.getTime() || a.item.id - b.item.id)

  const used = new Set(protectedIds)
  const chosen: Array<{ item: R | D; bucket: 'reminder' | 'digest' }> = []
  const room = Math.max(0, capacity - protectedIds.size)
  for (const entry of pool) {
    if (chosen.length >= room) break
    if (used.has(entry.item.id)) continue
    used.add(entry.item.id)
    chosen.push(entry)
  }

  const reminderIds = new Set(
    chosen.filter((entry) => entry.bucket === 'reminder').map((entry) => entry.item.id),
  )
  const digestIds = new Set(
    chosen.filter((entry) => entry.bucket === 'digest').map((entry) => entry.item.id),
  )
  if (soonestDigest) digestIds.add(soonestDigest.id)

  return {
    reminders: input.reminders.filter((item) => reminderIds.has(item.id)),
    digests: input.digests.filter((item) => digestIds.has(item.id)),
    reentry: input.reentry,
  }
}

export function noteReminderAlerts<R extends TimedNote>(reminders: readonly R[]): IosAlertBudget<R, TimedNote> {
  cachedReminders = [...reminders]
  return fitIosAlertBudget({
    reminders,
    digests: cachedDigests,
    reentry: cachedReentry,
  })
}

export function noteDigestAlerts<D extends TimedNote>(
  digests: readonly D[],
  reentry: D | null,
): IosAlertBudget<TimedNote, D> {
  cachedDigests = [...digests]
  cachedReentry = reentry
  return fitIosAlertBudget({
    reminders: cachedReminders,
    digests,
    reentry,
  })
}

export function reminderIdsOutside(kept: readonly { id: number }[]): number[] {
  const keep = new Set(kept.map((item) => item.id))
  return cachedReminders.map((item) => item.id).filter((id) => !keep.has(id))
}
