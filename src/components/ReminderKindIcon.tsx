import type { ReminderKind } from '../lib/reminderSchedule'

/** Clay picture for a reminder kind, drawn like the habit pictures. */
export function ReminderKindMark({ kind }: { kind: ReminderKind }) {
  return (
    <span className="activity-emoji activity-emoji-art reminder-mark" aria-hidden>
      <img src={`/reminders/${kind}.webp`} alt="" width={320} height={320} loading="lazy" decoding="async" />
    </span>
  )
}
