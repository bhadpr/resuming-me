import { useState } from 'react'
import { useThemedArt } from '../hooks/useThemedArt'
import type { ReminderKind } from '../lib/reminderSchedule'

/** Clay picture for a reminder kind, drawn like the habit pictures. The reminder's photo takes its place. */
export function ReminderKindMark({ kind, photo }: { kind: ReminderKind; photo?: string | null }) {
  const art = useThemedArt()
  const [failed, setFailed] = useState<string | null>(null)
  if (photo && failed !== photo) {
    return (
      <span className="activity-emoji activity-emoji-art reminder-mark reminder-photo-mark" aria-hidden>
        <img src={photo} alt="" loading="lazy" decoding="async" onError={() => setFailed(photo)} />
      </span>
    )
  }
  return (
    <span className="activity-emoji activity-emoji-art reminder-mark" aria-hidden>
      <img src={art(`/reminders/${kind}.webp`)} alt="" width={320} height={320} loading="lazy" decoding="async" />
    </span>
  )
}

/** A photo at full width, for the reminder and the event page. Hidden if it does not load. */
export function EventPhoto({
  src,
  alt,
  className,
  plain = false,
}: {
  src: string | null | undefined
  alt: string
  className?: string
  /** Draw the picture only. The default opens the picture in a new tab. */
  plain?: boolean
}) {
  const [failed, setFailed] = useState<string | null>(null)
  const photoClass = className ? `event-photo ${className}` : 'event-photo'
  if (!src || failed === src) return null
  if (plain || src.startsWith('data:')) {
    return (
      <div className={photoClass}>
        <img src={src} alt={alt} decoding="async" onError={() => setFailed(src)} />
      </div>
    )
  }
  return (
    <a className={photoClass} href={src} target="_blank" rel="noreferrer">
      <img src={src} alt={alt} decoding="async" onError={() => setFailed(src)} />
    </a>
  )
}
