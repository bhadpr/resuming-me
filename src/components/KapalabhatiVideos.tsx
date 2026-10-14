import { useEffect, useRef, useState } from 'react'
import {
  KAPALABHATI_CLIPS,
  KAPALABHATI_DEFAULT_SPEED,
  kapalabhatiNeighbours,
  type KapalabhatiSpeed,
} from '../data/kapalbhatiVideos'
import { useLocale } from '../hooks/useLocale'

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
 * Kapalabhati's three clips, one for each speed. The one you are on sits in the middle and plays;
 * the other two wait on either side, and tapping one brings it to the middle and plays it.
 * The timer drives the middle one: it plays while the timer runs and pauses with it.
 */
export function KapalabhatiVideos({
  name,
  playing = false,
  paused = false,
}: {
  name: string
  playing?: boolean
  paused?: boolean
}) {
  const { t } = useLocale()
  const [speed, setSpeed] = useState<KapalabhatiSpeed>(KAPALABHATI_DEFAULT_SPEED)
  const videos = useRef<Partial<Record<KapalabhatiSpeed, HTMLVideoElement | null>>>({})
  const wasWithTimer = useRef(false)
  const withTimer = playing || paused
  const { left } = kapalabhatiNeighbours(speed)

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
    for (const clip of KAPALABHATI_CLIPS) {
      if (clip.speed !== next) videos.current[clip.speed]?.pause()
    }
    setSpeed(next)
    // Played here, in the tap itself, so phones allow it.
    void startPlaying(videos.current[next])
  }

  return (
    <figure className="habit-video kapal-videos">
      <div className="kapal-row">
        {KAPALABHATI_CLIPS.map((clip) => {
          const middle = clip.speed === speed
          const order = middle ? 1 : clip.speed === left ? 0 : 2
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
