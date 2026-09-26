type HabitIconProps = {
  id: string
  className?: string
}

/** Line icon for a catalog habit. The chip label is the accessible name. */
export function HabitIcon({ id, className = 'habit-icon' }: HabitIconProps) {
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
    >
      <IconPaths id={id} />
    </svg>
  )
}

function IconPaths({ id }: { id: string }) {
  switch (id) {
    case 'walk':
      return (
        <>
          <circle cx="13" cy="4.5" r="1.6" />
          <path d="M8 21l2.2-6.2L8.4 11 11 8.5l2.4 1.6 2.2 4.2" />
          <path d="M10.2 14.8L13 21" />
          <path d="M11 8.5L8.2 10" />
        </>
      )
    case 'exercise':
      return (
        <>
          <path d="M6 9v6" />
          <path d="M18 9v6" />
          <path d="M4 10.5v3" />
          <path d="M20 10.5v3" />
          <path d="M6 12h12" />
        </>
      )
    case 'stretching':
      return (
        <>
          <circle cx="12" cy="5" r="1.6" />
          <path d="M12 7.2v5.2" />
          <path d="M7 9.5l5 2.2 5-2.2" />
          <path d="M12 12.4l-3.2 7" />
          <path d="M12 12.4l3.2 7" />
        </>
      )
    case 'water':
      return <path d="M12 3.5s5.5 6.2 5.5 9.4a5.5 5.5 0 1 1-11 0C6.5 9.7 12 3.5 12 3.5z" />
    case 'protein':
      return (
        <>
          <path d="M5 14.5c0-3.2 2.6-5 7-5s7 1.8 7 5" />
          <path d="M5 14.5c.6 3.2 3 5 7 5s6.4-1.8 7-5" />
          <path d="M9 9.5c.4-2.2 1.6-3.5 3-3.5s2.6 1.3 3 3.5" />
        </>
      )
    case 'fasting':
      return (
        <>
          <circle cx="12" cy="12" r="6.5" />
          <path d="M12 8.2V12l2.4 1.6" />
        </>
      )
    case 'weight':
      return (
        <>
          <circle cx="12" cy="6.2" r="1.7" />
          <path d="M5.5 19.5h13" />
          <path d="M7.2 19.5l1.6-6.2h6.4l1.6 6.2" />
        </>
      )
    case 'steps':
      return (
        <>
          <path d="M9.2 4.8c1 0 1.7.7 1.7 1.8 0 1.8-1.7 4-1.7 4s-1.7-2.2-1.7-4c0-1.1.7-1.8 1.7-1.8z" />
          <path d="M15.2 10.2c1 0 1.7.7 1.7 1.8 0 1.8-1.7 4-1.7 4s-1.7-2.2-1.7-4c0-1.1.7-1.8 1.7-1.8z" />
        </>
      )
    case 'blood_pressure':
      return (
        <>
          <path d="M7 16.5c0-3.2 2.2-5.5 5-5.5s5 2.3 5 5.5" />
          <path d="M12 11V6" />
          <path d="M9.2 8.4L12 5.6l2.8 2.8" />
        </>
      )
    case 'heart_rate':
      return <path d="M3.5 12h3.2l1.6-3.2 2.6 6.4 2-3.2H20.5" />
    case 'systolic':
      return (
        <>
          <path d="M12 19V7" />
          <path d="M7.2 11.2L12 6.4l4.8 4.8" />
        </>
      )
    case 'diastolic':
      return (
        <>
          <path d="M12 5v12" />
          <path d="M7.2 12.8L12 17.6l4.8-4.8" />
        </>
      )
    case 'reading':
      return (
        <>
          <path d="M4.5 6.5h6.2A2.3 2.3 0 0 1 13 8.8V19H7.2A2.7 2.7 0 0 0 4.5 16.3z" />
          <path d="M19.5 6.5h-6.2A2.3 2.3 0 0 0 11 8.8V19h5.8a2.7 2.7 0 0 0 2.7-2.7z" />
        </>
      )
    case 'writing':
      return (
        <>
          <path d="M14.2 5.2l4.6 4.6L9.2 19.4 4.5 19.5l.1-4.7z" />
          <path d="M12.6 6.8l4.6 4.6" />
        </>
      )
    case 'journaling':
      return (
        <>
          <path d="M7 4.5h10.5v15H7z" />
          <path d="M7 4.5H6.2A1.7 1.7 0 0 0 4.5 6.2v11.6" />
          <path d="M10 9h5" />
          <path d="M10 12.5h5" />
        </>
      )
    case 'study':
      return (
        <>
          <path d="M3.5 9.5L12 5.5l8.5 4L12 13.5z" />
          <path d="M7.5 11.2v4.2c1.4 1.2 2.9 1.8 4.5 1.8s3.1-.6 4.5-1.8v-4.2" />
        </>
      )
    case 'painting':
      return (
        <>
          <path d="M14.5 4.5l5 5-8.2 8.2H6.3v-5z" />
          <path d="M12.2 6.8l5 5" />
          <path d="M5 19.5h8" />
        </>
      )
    case 'dancing':
      return (
        <>
          <circle cx="14" cy="4.6" r="1.6" />
          <path d="M14 6.6l-2.2 4.2 3.2 1.4" />
          <path d="M11.8 10.8L7.5 13" />
          <path d="M11.8 10.8l1.2 5.2-3.6 3.4" />
          <path d="M13 16l3.4 4" />
        </>
      )
    case 'music':
      return (
        <>
          <path d="M9 17.5a2.2 2.2 0 1 1-2.2-2.2H9z" />
          <path d="M16.5 15.2a2.2 2.2 0 1 1-2.2-2.2h2.2z" />
          <path d="M9 15.3V6.8l7.5-2v10.4" />
        </>
      )
    case 'language':
      return (
        <>
          <path d="M4.5 6.5h9" />
          <path d="M9 6.5c0 4.2-2.2 7.2-4.5 8.5" />
          <path d="M6.2 10.2c1.1 1.4 2.8 2.8 5.3 3.6" />
          <path d="M13.5 19l3.2-8 3.3 8" />
          <path d="M14.6 16.2h4.4" />
        </>
      )
    case 'meditate':
    case 'rejuvenation':
      return (
        <>
          <circle cx="12" cy="5.2" r="1.6" />
          <path d="M12 7.4c-1.6 1.5-3.4 2.2-5.2 2.4 1.2 1.6 2.6 2.4 5.2 2.4s4-.8 5.2-2.4c-1.8-.2-3.6-.9-5.2-2.4z" />
          <path d="M8.2 14.2c-2.2 1.2-3.6 3-4.2 5.3h16c-.6-2.3-2-4.1-4.2-5.3" />
        </>
      )
    case 'cleaning':
      return (
        <>
          <path d="M14.5 4.5l5 5" />
          <path d="M12.8 6.2l5 5-7.2 7.2H5.6v-5z" />
          <path d="M9.2 9.8l5 5" />
        </>
      )
    case 'prayer':
      return (
        <>
          <path d="M12 20V11" />
          <path d="M12 13.5c-2.4-1.2-4-3.4-4.2-6.2.8 1.4 2.2 2.2 4.2 2.2s3.4-.8 4.2-2.2c-.2 2.8-1.8 5-4.2 6.2z" />
        </>
      )
    case 'daily_writing':
      return (
        <>
          <path d="M6 4.5h9.5L19 8v11.5H6z" />
          <path d="M15.2 4.5V8H19" />
          <path d="M9 12.5h6" />
          <path d="M9 16h4" />
        </>
      )
    case 'bhastrika':
    case 'kapalabhati':
    case 'anuloma_viloma':
    case 'bhramari':
      return <circle cx="12" cy="12" r="5.5" />
    case 'running':
      return (
        <>
          <circle cx="15" cy="4.5" r="1.6" />
          <path d="M14 8.2l-3.2 2.2-2 3.2" />
          <path d="M10.8 10.4l3.4 1.2 1.6 3.6" />
          <path d="M8.2 13.6L6 18" />
          <path d="M14.2 15.2L16.5 20" />
        </>
      )
    case 'sleep_hours':
      return (
        <>
          <path d="M16 4.5a6.5 6.5 0 1 0 3.5 11.2A7 7 0 0 1 16 4.5z" />
        </>
      )
    case 'relaxation':
    case 'diary':
      return (
        <>
          <path d="M7 4.5h10.5v15H7z" />
          <path d="M7 4.5H5.5v15H7" />
          <path d="M10 8.5h5" />
          <path d="M10 12h5" />
        </>
      )
    default:
      return <path d="M12 6v12M6 12h12" />
  }
}
