import { NavLink } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import { tabPath, type AppTab } from '../lib/navigation'
import { Icon } from './Icon'

interface BottomNavProps {
  tab: AppTab
}

const TABS: Array<{ id: AppTab; labelKey: string }> = [
  { id: 'today', labelKey: 'nav.today' },
  { id: 'activities', labelKey: 'nav.abhyas' },
  { id: 'metrics', labelKey: 'nav.vitals' },
  { id: 'insights', labelKey: 'nav.insights' },
]

export function BottomNav({ tab }: BottomNavProps) {
  const { t } = useLocale()
  return (
    <nav className="app-nav" aria-label="Main">
      {TABS.map(({ id, labelKey }) => (
        <NavLink
          key={id}
          to={tabPath(id)}
          className={({ isActive }) =>
            `nav-item ${isActive || tab === id ? 'nav-item-active' : ''}`
          }
          aria-current={tab === id ? 'page' : undefined}
          end={id === 'today' || id === 'insights'}
        >
          <Icon name={id} size={24} className="nav-item-icon" />
          <span className="nav-item-label">{t(labelKey)}</span>
        </NavLink>
      ))}
    </nav>
  )
}
