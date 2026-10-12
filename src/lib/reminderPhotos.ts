import { compressEventPhoto } from './eventPhotos'
import type { Reminder, ReminderPhoto } from './reminderSchedule'
import { createSupabaseClient } from './supabase'

const BUCKET = 'reminder-photos'
/** Small enough that a guest's handful of photos fits in the device's storage. */
const GUEST_MAX_SIDE = 480
const SIGNED_SECONDS = 6 * 60 * 60
/** A cached address is reused until this close to expiring, so pictures do not reload on every visit. */
const SIGNED_REUSE_MARGIN_MS = 60 * 60 * 1000

/** Shrinks a picked photo for the account, and a smaller copy for a guest's device. */
export async function prepareReminderPhoto(file: Blob): Promise<ReminderPhoto> {
  const blob = await compressEventPhoto(file)
  const bitmap = await createImageBitmap(blob)
  const scale = Math.min(1, GUEST_MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read that photo')
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  return { blob, dataUrl: canvas.toDataURL('image/jpeg', 0.6) }
}

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body] = dataUrl.split(',', 2)
  const type = /^data:([^;]+)/.exec(head)?.[1] ?? 'image/jpeg'
  const bytes = atob(body ?? '')
  const out = new Uint8Array(bytes.length)
  for (let index = 0; index < bytes.length; index += 1) out[index] = bytes.charCodeAt(index)
  return new Blob([out], { type })
}

export async function uploadReminderPhoto(userId: string, blob: Blob): Promise<string> {
  const path = `${userId}/${crypto.randomUUID()}.jpg`
  const { error } = await createSupabaseClient().storage.from(BUCKET).upload(path, blob, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

const signed = new Map<string, { url: string; expires: number }>()

/** Remembers a just-uploaded photo's local picture, so it shows before the next load. */
export function rememberReminderPhoto(path: string, blob: Blob): string {
  const url = URL.createObjectURL(blob)
  signed.set(path, { url, expires: Number.MAX_SAFE_INTEGER })
  return url
}

/** Fills in photoUrl for reminders with a stored photo. Offline, they show their kind picture instead. */
export async function withReminderPhotoUrls<T extends Reminder>(list: readonly T[]): Promise<T[]> {
  const now = Date.now()
  const missing = [
    ...new Set(
      list
        .map((item) => item.photoPath)
        .filter((path): path is string => Boolean(path))
        .filter((path) => (signed.get(path)?.expires ?? 0) - SIGNED_REUSE_MARGIN_MS < now),
    ),
  ]
  if (missing.length > 0) {
    try {
      const { data } = await createSupabaseClient().storage.from(BUCKET).createSignedUrls(missing, SIGNED_SECONDS)
      for (const row of data ?? []) {
        if (row.path && row.signedUrl) signed.set(row.path, { url: row.signedUrl, expires: now + SIGNED_SECONDS * 1000 })
      }
    } catch {
      /* shown without the photo this time */
    }
  }
  return list.map((item) => (item.photoPath ? { ...item, photoUrl: signed.get(item.photoPath)?.url ?? null } : item))
}

/** Deletes a stored photo unless another reminder, such as next year's copy, still uses it. */
export async function removeReminderPhotoIfUnused(path: string | null | undefined): Promise<void> {
  if (!path) return
  const client = createSupabaseClient()
  try {
    const { count, error } = await client
      .from('reminders')
      .select('id', { count: 'exact', head: true })
      .eq('photo_path', path)
    if (error || (count ?? 0) > 0) return
    await client.storage.from(BUCKET).remove([path])
    signed.delete(path)
  } catch {
    /* an unused photo left behind is removed with the account */
  }
}

/** The reminder's own photo as a file, for sharing it. */
export async function reminderPhotoBlob(reminder: Reminder): Promise<Blob | null> {
  if (reminder.photoData) return dataUrlToBlob(reminder.photoData)
  if (!reminder.photoUrl) return null
  try {
    const response = await fetch(reminder.photoUrl)
    return response.ok ? await response.blob() : null
  } catch {
    return null
  }
}
