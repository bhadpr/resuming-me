import { Link } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import { Icon } from './Icon'

export function InsightsHeaderButton({ active }: { active: boolean }) {
  const { t } = useLocale()
  return (
    <Link
      to="/insights"
      className={`icon-btn ${active ? 'icon-btn-active' : ''}`}
      aria-label={t('nav.insights')}
      aria-current={active ? 'page' : undefined}
    >
      <Icon name="insights" size={24} />
    </Link>
  )
}
