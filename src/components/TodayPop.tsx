import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** A small card over Today. Escape or a tap outside closes it. */
export function TodayPop({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="today-pop" role="presentation" onClick={onClose}>
      <div
        className="today-pop-card"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="today-pop-title">{title}</h2>
        {children}
      </div>
    </div>,
    document.body,
  )
}
