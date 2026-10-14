import type { HabitVideo } from './habitVideos'

/**
 * Kapalabhati has three of our own clips, one for each speed, instead of a YouTube video.
 * The files are served from resuming.app/media on Cloudflare. The pictures ship with the app.
 */
export const KAPALABHATI_TEMPLATE_ID = 'kapalabhati'
/** In development the dev server serves the same files, so they play before anything is deployed. */
export const KAPALABHATI_MEDIA_BASE = import.meta.env.DEV ? '/media' : 'https://resuming.app/media'

export const KAPALABHATI_SPEEDS = ['slow', 'medium', 'fast'] as const
export type KapalabhatiSpeed = (typeof KAPALABHATI_SPEEDS)[number]

export interface KapalabhatiClip {
  speed: KapalabhatiSpeed
  /** The video file, 30 seconds. */
  src: string
  /** A frame from the clip, shown before it plays and on the side pictures. */
  poster: string
}

export const KAPALABHATI_CLIPS: readonly KapalabhatiClip[] = KAPALABHATI_SPEEDS.map((speed) => ({
  speed,
  src: `${KAPALABHATI_MEDIA_BASE}/kapalbhati-${speed}.mp4`,
  poster: `/habits/kapalbhati/${speed}.webp`,
}))

/** Medium is the one in the middle to begin with. */
export const KAPALABHATI_DEFAULT_SPEED: KapalabhatiSpeed = 'medium'

/** Our clips replace the built-in YouTube one, but never a video the person added themselves. */
export function usesKapalabhatiClips(
  templateId: string | null | undefined,
  own: HabitVideo | null = null,
): boolean {
  return templateId === KAPALABHATI_TEMPLATE_ID && own == null
}

/**
 * Who sits on each side of the one in the middle. The speeds go round in a circle, so both sides
 * are always filled: with Slow in the middle, Fast is on the left and Medium on the right.
 */
export function kapalabhatiNeighbours(selected: KapalabhatiSpeed): { left: KapalabhatiSpeed; right: KapalabhatiSpeed } {
  const index = KAPALABHATI_SPEEDS.indexOf(selected)
  const count = KAPALABHATI_SPEEDS.length
  return {
    left: KAPALABHATI_SPEEDS[(index + count - 1) % count],
    right: KAPALABHATI_SPEEDS[(index + 1) % count],
  }
}

export function kapalabhatiClip(speed: KapalabhatiSpeed): KapalabhatiClip {
  return KAPALABHATI_CLIPS.find((clip) => clip.speed === speed) ?? KAPALABHATI_CLIPS[1]
}
