import { useEffect, useRef, useState } from 'react'
import {
  KAPALABHATI_CLIPS,
  KAPALABHATI_DEFAULT_SPEED,
  kapalabhatiNeighbours,
  type KapalabhatiClip,
  type KapalabhatiSpeed,
} from '../data/kapalbhatiVideos'
import { useLocale } from '../hooks/useLocale'
import { track } from '../lib/track'

/**
 * Plays the clip. A phone or browser may refuse to start a video with sound unless the tap was
 * right on it, so try once more without sound; the player's own button turns it back on.
 */
async function startPlaying(video: HTMLVideoElement | null | undefined) {
  if (!video) return
  try {
    await video.play()
  } catch {
    video.muted = true
    await video.play().catch(() => {})
  }
}

/**
 * One `video_played` event the first time each clip plays on this screen. `by` says whether the
 * timer started it or a tap did. Only the clip's id is sent, never what the person named the habit.
 */
function useVideoPlayEvent(videoId: string | null) {
  const sent = useRef(new Set<string>())
  return (variant: string, byTimer: boolean) => {
    if (sent.current.has(variant)) return
    sent.current.add(variant)
    track('video_played', { video: videoId ?? 'unknown', speed: variant, by: byTimer ? 'timer' : 'tap' })
  }
}

/**
 * Kapalabhati's three clips, one for each speed. The one you are on sits in the middle and plays;
 * the other two wait on either side, and tapping one brings it to the middle and plays it.
 * The timer drives the middle one: it plays while the timer runs and pauses with it.
 */
export function KapalabhatiVideos({
  name,
  playing = false,
  paused = false,
  clips = KAPALABHATI_CLIPS,
  videoId = null,
}: {
  name: string
  playing?: boolean
  paused?: boolean
  /** Three speeds. Kapalabhati's clips are the default; Bhastrika passes its own. */
  clips?: readonly KapalabhatiClip[]
  /** The habit's template id, sent with `video_played`. */
  videoId?: string | null
}) {
  const { t } = useLocale()
  const [speed, setSpeed] = useState<KapalabhatiSpeed>(KAPALABHATI_DEFAULT_SPEED)
  const videos = useRef<Partial<Record<KapalabhatiSpeed, HTMLVideoElement | null>>>({})
  const wasWithTimer = useRef(false)
  const withTimer = playing || paused
  const { left } = kapalabhatiNeighbours(speed)
  const reportPlay = useVideoPlayEvent(videoId)

  useEffect(() => {
    const video = videos.current[speed]
    if (playing) {
      void startPlaying(video)
    } else if (paused || wasWithTimer.current) {
      video?.pause()
    }
    wasWithTimer.current = withTimer
    // Only the timer moves the middle clip. Choosing another one plays it from the tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, paused, withTimer])

  function pick(next: KapalabhatiSpeed) {
    for (const clip of clips) {
      if (clip.speed !== next) videos.current[clip.speed]?.pause()
    }
    setSpeed(next)
    // Played here, in the tap itself, so phones allow it.
    void startPlaying(videos.current[next])
  }

  return (
    <figure className={`habit-video kapal-videos${withTimer ? ' kapal-videos-live' : ''}`}>
      <div className="kapal-row">
        {clips.map((clip) => {
          const middle = clip.speed === speed
          const order = withTimer
            ? middle
              ? 0
              : clip.speed === left
                ? 1
                : 2
            : middle
              ? 1
              : clip.speed === left
                ? 0
                : 2
          const label = t(`video.speed.${clip.speed}`)
          return (
            <div
              key={clip.speed}
              className={`kapal-item ${middle ? 'kapal-item-middle' : 'kapal-item-side'}`}
              style={{ order }}
            >
              <div className="kapal-frame">
                <video
                  ref={(element) => {
                    videos.current[clip.speed] = element
                  }}
                  className="kapal-video"
                  src={clip.src}
                  poster={clip.poster}
                  controls={middle}
                  loop
                  playsInline
                  preload={middle ? 'metadata' : 'none'}
                  aria-label={`${name}, ${label}`}
                  onPlay={() => reportPlay(clip.speed, playing)}
                />
                {!middle && (
                  <button
                    type="button"
                    className="kapal-pick"
                    aria-label={t('video.speedPlay', { speed: label })}
                    onClick={() => pick(clip.speed)}
                  />
                )}
              </div>
              <span className="kapal-label">{label}</span>
            </div>
          )
        })}
      </div>
      <figcaption className="screen-sub">
        {t('video.follow', { name })} {t('video.speedPick')}
      </figcaption>
    </figure>
  )
}

/** One of our own clips, such as Bhramari or Anulom Vilom. The timer plays and pauses it. */
export function OwnClipVideo({
  name,
  src,
  poster,
  playing = false,
  paused = false,
  videoId = null,
}: {
  name: string
  src: string
  poster: string
  playing?: boolean
  paused?: boolean
  /** The habit's template id, sent with `video_played`. */
  videoId?: string | null
}) {
  const { t } = useLocale()
  const video = useRef<HTMLVideoElement>(null)
  const wasWithTimer = useRef(false)
  const withTimer = playing || paused
  const reportPlay = useVideoPlayEvent(videoId)

  useEffect(() => {
    if (playing) {
      void startPlaying(video.current)
    } else if (paused || wasWithTimer.current) {
      video.current?.pause()
    }
    wasWithTimer.current = withTimer
  }, [playing, paused, withTimer])

  return (
    <figure className="habit-video breath-clip">
      <div className="kapal-frame">
        <video
          ref={video}
          className="kapal-video"
          src={src}
          poster={poster}
          controls
          loop
          playsInline
          preload="metadata"
          aria-label={name}
          onPlay={() => reportPlay('single', playing)}
        />
      </div>
      <figcaption className="screen-sub">{t('video.follow', { name })}</figcaption>
    </figure>
  )
}
