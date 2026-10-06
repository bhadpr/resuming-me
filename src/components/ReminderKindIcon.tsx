import { useThemedArt } from '../hooks/useThemedArt'
import type { ReminderKind } from '../lib/reminderSchedule'

/** Clay picture for a reminder kind, drawn like the habit pictures. */
export function ReminderKindMark({ kind }: { kind: ReminderKind }) {
  const art = useThemedArt()
  return (
    <span className="activity-emoji activity-emoji-art reminder-mark" aria-hidden>
      <img src={art(`/reminders/${kind}.webp`)} alt="" width={320} height={320} loading="lazy" decoding="async" />
    </span>
  )
}
