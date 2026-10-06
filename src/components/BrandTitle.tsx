import { Link } from 'react-router-dom'
import { PRODUCT_NAME } from '../lib/site'

interface BrandTitleProps {
  as?: 'h1' | 'span'
  className?: string
  /** When set, replaces the product name (e.g. Settings). Logo still shows. */
  label?: string
  size?: 'sm' | 'lg'
  /** When set, the logo and name link here (the home page). */
  homeTo?: string
}

export function BrandTitle({
  as: Tag = 'h1',
  className = '',
  label = PRODUCT_NAME,
  size = 'sm',
  homeTo,
}: BrandTitleProps) {
  const mark = (
    <>
      <img
        className="brand-mark"
        src="/logo.svg"
        alt=""
        width={size === 'lg' ? 68 : 44}
        height={size === 'lg' ? 68 : 44}
        decoding="async"
      />
      <span className="brand-title-text">{label}</span>
    </>
  )
  return (
    <Tag className={`brand-title brand-title-${size} ${className}`.trim()}>
      {homeTo ? (
        <Link to={homeTo} className="brand-home-link" aria-label={`${label}, home`}>
          {mark}
        </Link>
      ) : (
        mark
      )}
    </Tag>
  )
}
