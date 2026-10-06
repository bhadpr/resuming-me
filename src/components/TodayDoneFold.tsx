import { useState, type ReactNode } from 'react'

interface TodayDoneFoldProps {
  label: string
  listClassName?: string
  children: ReactNode
}

/** One tappable line that opens the rows finished today. Closed by default. */
export function TodayDoneFold({ label, listClassName = 'today-list', children }: TodayDoneFoldProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className="reminder-done-today">
      <button
        type="button"
        className="today-extra-btn"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
      </button>
      {open && <ul className={listClassName}>{children}</ul>}
    </div>
  )
}
