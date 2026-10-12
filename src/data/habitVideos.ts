/** Follow-along clips for habits that have a real video. */

export type HabitVideo = {
  /** YouTube video id */
  youtubeId: string
  /** Optional start time in seconds */
  startSeconds?: number
}

export const HABIT_VIDEOS: Record<string, HabitVideo> = {
  kapalabhati: { youtubeId: 'WOw55qnKBSo' },
  anuloma_viloma: { youtubeId: 'H7g1BMalpdw' },
  bhastrika: { youtubeId: 'TsYT02UnkMA' },
  bhramari: { youtubeId: '2B5RM0dphyA', startSeconds: 2 },
  relaxation: { youtubeId: 'PrYt0Iew8WM', startSeconds: 178 },
  rejuvenation: { youtubeId: 'NiorIbEuNCQ', startSeconds: 18 },
  prayer: { youtubeId: '6KrbdvLYCL8' },
  meditate: { youtubeId: 'gDClb-yjNdQ', startSeconds: 65 },
}

/** The habit's own video, otherwise the built-in one for that habit. */
export function habitVideoFor(
  templateId: string | null | undefined,
  own: HabitVideo | null = null,
): HabitVideo | null {
  if (own) return own
  if (!templateId || !Object.hasOwn(HABIT_VIDEOS, templateId)) return null
  return HABIT_VIDEOS[templateId]
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/
const MAX_START_SECONDS = 86_400

/** A saved own video, or null when the columns are empty or malformed. */
export function ownHabitVideo(
  youtubeId: string | null | undefined,
  startSeconds?: number | null,
): HabitVideo | null {
  if (!youtubeId || !YOUTUBE_ID.test(youtubeId)) return null
  return startSeconds && startSeconds > 0 ? { youtubeId, startSeconds } : { youtubeId }
}

/** `90`, `90s`, `1m30s` or `1h2m3s`. */
function parseStart(value: string | null): number | undefined {
  if (!value) return undefined
  const plain = /^(\d+)s?$/.exec(value)
  const parts = plain ? null : /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value)
  const seconds = plain
    ? Number(plain[1])
    : parts
      ? Number(parts[1] ?? 0) * 3600 + Number(parts[2] ?? 0) * 60 + Number(parts[3] ?? 0)
      : 0
  return seconds > 0 && seconds <= MAX_START_SECONDS ? seconds : undefined
}

/** Reads a YouTube link (watch, youtu.be, Shorts, embed or live) or a bare video id. Null when it is not one. */
export function parseYoutubeLink(text: string): HabitVideo | null {
  const trimmed = text.trim()
  if (YOUTUBE_ID.test(trimmed)) return { youtubeId: trimmed }
  let url: URL
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '')
  const segments = url.pathname.split('/').filter(Boolean)
  let id: string | null = null
  if (host === 'youtu.be') {
    id = segments[0] ?? null
  } else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (segments[0] === 'watch') id = url.searchParams.get('v')
    else if (['shorts', 'embed', 'live', 'v'].includes(segments[0] ?? '')) id = segments[1] ?? null
  }
  if (!id || !YOUTUBE_ID.test(id)) return null
  const start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start'))
  return start ? { youtubeId: id, startSeconds: start } : { youtubeId: id }
}

/** The video on YouTube itself, for when its owner does not allow playing it inside other apps. */
export function youtubeWatchUrl(video: HabitVideo): string {
  const start = video.startSeconds && video.startSeconds > 0 ? `&t=${Math.floor(video.startSeconds)}s` : ''
  return `https://www.youtube.com/watch?v=${video.youtubeId}${start}`
}

/** The habit's saved own video, read from its row. */
export function activityOwnVideo(activity: {
  video_youtube_id?: string | null
  video_start_seconds?: number | null
}): HabitVideo | null {
  return ownHabitVideo(activity.video_youtube_id, activity.video_start_seconds)
}

export function habitYoutubeEmbedUrl(
  video: HabitVideo,
  options?: { autoplay?: boolean; origin?: string },
): string {
  const params = new URLSearchParams({
    rel: '0',
    modestbranding: '1',
    playsinline: '1',
    enablejsapi: '1',
  })
  if (video.startSeconds && video.startSeconds > 0) {
    params.set('start', String(Math.floor(video.startSeconds)))
  }
  if (options?.autoplay) {
    params.set('autoplay', '1')
  }
  if (options?.origin) {
    params.set('origin', options.origin)
  }
  return `https://www.youtube.com/embed/${video.youtubeId}?${params.toString()}`
}
