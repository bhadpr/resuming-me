import { requireAccountId } from './accountId'
import { MEDICINES_ENABLED } from '../config'
import { describeError } from './describeError'
import { createSupabaseClient } from './supabase'
import { clearGuestDraft, guestDraftToPayload, type GuestDraft } from './guestDraft'
import { listMedicines, markDoseTaken, saveMedicine } from './medicines'
import { addReminder, listReminders, ReminderCapError } from './reminders'
import type { Reminder } from './reminderSchedule'
import { followSharedEvent } from './sharedEvents'
import { claimSharedListAccepts } from './sharedLists'

export { guestDraftToPayload }

function dataUrlToBlob(dataUrl: string | null | undefined): Blob | null {
  if (!dataUrl) return null
  const match = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return null
  const binary = atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: match[1] })
}

function reminderKey(item: Pick<Reminder, 'text' | 'day' | 'hour' | 'minute'>): string {
  return `${item.text.trim().toLowerCase()}|${item.day}|${item.hour ?? ''}|${item.minute ?? ''}`
}

type SavedReminder = Pick<
  Reminder,
  'text' | 'day' | 'hour' | 'minute' | 'communityId' | 'sharedEventId' | 'sharedListItemId'
>

/** The account already has this reminder, even when the wording changed with the language. */
export function guestReminderAlreadySaved(
  existing: readonly SavedReminder[],
  reminder: SavedReminder,
): boolean {
  if (reminder.communityId && existing.some((item) => item.communityId === reminder.communityId)) {
    return true
  }
  if (reminder.sharedEventId && existing.some((item) => item.sharedEventId === reminder.sharedEventId)) {
    return true
  }
  if (reminder.sharedListItemId && existing.some((item) => item.sharedListItemId === reminder.sharedListItemId)) {
    return true
  }
  const key = reminderKey(reminder)
  return existing.some((item) => reminderKey(item) === key)
}

async function mergeMedicines(userId: string, draft: GuestDraft): Promise<void> {
  const existing = await listMedicines()
  const saved = new Map(existing.map((item) => [item.name.trim().toLowerCase(), item.id]))
  for (const medicine of draft.medicines) {
    const name = medicine.name.trim().toLowerCase()
    let medicineId = saved.get(name)
    if (!medicineId) {
      medicineId = await saveMedicine(userId, {
        name: medicine.name,
        weekdays: medicine.weekdays,
        times: medicine.times,
        system: medicine.system,
        photo: dataUrlToBlob(medicine.photo),
      })
      saved.set(name, medicineId)
    }
    for (const mark of draft.medicineMarks ?? []) {
      if (mark.name.trim().toLowerCase() !== name) continue
      await markDoseTaken(userId, {
        medicineId,
        date: mark.date,
        hour: mark.hour,
        minute: mark.minute,
      })
    }
  }
}

function errorCode(err: unknown): string {
  return typeof err === 'object' && err != null && 'code' in err ? String((err as { code?: unknown }).code ?? '') : ''
}

function errorText(err: unknown): string {
  const details =
    typeof err === 'object' && err != null && 'details' in err ? (err as { details?: unknown }).details : ''
  return `${describeError(err, '')} ${typeof details === 'string' ? details : ''}`
}

/** One bad reminder must not throw away the rest of setup. Auth and network errors still stop the copy. */
export function reminderSaveOutcome(err: unknown): 'stop' | 'skip' | 'fail' {
  if (err instanceof ReminderCapError) return 'stop'
  const code = errorCode(err)
  const text = errorText(err)
  if (code === 'P0001' && text.includes('reminders_open_cap')) return 'stop'
  if (code === '23505') return 'skip'
  if (text.includes('_user_id_fkey') || text.includes('profiles_id_fkey')) return 'fail'
  if (code === '23514' || code === '22P02' || code === '23503') return 'skip'
  return 'fail'
}

function alreadyMergedElsewhere(err: unknown): boolean {
  return errorCode(err) === '23505' && errorText(err).includes('merged_guest_id')
}

/** A retry after a partial failure skips reminders already copied. */
async function mergeReminders(userId: string, draft: GuestDraft): Promise<void> {
  const existing = await listReminders()
  for (const reminder of draft.reminders) {
    if (guestReminderAlreadySaved(existing, reminder)) continue
    if (reminder.sharedEventId) {
      try {
        await followSharedEvent(reminder.sharedEventId)
      } catch {
        /* the copy still moves; only the count misses it */
      }
    }
    try {
      await addReminder(userId, reminder)
    } catch (err) {
      const outcome = reminderSaveOutcome(err)
      if (outcome === 'stop') return
      if (outcome === 'fail') throw err
    }
    existing.push(reminder)
  }
}

/**
 * Copy the local guest draft into the signed-in account in one RPC.
 * On failure the draft stays in localStorage.
 */
export async function mergeGuestDraft(draft: GuestDraft): Promise<void> {
  try {
    await claimSharedListAccepts()
  } catch {
    /* the copies still move; only the count misses the move onto the account */
  }
  const client = createSupabaseClient()
  const reminders = draft.reminders ?? []
  const medicines = MEDICINES_ENABLED ? draft.medicines : []
  if (medicines.length > 0 || reminders.length > 0) {
    const userId = await requireAccountId()
    if (medicines.length > 0) await mergeMedicines(userId, draft)
    if (reminders.length > 0) await mergeReminders(userId, { ...draft, reminders })
  }
  const { error } = await client.rpc('merge_guest_draft', {
    payload: guestDraftToPayload(draft),
  })
  if (error) {
    if (alreadyMergedElsewhere(error)) {
      clearGuestDraft()
      return
    }
    throw error
  }
  clearGuestDraft()
}
