import { useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import { Icon, type IconName } from './Icon'

const GUIDE_KEY = 'resuming-tab-guide'

const PLACES: Array<{ icon: IconName; name: string; line: string }> = [
  { icon: 'today', name: 'nav.today', line: 'guide.today' },
  { icon: 'activities', name: 'nav.abhyas', line: 'guide.activity' },
  { icon: 'reminders', name: 'nav.reminders', line: 'guide.reminders' },
  { icon: 'metrics', name: 'nav.vitals', line: 'guide.health' },
]

/** One short map of the four tabs, until the person dismisses it. */
export function TabGuide() {
  const { t } = useLocale()
  const [open, setOpen] = useState(() => {
    try {
      return localStorage.getItem(GUIDE_KEY) !== '1'
    } catch {
      return true
    }
  })
  if (!open) return null

  return (
    <section className="tab-guide">
      <h3>{t('guide.title')}</h3>
      <ul>
        {PLACES.map(({ icon, name, line }) => (
          <li key={name}>
            <span className="tab-guide-mark">
              <Icon name={icon} size={24} className="nav-item-icon" />
              <span className="nav-item-label">{t(name)}</span>
            </span>
            <span className="tab-guide-line">{t(line)}</span>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="btn btn-secondary btn-compact"
        onClick={() => {
          try {
            localStorage.setItem(GUIDE_KEY, '1')
          } catch {
            // The guide can show again next visit.
          }
          setOpen(false)
        }}
      >
        {t('guide.close')}
      </button>
    </section>
  )
}
