import { habitArtFor, habitTemplateId } from '../data/habitArt'
import { HabitIcon } from './HabitIcon'

/** Square habit picture, or a line icon when there is no picture. */
export function HabitMark({
  templateId = null,
  name,
}: {
  templateId?: string | null
  name?: string | null
  emoji?: string
}) {
  const src = habitArtFor({ templateId, name })
  if (src) {
    return (
      <span className="activity-emoji activity-emoji-art" aria-hidden>
        <img src={src} alt="" />
      </span>
    )
  }
  return (
    <span className="habit-mark" aria-hidden>
      <HabitIcon id={habitTemplateId({ templateId, name }) ?? 'custom'} />
    </span>
  )
}
