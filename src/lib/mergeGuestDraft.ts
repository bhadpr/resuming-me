import { createSupabaseClient } from './supabase'
import { clearGuestDraft, guestDraftToPayload, type GuestDraft } from './guestDraft'
import { listMedicines, markDoseTaken, saveMedicine } from './medicines'

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

/**
 * Copy the local guest draft into the signed-in account in one RPC.
 * On failure the draft stays in localStorage.
 */
export async function mergeGuestDraft(draft: GuestDraft): Promise<void> {
  const client = createSupabaseClient()
  if (draft.medicines.length > 0) {
    const { data } = await client.auth.getUser()
    const userId = data.user?.id
    if (!userId) throw new Error('Not signed in')
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
  const { error } = await client.rpc('merge_guest_draft', {
    payload: guestDraftToPayload(draft),
  })
  if (error) throw error
  clearGuestDraft()
}
