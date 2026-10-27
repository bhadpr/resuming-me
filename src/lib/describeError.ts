/** Text to show when a save throws. Database errors are plain objects, not Error instances. */
export function describeError(err: unknown, fallback: string): string {
  if (typeof err === 'string' && err.trim()) return err.trim()
  if (err instanceof Error && err.message.trim()) return err.message.trim()
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message?: unknown }).message
    if (typeof message === 'string' && message.trim()) return message.trim()
  }
  return fallback
}
