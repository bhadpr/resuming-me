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
  rejuvenation: { youtubeId: 'NiorIbEuNCQ' },
  prayer: { youtubeId: '6KrbdvLYCL8' },
  meditate: { youtubeId: 'gDClb-yjNdQ' },
}

export function habitVideoFor(templateId: string | null | undefined): HabitVideo | null {
  if (!templateId) return null
  return HABIT_VIDEOS[templateId] ?? null
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
