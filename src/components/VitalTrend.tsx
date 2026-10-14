import { useEffect } from 'react'
import type { Metric } from '../lib/metrics'
import type { MetricEntry } from '../lib/metricEntries'
import type { Activity } from '../lib/activities'
import { habitGoalFor, vitalTargetFor, weightDirection, type VitalPoint } from '../lib/vitalChart'
import { setVitalDirection, vitalDirection, vitalTarget } from '../lib/vitalTargets'
import { MetricTrendChart } from './MetricTrendChart'

/**
 * A vital's chart with its target. The target and the weight direction live on this device.
 * Weight's direction comes from the first reading we have, then stays fixed until the target changes.
 */
export function VitalTrend({
  metric,
  entries,
  activities,
  values,
  windowDays,
  today,
}: {
  metric: Metric
  /** Every loaded reading, to find where weight started. */
  entries: MetricEntry[]
  /** Habits, so water, protein, fasting and steps can use their habit goal when no target is saved here. */
  activities: Activity[]
  /** The readings inside the window being drawn. */
  values: VitalPoint[]
  windowDays: number
  today: string
}) {
  const saved = vitalTarget(metric.id) ?? habitGoalFor(metric, activities)
  const stored = vitalDirection(metric.id)
  const earliest = entries.reduce<MetricEntry | null>(
    (best, entry) => (best == null || entry.date < best.date ? entry : best),
    null,
  )
  const derived = saved != null && earliest ? weightDirection(saved, Number(earliest.value)) : null
  const direction = stored ?? derived
  const target = vitalTargetFor(metric, saved, direction)

  useEffect(() => {
    if (target?.kind === 'weight' && stored == null && derived != null) {
      setVitalDirection(metric.id, derived)
    }
  }, [metric.id, stored, derived, target?.kind])

  return (
    <MetricTrendChart
      values={values}
      unit={metric.unit}
      target={target}
      windowDays={windowDays}
      today={today}
    />
  )
}
