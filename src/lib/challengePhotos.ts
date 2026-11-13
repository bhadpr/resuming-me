import { isEventPhotoPath } from './eventPhotoUrl'
import { compressEventPhoto } from './eventPhotos'
import { createSupabaseClient } from './supabase'

export const CHALLENGE_PHOTO_BUCKET = 'challenge-photos'

export function challengePhotoUrl(path: string | null | undefined): string | null {
  const base = import.meta.env.VITE_SUPABASE_URL?.replace(/\/+$/, '')
  if (!base || !isEventPhotoPath(path)) return null
  return `${base}/storage/v1/object/public/${CHALLENGE_PHOTO_BUCKET}/${path}`
}

async function putChallengePhoto(challengeId: string, blob: Blob): Promise<string> {
  const jpeg = await compressEventPhoto(blob)
  const path = `${challengeId}/${crypto.randomUUID()}.jpg`
  const { error } = await createSupabaseClient().storage.from(CHALLENGE_PHOTO_BUCKET).upload(path, jpeg, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) throw error
  return path
}

/** Uploads the pictures the organizer just picked. A null slot is left alone. */
export async function stageChallengePictures(
  challengeId: string,
  card: Blob | null,
  teams: readonly (Blob | null)[],
): Promise<{ cardPath: string | null; teamPaths: (string | null)[] }> {
  const uploaded: string[] = []
  try {
    const cardPath = card ? await putChallengePhoto(challengeId, card) : null
    if (cardPath) uploaded.push(cardPath)
    const teamPaths: (string | null)[] = []
    for (const blob of teams) {
      if (!blob) {
        teamPaths.push(null)
        continue
      }
      const path = await putChallengePhoto(challengeId, blob)
      uploaded.push(path)
      teamPaths.push(path)
    }
    return { cardPath, teamPaths }
  } catch (error) {
    if (uploaded.length > 0) {
      void createSupabaseClient().storage.from(CHALLENGE_PHOTO_BUCKET).remove(uploaded)
    }
    throw error
  }
}

export async function discardChallengePictures(paths: readonly (string | null | undefined)[]): Promise<void> {
  const uploaded = paths.filter((path): path is string => Boolean(path))
  if (uploaded.length === 0) return
  await createSupabaseClient().storage.from(CHALLENGE_PHOTO_BUCKET).remove(uploaded)
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
    const path = await putChallengePhoto(challengeId, blob)
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
