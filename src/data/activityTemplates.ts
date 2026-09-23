import type { ActivityInput } from '../lib/activities'
import type { ActivityType, TrackingMode } from '../types/database'

export type ActivityTemplate = {
  id: string
  label: string
  emoji: string
  type: ActivityType
  trackingMode: TrackingMode
  /** Ongoing target before someone shrinks it. */
  defaultValue: number | null
  defaultUnit: string | null
  defaultWeekly: number | null
  /** Suggested first size. */
  tinyValue: number | null
  tinyUnit: string | null
  tinyWeekly: number | null
}

/**
 * Habits people try to keep, shared by onboarding and Add activity.
 * Each one can start in a few minutes. Chores and one-off tasks stay out.
 */
export const ACTIVITY_TEMPLATES: readonly ActivityTemplate[] = [
  { id: 'reading', label: 'Reading', emoji: '📖', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'walk', label: 'Walk', emoji: '🚶', type: 'daily', trackingMode: 'timer', defaultValue: 20, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'exercise', label: 'Exercise', emoji: '🏋️', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'meditate', label: 'Meditate', emoji: '🧘', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'pranayam', label: 'Pranayam', emoji: '🌬️', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 3, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'stretching', label: 'Stretching', emoji: '🤸', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'water', label: 'Water', emoji: '💧', type: 'daily', trackingMode: 'count', defaultValue: 8, defaultUnit: 'glasses', defaultWeekly: null, tinyValue: 8, tinyUnit: 'glasses', tinyWeekly: null },
  { id: 'journaling', label: 'Journaling', emoji: '📝', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'writing', label: 'Writing', emoji: '✍️', type: 'daily', trackingMode: 'timer', defaultValue: 15, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'study', label: 'Study', emoji: '🧠', type: 'daily', trackingMode: 'timer', defaultValue: 25, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'language', label: 'Language', emoji: '🗣️', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'music', label: 'Music', emoji: '🎵', type: 'daily', trackingMode: 'timer', defaultValue: 15, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
] as const

export function templateById(id: string): ActivityTemplate | undefined {
  return ACTIVITY_TEMPLATES.find((t) => t.id === id)
}

export function activityInputFromTemplate(
  template: ActivityTemplate,
  size: 'tiny' | 'default' = 'tiny',
): ActivityInput {
  const tiny = size === 'tiny'
  return {
    name: template.label,
    emoji: template.emoji,
    type: template.type,
    trackingMode: template.trackingMode,
    targetValue: tiny ? template.tinyValue : template.defaultValue,
    targetUnit: tiny ? template.tinyUnit : template.defaultUnit,
    weeklyTarget: tiny ? template.tinyWeekly : template.defaultWeekly,
    deadline: null,
    whyMatters: null,
    usuallyWhen: null,
  }
}

export function tinyHint(template: ActivityTemplate): string {
  if (template.trackingMode === 'timer' && template.tinyValue) {
    return `Suggested start: ${template.tinyValue} min`
  }
  if (template.id === 'water') {
    return 'A common daily amount is 2,000 ml, about 8 glasses.'
  }
  if (template.trackingMode === 'count' && template.tinyValue) {
    return `Suggested start: ${template.tinyValue}×`
  }
  if (template.tinyWeekly) return `Suggested start: ${template.tinyWeekly} / week`
  return 'Suggested start: once is enough'
}
