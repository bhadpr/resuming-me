import { useEffect, useMemo, useRef } from 'react'
import { habitVideoFor, habitYoutubeEmbedUrl } from '../data/habitVideos'
import { habitVideoCaption } from '../lib/onboardingFlow'

function postYoutubeCommand(iframe: HTMLIFrameElement | null, func: 'playVideo' | 'pauseVideo') {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: 'command', func, args: [] }),
    'https://www.youtube.com',
  )
}

/** Follow-along video when we have a clip; otherwise an empty player with a caption. */
export function HabitVideoPlaceholder({
  templateId,
  name,
  measure = null,
  playing = false,
  paused = false,
  placeholder = false,
  shape = 'wide',
}: {
  templateId: string | null
  name: string
  measure?: string | null
  playing?: boolean
  paused?: boolean
  /** Empty frame, even when a clip exists. */
  placeholder?: boolean
  /** A Short is a tall 9:16 frame. */
  shape?: 'wide' | 'short'
}) {
  const video = habitVideoFor(templateId)
  const caption = habitVideoCaption(templateId, name, measure)
  const withTimer = playing || paused
  const iframeRef = useRef<HTMLIFrameElement>(null)
  /** Tracks play state after the live session iframe is up; first start uses embed autoplay. */
  const lastPlaying = useRef<boolean | null>(null)

  const embedSrc = useMemo(() => {
    if (!video) return ''
    const origin = typeof window !== 'undefined' ? window.location.origin : undefined
    // Keep src stable for the whole live session so pause/resume does not reload.
    return habitYoutubeEmbedUrl(video, {
      autoplay: withTimer,
      origin,
    })
  }, [video, withTimer])

  useEffect(() => {
    if (!video || !withTimer) {
      lastPlaying.current = null
      return
    }
    if (lastPlaying.current === null) {
      lastPlaying.current = playing
      return
    }
    if (lastPlaying.current === playing) return
    lastPlaying.current = playing
    postYoutubeCommand(iframeRef.current, playing ? 'playVideo' : 'pauseVideo')
  }, [playing, withTimer, video])

  const figureClass = shape === 'short' ? 'habit-video habit-video-short' : 'habit-video'
  const frameClass = [
    'habit-video-frame',
    shape === 'short' ? 'habit-video-frame-short' : '',
    withTimer ? 'habit-video-frame-live' : '',
  ]
    .filter(Boolean)
    .join(' ')

  if (video && !placeholder) {
    return (
      <figure className={figureClass}>
        <div className={`${frameClass} habit-video-frame-embed`}>
          <iframe
            key={`${video.youtubeId}-${withTimer ? 'live' : 'idle'}`}
            ref={iframeRef}
            className="habit-video-iframe"
            src={embedSrc}
            title={`${name} video`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <figcaption className="screen-sub">{caption}</figcaption>
      </figure>
    )
  }

  return (
    <figure className={figureClass}>
      <div
        className={frameClass}
        role="img"
        aria-label={playing ? `${caption} Playing.` : paused ? `${caption} Paused.` : caption}
      >
        {withTimer ? (
          <span className="habit-video-status">{playing ? 'Playing' : 'Paused'}</span>
        ) : (
          <span className="habit-video-play" aria-hidden />
        )}
      </div>
      <figcaption className="screen-sub">{caption}</figcaption>
    </figure>
  )
}
