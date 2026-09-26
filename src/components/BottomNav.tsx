import { NavLink } from 'react-router-dom'
import { tabPath, type AppTab } from '../lib/navigation'

interface BottomNavProps {
  tab: AppTab
}

const TABS: Array<{ id: AppTab; label: string }> = [
  { id: 'today', label: 'Today' },
  { id: 'activities', label: 'Abhyas' },
  { id: 'metrics', label: 'Vitals' },
  { id: 'insights', label: 'Insights' },
]

export function BottomNav({ tab }: BottomNavProps) {
  return (
    <nav className="app-nav" aria-label="Main">
      {TABS.map(({ id, label }) => (
        <NavLink
          key={id}
          to={tabPath(id)}
          className={({ isActive }) =>
            `nav-item ${isActive || tab === id ? 'nav-item-active' : ''}`
          }
          aria-current={tab === id ? 'page' : undefined}
          end={id === 'today' || id === 'insights'}
        >
          <NavIcon tab={id} />
          <span className="nav-item-label">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

function NavIcon({ tab }: { tab: AppTab }) {
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
