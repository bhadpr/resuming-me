import { useLocale } from '../hooks/useLocale'

interface ToastProps {
  message: string
  onUndo?: () => void
  undoLabel?: string
}

/** Fixed bottom toast above the tab bar. */
export function Toast({ message, onUndo, undoLabel }: ToastProps) {
  const { t } = useLocale()
  return (
    <div className="app-toast" role="status" aria-live="polite">
      <span className="app-toast-message">{message}</span>
      {onUndo && (
        <>
          <span className="app-toast-sep" aria-hidden>
            ·
          </span>
          <button type="button" className="app-toast-undo" onClick={onUndo}>
            {undoLabel ?? t('toast.undo')}
          </button>
        </>
      )}
    </div>
  )
}
