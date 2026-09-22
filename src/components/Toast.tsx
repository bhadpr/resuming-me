interface ToastProps {
  message: string
  onUndo: () => void
  undoLabel?: string
}

/** Fixed bottom toast above the tab bar. Accessible status + Undo button. */
export function Toast({ message, onUndo, undoLabel = 'Undo' }: ToastProps) {
  return (
    <div className="app-toast" role="status" aria-live="polite">
      <span className="app-toast-message">{message}</span>
      <span className="app-toast-sep" aria-hidden>
        ·
      </span>
      <button type="button" className="app-toast-undo" onClick={onUndo}>
        {undoLabel}
      </button>
    </div>
  )
}
