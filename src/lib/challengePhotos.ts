import { isEventPhotoPath } from './eventPhotoUrl'
import { compressEventPhoto } from './eventPhotos'
import { createSupabaseClient } from './supabase'

export const CHALLENGE_PHOTO_BUCKET = 'challenge-photos'

export function challengePhotoUrl(path: string | null | undefined): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  if (!base || !isEventPhotoPath(path)) return null
  return `${base}/storage/v1/object/public/${CHALLENGE_PHOTO_BUCKET}/${path}`
}

/** Puts the organizer's pictures on the challenge. An empty team slot keeps the picture it already has. */
export async function saveChallengePictures(
  challengeId: string,
  card: Blob | null,
  teams: readonly (Blob | null)[],
): Promise<void> {
  const client = createSupabaseClient()
  const uploaded: string[] = []

  const upload = async (blob: Blob) => {
    const jpeg = await compressEventPhoto(blob)
    const path = `${challengeId}/${crypto.randomUUID()}.jpg`
    const { error } = await client.storage.from(CHALLENGE_PHOTO_BUCKET).upload(path, jpeg, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    uploaded.push(path)
    return path
  }

  try {
    const cardPath = card ? await upload(card) : null
    const anyTeam = teams.some((blob) => blob != null)
    const teamPaths = anyTeam
      ? await Promise.all(teams.map(async (blob) => (blob ? upload(blob) : '')))
      : null
    const { error } = await client.rpc('set_challenge_photos', {
      p_id: challengeId,
      p_card: cardPath,
      p_team_paths: teamPaths,
    })
    if (error) throw error
  } catch (error) {
    if (uploaded.length > 0) void client.storage.from(CHALLENGE_PHOTO_BUCKET).remove(uploaded)
    throw error
  }
}
