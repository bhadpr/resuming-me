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
  { id: 'walk', label: 'Walking', emoji: '🚶', type: 'daily', trackingMode: 'timer', defaultValue: 20, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'running', label: 'Running', emoji: '🏃', type: 'daily', trackingMode: 'timer', defaultValue: 20, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'exercise', label: 'Strength', emoji: '🏋️', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'meditate', label: 'Meditation', emoji: '🧘', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'stretching', label: 'Exercises', emoji: '🤸', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'water', label: 'Water', emoji: '💧', type: 'daily', trackingMode: 'count', defaultValue: 8, defaultUnit: 'glasses', defaultWeekly: null, tinyValue: 8, tinyUnit: 'glasses', tinyWeekly: null },
  { id: 'protein', label: 'Protein', emoji: '🍽️', type: 'daily', trackingMode: 'count', defaultValue: 50, defaultUnit: 'g', defaultWeekly: null, tinyValue: 50, tinyUnit: 'g', tinyWeekly: null },
  { id: 'fasting', label: 'Fasting', emoji: '🌙', type: 'daily', trackingMode: 'count', defaultValue: 16, defaultUnit: 'hours', defaultWeekly: null, tinyValue: 16, tinyUnit: 'hours', tinyWeekly: null },
  { id: 'sleep_hours', label: 'Sleep', emoji: '😴', type: 'daily', trackingMode: 'count', defaultValue: 8, defaultUnit: 'hr', defaultWeekly: null, tinyValue: 8, tinyUnit: 'hr', tinyWeekly: null },
  { id: 'weight', label: 'Weight', emoji: '⚖️', type: 'daily', trackingMode: 'checkbox', defaultValue: null, defaultUnit: null, defaultWeekly: null, tinyValue: null, tinyUnit: null, tinyWeekly: null },
  { id: 'steps', label: 'Steps', emoji: '👣', type: 'daily', trackingMode: 'count', defaultValue: 10000, defaultUnit: 'steps', defaultWeekly: null, tinyValue: 10000, tinyUnit: 'steps', tinyWeekly: null },
  { id: 'blood_pressure', label: 'Blood Pressure', emoji: '❤️', type: 'daily', trackingMode: 'checkbox', defaultValue: null, defaultUnit: null, defaultWeekly: null, tinyValue: null, tinyUnit: null, tinyWeekly: null },
  { id: 'heart_rate', label: 'Heart Rate', emoji: '💓', type: 'daily', trackingMode: 'checkbox', defaultValue: null, defaultUnit: null, defaultWeekly: null, tinyValue: null, tinyUnit: null, tinyWeekly: null },
  { id: 'journaling', label: 'Journaling', emoji: '📝', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'writing', label: 'Writing', emoji: '✍️', type: 'daily', trackingMode: 'timer', defaultValue: 15, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'daily_writing', label: 'Daily Writing', emoji: '📄', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'study', label: 'Study', emoji: '🎓', type: 'daily', trackingMode: 'timer', defaultValue: 25, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'language', label: 'Language', emoji: '🗣️', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'music', label: 'Music', emoji: '🎵', type: 'daily', trackingMode: 'timer', defaultValue: 15, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'painting', label: 'Painting', emoji: '🎨', type: 'daily', trackingMode: 'timer', defaultValue: 15, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'dancing', label: 'Dancing', emoji: '💃', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 5, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'bhastrika', label: 'Bhastrika', emoji: '🌬️', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 3, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'kapalabhati', label: 'Kapalabhati', emoji: '💨', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 3, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'anuloma_viloma', label: 'Anuloma Viloma', emoji: '🔄', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 3, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'bhramari', label: 'Bhramari', emoji: '🐝', type: 'daily', trackingMode: 'timer', defaultValue: 10, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 3, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'rejuvenation', label: 'Rejuvenation', emoji: '🧘', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'prayer', label: 'Prayer', emoji: '🙏', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
  { id: 'relaxation', label: 'Relaxation', emoji: '😌', type: 'daily', trackingMode: 'timer', defaultValue: 5, defaultUnit: 'minutes', defaultWeekly: null, tinyValue: 2, tinyUnit: 'minutes', tinyWeekly: null },
] as const

/** First-screen groups. Something else stays outside these lists. */
export const HABIT_GROUPS: readonly { title: string; ids: readonly string[]; icons: boolean }[] = [
  { title: 'Fitness', ids: ['walk', 'running', 'exercise', 'stretching'], icons: true },
  { title: 'Pranayam', ids: ['bhastrika', 'kapalabhati', 'anuloma_viloma', 'bhramari'], icons: false },
  { title: 'Heartfulness', ids: ['relaxation', 'meditate', 'rejuvenation', 'prayer'], icons: true },
  { title: 'Learn', ids: ['reading', 'writing', 'language'], icons: true },
  { title: 'Creativity', ids: ['music', 'painting', 'dancing'], icons: true },
]

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
  if (template.id === 'protein') return 'A common daily amount is about 50 g.'
  if (template.id === 'fasting') return 'Each tap adds 4 hours.'
  if (template.id === 'sleep_hours') return 'A common night is about 8 hours.'
  if (template.trackingMode === 'count' && template.tinyValue) {
    return `Suggested start: ${template.tinyValue}×`
  }
  if (template.tinyWeekly) return `Suggested start: ${template.tinyWeekly} / week`
  return 'Suggested start: once is enough'
}
