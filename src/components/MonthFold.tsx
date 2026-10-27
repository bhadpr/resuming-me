import { useState, type ReactNode } from 'react'
import { useLocale } from '../hooks/useLocale'
import { monthTitle, monthsClosedByDefault } from '../lib/monthFold'
import { Icon } from './Icon'

/** Remembers which months the person closed. Resets when the set of months changes. */
export function useClosedMonths(keys: readonly string[], today: string, closeAfter = false): {
  isOpen: (key: string) => boolean
  toggle: (key: string) => void
} {
  const signature = `${today}:${closeAfter ? 'after' : 'open'}:${keys.join('|')}`
  const [state, setState] = useState(() => ({
    signature,
    closed: monthsClosedByDefault(keys, today, closeAfter),
  }))
  if (state.signature !== signature) {
    setState({ signature, closed: monthsClosedByDefault(keys, today, closeAfter) })
  }

  function toggle(key: string) {
    setState((current) => {
      const closed = new Set(current.closed)
      if (closed.has(key)) closed.delete(key)
      else closed.add(key)
      return { signature: current.signature, closed }
    })
  }

  return { isOpen: (key: string) => !state.closed.has(key), toggle }
}

/** A section heading that shows or hides what is under it. */
export function SectionFold({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <section className={`community-section month-fold${open ? ' is-open' : ''}`}>
      <h3 className="community-section-title">
        <button type="button" className="month-fold-toggle" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          <span className="month-fold-name">{title}</span>
          <span className="month-fold-chevron" aria-hidden>
            <Icon name="chevron" />
          </span>
        </button>
      </h3>
      <div className="month-fold-body" hidden={!open}>
        {children}
      </div>
    </section>
  )
}

/** A month heading that shows or hides the days under it. */
export function MonthFold({
  monthKey,
  count,
  open,
  onToggle,
  children,
}: {
  monthKey: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const { locale, t } = useLocale()
  return (
    <section className={`month-fold${open ? ' is-open' : ''}`}>
      <button type="button" className="month-fold-toggle" aria-expanded={open} onClick={onToggle}>
        <span className="month-fold-name">{monthTitle(monthKey, locale)}</span>
        <span className="month-fold-count">
          {count === 1 ? t('reminders.community.day') : t('reminders.community.days', { count })}
        </span>
        <span className="month-fold-chevron" aria-hidden>
          <Icon name="chevron" />
        </span>
      </button>
      {open && <div className="month-fold-body">{children}</div>}
    </section>
  )
}
