type Tab = 'today' | 'activities' | 'metrics' | 'insights'

interface BottomNavProps {
  tab: Tab
  onTabChange: (tab: Tab) => void
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'activities', label: 'Activities' },
  { id: 'metrics', label: 'Metrics' },
  { id: 'insights', label: 'Insights' },
]

export function BottomNav({ tab, onTabChange }: BottomNavProps) {
  return (
    <nav className="app-nav" aria-label="Main">
      {TABS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={`nav-item ${tab === id ? 'nav-item-active' : ''}`}
          aria-current={tab === id ? 'page' : undefined}
          onClick={() => onTabChange(id)}
        >
          <NavIcon tab={id} />
          <span className="nav-item-label">{label}</span>
        </button>
      ))}
    </nav>
  )
}

function NavIcon({ tab }: { tab: Tab }) {
  return (
    <svg
      className="nav-item-icon"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {tab === 'today' && (
        <>
          <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
          <path d="M12 14h.01" />
        </>
      )}
      {tab === 'activities' && (
        <>
          <path d="M8 6h13M8 12h13M8 18h13" />
          <path d="M3 6h.01M3 12h.01M3 18h.01" />
        </>
      )}
      {tab === 'metrics' && (
        <>
          <path d="M3 3v18h18" />
          <path d="M7 16l3-3 3 2 5-6" />
        </>
      )}
      {tab === 'insights' && (
        <>
          <path d="M4 20V10M10 20V4M16 20v-6M22 20H2" />
        </>
      )}
    </svg>
  )
}
