export type IconName =
  | 'back'
  | 'chevron'
  | 'check'
  | 'close'
  | 'settings'
  | 'today'
  | 'activities'
  | 'reminders'
  | 'metrics'
  | 'insights'
  | 'calendar'
  | 'lock'
  | 'photo'
  | 'share'

type IconProps = {
  name: IconName
  size?: 20 | 24
  className?: string
}

/** App control icons. One stroke width and two sizes so every control reads as one set. */
export function Icon({ name, size = 20, className = 'icon' }: IconProps) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <IconPaths name={name} />
    </svg>
  )
}

function IconPaths({ name }: { name: IconName }) {
  switch (name) {
    case 'back':
      return <path d="M15 5l-7 7 7 7" />
    case 'chevron':
      return <path d="M9 5l7 7-7 7" />
    case 'check':
      return <path d="M5 12.5l4.5 4.5L19 7.5" />
    case 'close':
      return <path d="M6 6l12 12M18 6L6 18" />
    case 'settings':
      return (
        <>
          <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z" />
          <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </>
      )
    case 'today':
      return (
        <>
          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M12 14h.01" />
        </>
      )
    case 'lock':
      return (
        <>
          <path d="M6 11h12a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-8a1 1 0 0 1 1-1z" />
          <path d="M8 11V7a4 4 0 0 1 8 0v4" />
        </>
      )
    case 'photo':
      return (
        <>
          <path d="M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M3 16l5-5 4 4 3-3 6 6" />
          <path d="M15.5 8.5h.01" />
        </>
      )
    case 'share':
      return (
        <>
          <path d="M18 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM18 22a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
          <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
        </>
      )
    case 'calendar':
      return (
        <>
          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" />
        </>
      )
    case 'activities':
      return (
        <>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3 6h.01M3 12h.01M3 18h.01" />
        </>
      )
    case 'reminders':
      return (
        <>
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </>
      )
    case 'metrics':
      return (
        <>
          <path d="M3 3v18h18" />
          <path d="M7 16l3-3 3 2 5-6" />
        </>
      )
    case 'insights':
      return <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
  }
}
