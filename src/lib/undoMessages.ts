/** Calm undo-toast copy for Today write actions. */

export function formatSessionUndoMessage(
  activityName: string,
  durationSeconds: number,
): string {
  const minutes = Math.max(1, Math.round(durationSeconds / 60))
  return `Logged ${minutes} min of ${activityName}`
}

export function formatCompletedUndoMessage(activityName: string): string {
  return `Logged ${activityName}`
}

export function formatCountUndoMessage(activityName: string): string {
  return `Logged +1 of ${activityName}`
}

export function formatMetricUndoMessage(
  metricName: string,
  value: number,
  unit: string,
  secondary?: number | null,
): string {
  const shown = secondary == null ? String(value) : `${value}/${secondary}`
  return `Logged ${shown} ${unit} · ${metricName}`
}

export function formatSkipUndoMessage(activityName: string): string {
  return `Skipped ${activityName}`
}

export function formatRestDayUndoMessage(): string {
  return 'Rest day marked'
}

