import type { Activity } from './activities'
import type { LogEntry } from './logs'
import type { Metric } from './metrics'
import type { MetricEntry } from './metricEntries'
import { isNumberEntryVital } from './onboardingFlow'
import type { GuestActivity, GuestDraft } from './guestDraft'

function vitalUnit(activity: GuestActivity): string {
  if (activity.templateId === 'blood_pressure') return 'mmHg'
  if (activity.templateId === 'heart_rate') return 'bpm'
  return activity.targetUnit || 'kg'
}

export function guestActivityRow(activity: GuestActivity, createdAt: string): Activity {
  return {
    id: activity.localId,
    user_id: 'guest',
    name: activity.name,
    emoji: activity.emoji,
    type: activity.type,
    tracking_mode: activity.trackingMode,
    target_value: activity.targetValue,
    target_unit: activity.targetUnit,
    target_effective_from: createdAt.slice(0, 10),
    weekly_target: activity.weeklyTarget,
    deadline: activity.deadline,
    why_matters: activity.why,
    usually_when: activity.usuallyWhen,
    off_weekdays: [],
    micro_steps: [],
    archived: activity.archived === true,
    template_id: activity.templateId,
    name_overridden: false,
    video_youtube_id: null,
    video_start_seconds: null,
    created_at: createdAt,
    updated_at: createdAt,
  }
}

/** Check-ins for one guest habit, shaped like signed-in log rows. The id is the log's place in the draft. */
export function guestLogsForActivity(draft: GuestDraft, localId: string): LogEntry[] {
  return draft.logs.flatMap((log, index) => {
    if (log.localActivityId !== localId) return []
    return [
      {
        id: String(index),
        activity_id: log.localActivityId,
        user_id: 'guest',
        type: log.kind === 'count' || log.kind === 'completed' ? 'completed' : 'session',
        source: null,
        started_at: log.startedAt,
        duration_seconds: log.durationSeconds,
        date: log.date,
        note: log.note ?? null,
        created_at: log.startedAt,
        updated_at: null,
      },
    ]
  })
}

/** Habits and numbers a guest has logged, shaped for the Insights screen. */
export function guestDraftInsights(draft: GuestDraft): {
  activities: Activity[]
  entries: LogEntry[]
  metrics: Metric[]
  metricEntries: MetricEntry[]
} {
  const createdAt = draft.createdAt
  const activities = draft.activities
    .filter((activity) => !isNumberEntryVital(activity))
    .map((activity) => guestActivityRow(activity, createdAt))
  const activityIds = new Set(activities.map((activity) => activity.id))
  const entries: LogEntry[] = draft.logs
    .filter((log) => activityIds.has(log.localActivityId))
    .map((log, index) => ({
      id: `guest-log-${index}`,
      activity_id: log.localActivityId,
      user_id: 'guest',
      type: log.kind === 'count' || log.kind === 'completed' ? 'completed' : 'session',
      source: null,
      started_at: log.startedAt,
      duration_seconds: log.durationSeconds,
      date: log.date,
      note: null,
      created_at: log.startedAt,
      updated_at: null,
    }))
  const vitals = draft.activities.filter((activity) => isNumberEntryVital(activity))
  const metrics: Metric[] = vitals.map((activity) => ({
    id: activity.localId,
    user_id: 'guest',
    name: activity.name,
    emoji: activity.emoji,
    unit: vitalUnit(activity),
    archived: false,
    template_id: activity.templateId,
    name_overridden: false,
    created_at: createdAt,
    updated_at: createdAt,
  }))
  const metricIds = new Set(metrics.map((metric) => metric.id))
  const metricEntries: MetricEntry[] = draft.readings
    .filter((reading) => metricIds.has(reading.localActivityId))
    .map((reading, index) => ({
      id: `guest-reading-${index}`,
      metric_id: reading.localActivityId,
      user_id: 'guest',
      date: reading.date,
      value: reading.value,
      secondary_value: reading.secondaryValue,
      created_at: createdAt,
      updated_at: createdAt,
    }))
  return { activities, entries, metrics, metricEntries }
}
