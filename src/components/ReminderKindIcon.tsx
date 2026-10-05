import type { ReminderKind } from '../lib/reminderSchedule'

/** Line icon for a reminder kind, drawn like the habit icons. */
export function ReminderKindIcon({ kind, className = 'habit-icon' }: { kind: ReminderKind; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <KindPaths kind={kind} />
    </svg>
  )
}

function KindPaths({ kind }: { kind: ReminderKind }) {
  switch (kind) {
    case 'errand':
      return (
        <>
          <path d="M5.5 8h13l-1 12.5h-11L5.5 8z" />
          <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
        </>
      )
    case 'bill':
      return (
        <>
          <path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21V3z" />
          <path d="M9 8h6M9 12h6M9 16h3" />
        </>
      )
    case 'doctor':
      return (
        <>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
          <path d="M12 8v8M8 12h8" />
        </>
      )
    case 'event':
      return (
        <>
          <path d="M4.5 11h15v9.5h-15z" />
          <path d="M3.5 7.5h17V11h-17z" />
          <path d="M12 7.5v13" />
          <path d="M12 7.5C10.5 4.5 7 4.5 7 6.2s3 1.3 5 1.3zM12 7.5c1.5-3 5-3 5-1.3s-3 1.3-5 1.3z" />
        </>
      )
    case 'other':
      return (
        <>
          <path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15L6 16z" />
          <path d="M10 20.5a2 2 0 0 0 4 0" />
        </>
      )
  }
}

/** Small rounded square with the kind icon, for reminder rows. */
export function ReminderKindMark({ kind }: { kind: ReminderKind }) {
  return (
    <span className="habit-mark reminder-mark" aria-hidden>
      <ReminderKindIcon kind={kind} />
    </span>
  )
}
