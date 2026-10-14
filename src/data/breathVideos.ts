import {
  KAPALABHATI_CLIPS,
  KAPALABHATI_MEDIA_BASE,
  KAPALABHATI_SPEEDS,
  type KapalabhatiClip,
} from './kapalbhatiVideos'

/** A single follow-along file, with a picture shown before it plays. */
export interface BreathClip {
  src: string
  poster: string
}

function speedSet(fileName: string, posterDir: string): readonly KapalabhatiClip[] {
  return KAPALABHATI_SPEEDS.map((speed) => ({
    speed,
    src: `${KAPALABHATI_MEDIA_BASE}/${fileName}-${speed}.mp4`,
    poster: `/habits/${posterDir}/${speed}.jpg`,
  }))
}

/** Bhastrika's three speeds. Medium is the middle one to begin with. */
export const BHASTRIKA_CLIPS = speedSet('bhastrika', 'bhastrika')

const SINGLE_CLIPS: Record<string, BreathClip> = {
  bhramari: {
    src: `${KAPALABHATI_MEDIA_BASE}/bhramari.mp4`,
    poster: '/habits/bhramari/poster.jpg',
  },
  anuloma_viloma: {
    src: `${KAPALABHATI_MEDIA_BASE}/anuloma-viloma.mp4`,
    poster: '/habits/anuloma-viloma/poster.jpg',
  },
}

/** Kapalabhati and Bhastrika. Null for a habit that has one clip, or none of ours. */
export function speedBreathClips(templateId: string | null | undefined): readonly KapalabhatiClip[] | null {
  if (templateId === 'kapalabhati') return KAPALABHATI_CLIPS
  if (templateId === 'bhastrika') return BHASTRIKA_CLIPS
  return null
}

/** Bhramari and Anulom Vilom. Null when the habit has speeds, or no clip of ours. */
export function singleBreathClip(templateId: string | null | undefined): BreathClip | null {
  if (!templateId || !Object.hasOwn(SINGLE_CLIPS, templateId)) return null
  return SINGLE_CLIPS[templateId]
}
