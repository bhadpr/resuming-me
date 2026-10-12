/** Calm undo-toast copy for Today write actions. */
import { t } from './i18n'

export function formatSessionUndoMessage(
  activityName: string,
  durationSeconds: number,
): string {
  const minutes = Math.max(1, Math.round(durationSeconds / 60))
  return t('toast.loggedMinutes', { minutes, name: activityName })
}

export function formatCompletedUndoMessage(activityName: string): string {
  return t('toast.logged', { name: activityName })
}

export function formatCountUndoMessage(activityName: string): string {
  return t('toast.loggedCount', { name: activityName })
}

export function formatMetricUndoMessage(
  metricName: string,
  value: number,
  unit: string,
  secondary?: number | null,
): string {
  const shown = secondary == null ? String(value) : `${value}/${secondary}`
  return t('toast.loggedValue', { value: shown, unit, name: metricName })
}

export function formatSkipUndoMessage(activityName: string): string {
  return t('toast.skipped', { name: activityName })
}

export function formatRestDayUndoMessage(): string {
  return t('toast.restDay')
}
