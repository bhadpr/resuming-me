import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { loadGuestDraft } from '../lib/guestDraft'
import { PRODUCT_NAME } from '../lib/site'

interface BrandTitleProps {
  as?: 'h1' | 'span'
  className?: string
  /** When set, replaces the product name (e.g. Settings). Logo still shows. */
  label?: string
  size?: 'sm' | 'lg'
  /** When set, the logo and name link here. Otherwise Today, or the landing page. */
  homeTo?: string
  /** Logo only, for headers that already have a page title. */
  markOnly?: boolean
}

export function BrandTitle({
  as: Tag = 'h1',
  className = '',
  label = PRODUCT_NAME,
  size = 'sm',
  homeTo,
  markOnly = false,
}: BrandTitleProps) {
  const { user } = useAuth()
  const to = homeTo ?? (user || loadGuestDraft() ? '/today' : '/')
  return (
    <Tag className={`brand-title brand-title-${size} ${className}`.trim()}>
      <Link to={to} className="brand-home-link" aria-label={`${PRODUCT_NAME}, home`}>
        <img
          className="brand-mark"
          src="/logo.svg"
          alt=""
          width={size === 'lg' ? 68 : 44}
          height={size === 'lg' ? 68 : 44}
          decoding="async"
        />
        {!markOnly && <span className="brand-title-text">{label}</span>}
      </Link>
    </Tag>
  )
}
