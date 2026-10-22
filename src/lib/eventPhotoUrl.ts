export const EVENT_PHOTO_BUCKET = 'event-photos'
export const COMMUNITY_PHOTO_BUCKET = 'community-photos'
export const LIST_PHOTO_BUCKET = 'list-photos'
const PATH = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/[a-z0-9-]{8,64}\.jpg$/

export function isEventPhotoPath(value: unknown): value is string {
  return typeof value === 'string' && PATH.test(value)
}

/** A guest photo kept on the device. Bounded so a bad value cannot fill storage. */
export function isReminderPhotoData(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('data:image/jpeg;base64,') && value.length <= 400_000
}

/** What a reminder shows instead of its kind picture: its own photo, else its shared event's photo. */
export function reminderPhotoSrc(reminder: {
  photoData?: string | null
  photoUrl?: string | null
  sharedPhotoPath?: string | null
  communityPhotoPath?: string | null
}): string | null {
  if (isReminderPhotoData(reminder.photoData)) return reminder.photoData
  return reminder.photoUrl || eventPhotoUrl(reminder.sharedPhotoPath) || communityPhotoUrl(reminder.communityPhotoPath)
}

/** The public address of a community reminder's picture. Null for anything that is not one. */
export function communityPhotoUrl(
  path: string | null | undefined,
  base: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): string | null {
  if (!base || !isEventPhotoPath(path)) return null
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${COMMUNITY_PHOTO_BUCKET}/${path}`
}

/** The public address of a list's one picture. Null for anything that is not one. */
export function listPhotoUrl(
  path: string | null | undefined,
  base: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): string | null {
  if (!base || !isEventPhotoPath(path)) return null
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${LIST_PHOTO_BUCKET}/${path}`
}

/** The public address of an event photo. Null for anything that is not one. */
export function eventPhotoUrl(
  path: string | null | undefined,
  base: string | undefined = import.meta.env.VITE_SUPABASE_URL,
): string | null {
  if (!base || !isEventPhotoPath(path)) return null
  return `${base.replace(/\/+$/, '')}/storage/v1/object/public/${EVENT_PHOTO_BUCKET}/${path}`
}
