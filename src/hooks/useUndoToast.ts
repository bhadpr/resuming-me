import { useCallback, useEffect, useRef, useState } from 'react'

export const UNDO_TOAST_MS = 6_000

export type UndoToastState = {
  id: number
  message: string
  onUndo: () => void | Promise<void>
}

export function useUndoToast() {
  const [toast, setToast] = useState<UndoToastState | null>(null)
  const timerRef = useRef<number | null>(null)
  const idRef = useRef(0)
  const undoingRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimer()
    setToast(null)
  }, [clearTimer])

  const show = useCallback(
    (message: string, onUndo: () => void | Promise<void>) => {
      clearTimer()
      undoingRef.current = false
      const id = ++idRef.current
      setToast({ id, message, onUndo })
      timerRef.current = window.setTimeout(() => {
        setToast((current) => (current?.id === id ? null : current))
        timerRef.current = null
      }, UNDO_TOAST_MS)
    },
    [clearTimer],
  )

  const undo = useCallback(async () => {
    if (!toast || undoingRef.current) return
    undoingRef.current = true
    const action = toast.onUndo
    dismiss()
    try {
      await action()
    } finally {
      undoingRef.current = false
    }
  }, [toast, dismiss])

  useEffect(() => () => clearTimer(), [clearTimer])

  return { toast, show, dismiss, undo }
}
