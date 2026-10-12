import { EVENT_PHOTO_BUCKET } from './eventPhotoUrl'
import { createSupabaseClient } from './supabase'

const MAX_SIDE = 1280
/** The bucket refuses files over 1 MB. */
const MAX_BYTES = 950_000

/** Redrawing drops the photo's hidden details, such as where it was taken. */
export async function compressEventPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale))
  canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('Could not read that photo')
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, canvas.width, canvas.height)
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  for (const quality of [0.82, 0.7, 0.55, 0.4]) {
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (blob && blob.size <= MAX_BYTES) return blob
  }
  throw new Error('That photo is too big')
}

/** Uploads the photo and links it to the event. The event keeps it for good. */
export async function addEventPhoto(eventId: string, photo: Blob): Promise<string> {
  const client = createSupabaseClient()
  const path = `${eventId}/${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await client.storage.from(EVENT_PHOTO_BUCKET).upload(path, photo, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) throw uploadError
  const { error } = await client.from('shared_events').update({ photo_path: path }).eq('id', eventId)
  if (error) {
    void client.storage.from(EVENT_PHOTO_BUCKET).remove([path])
    throw error
  }
  return path
}

/** Admin only: deletes the photo for good, as switching an event off does. */
export async function removeEventPhoto(eventId: string, path: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.storage.from(EVENT_PHOTO_BUCKET).remove([path])
  if (error) throw error
  const { error: clearError } = await client.from('shared_events').update({ photo_path: null }).eq('id', eventId)
  if (clearError) throw clearError
}
