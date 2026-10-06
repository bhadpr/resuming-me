import { useLocale } from '../hooks/useLocale'

export function SkipLink({ disabled = false, onSkip }: { disabled?: boolean; onSkip: () => void }) {
  const { t } = useLocale()
  return (
    <button type="button" className="today-skip-link" disabled={disabled} onClick={onSkip}>
      {t('today.skip')}
    </button>
  )
}

export function UndoSkipButton({ disabled = false, onUndo }: { disabled?: boolean; onUndo: () => void }) {
  const { t } = useLocale()
  return (
    <button type="button" className="btn btn-secondary btn-today" disabled={disabled} onClick={onUndo}>
      {t('today.undoSkip')}
    </button>
  )
}
