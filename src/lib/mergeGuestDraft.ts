import { createSupabaseClient } from './supabase'
import { clearGuestDraft, guestDraftToPayload, type GuestDraft } from './guestDraft'
import { listMedicines, markDoseTaken, saveMedicine } from './medicines'
import { addReminder, listReminders, ReminderCapError } from './reminders'
import type { Reminder } from './reminderSchedule'

export const MERGE_RETRY_MESSAGE = "We couldn't save that just yet — tap to retry."

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

/** A retry after a partial failure skips reminders already copied. */
async function mergeReminders(userId: string, draft: GuestDraft): Promise<void> {
  const existing = new Set((await listReminders()).map(reminderKey))
  for (const reminder of draft.reminders) {
    if (existing.has(reminderKey(reminder))) continue
    try {
      await addReminder(userId, reminder)
    } catch (err) {
      if (err instanceof ReminderCapError) return
      throw err
    }
    existing.add(reminderKey(reminder))
  }
}

/**
 * Copy the local guest draft into the signed-in account in one RPC.
 * On failure the draft stays in localStorage.
 */
export async function mergeGuestDraft(draft: GuestDraft): Promise<void> {
  const client = createSupabaseClient()
  const reminders = draft.reminders ?? []
  if (draft.medicines.length > 0 || reminders.length > 0) {
    const { data } = await client.auth.getUser()
    const userId = data.user?.id
    if (!userId) throw new Error('Not signed in')
    if (draft.medicines.length > 0) await mergeMedicines(userId, draft)
    if (reminders.length > 0) await mergeReminders(userId, { ...draft, reminders })
  }
  const { error } = await client.rpc('merge_guest_draft', {
    payload: guestDraftToPayload(draft),
  })
  if (error) throw error
  clearGuestDraft()
}
