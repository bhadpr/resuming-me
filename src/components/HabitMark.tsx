import { useState } from 'react'
import { HABIT_ART, habitArtFor, habitTemplateId } from '../data/habitArt'
import { useThemedArt } from '../hooks/useThemedArt'
import { isReminderPhotoData } from '../lib/eventPhotoUrl'
import { HabitIcon } from './HabitIcon'

/** Square habit picture, a chosen clipart, their photo, or a line icon. */
export function HabitMark({
  templateId = null,
  name,
  icon = null,
  photo = null,
}: {
  templateId?: string | null
  name?: string | null
  emoji?: string
  /** Clipart id for a habit they named. */
  icon?: string | null
  /** Their own photo. It takes the place of the clipart. */
  photo?: string | null
}) {
  const art = useThemedArt()
  const [failed, setFailed] = useState<string | null>(null)
  if (photo && isReminderPhotoData(photo) && failed !== photo) {
    return (
      <span className="activity-emoji activity-emoji-art habit-photo-mark" aria-hidden>
        <img src={photo} alt="" decoding="async" onError={() => setFailed(photo)} />
      </span>
    )
  }
  const chosen = !templateId && icon ? HABIT_ART[icon] : null
  const src = chosen || habitArtFor({ templateId, name })
  if (src) {
    return (
      <span className="activity-emoji activity-emoji-art" aria-hidden>
        <img src={art(src)} alt="" />
      </span>
    )
  }
  return (
    <span className="habit-mark" aria-hidden>
      <HabitIcon id={habitTemplateId({ templateId, name }) ?? 'custom'} />
    </span>
  )
}
