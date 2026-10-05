import { ACTIVITY_TEMPLATES } from './activityTemplates'

/** Illustrations for habits that have a picture. Other habits keep their emoji. */
export const HABIT_ART: Record<string, string> = {
  exercise: '/habits/strength.webp',
  stretching: '/habits/stretching.webp',
  running: '/habits/running.webp',
  walk: '/habits/walking.webp',
  water: '/habits/water.webp',
  bhramari: '/habits/bhramari.webp',
  kapalabhati: '/habits/kapalabhati.webp',
  bhastrika: '/habits/bhastrika.webp',
  anuloma_viloma: '/habits/anuloma-viloma.webp',
  meditate: '/habits/meditate.webp',
  rejuvenation: '/habits/meditate.webp',
  prayer: '/habits/prayer.webp',
  relaxation: '/habits/relaxation.webp',
  weight: '/habits/weight.webp',
  steps: '/habits/steps.webp',
  sleep_hours: '/habits/sleep.webp',
  fasting: '/habits/fasting.webp',
  protein: '/habits/protein.webp',
  blood_pressure: '/habits/blood-pressure.webp',
  heart_rate: '/habits/heart-rate.webp',
  reading: '/habits/reading.webp',
  writing: '/habits/writing.webp',
  journaling: '/habits/journaling.webp',
  daily_writing: '/habits/daily-writing.webp',
  study: '/habits/study.webp',
  language: '/habits/language.webp',
  music: '/habits/music.webp',
  painting: '/habits/painting.webp',
  dancing: '/habits/dancing.webp',
}

/** Full-scene people art for the size step (not the compact tile icons). */
export const HABIT_SIZE_ART: Record<string, string> = {
  walk: '/habits/scenes/walking.webp',
  running: '/habits/scenes/running.webp',
  exercise: '/habits/scenes/strength.webp',
  stretching: '/habits/scenes/exercises.webp',
}

const NAME_ALIASES: Record<string, string> = {
  exercise: 'exercise',
  strength: 'exercise',
  weight: 'weight',
  'daily steps': 'steps',
  systolic: 'systolic',
  diastolic: 'diastolic',
  'blood pressure': 'blood_pressure',
  'heart rate': 'heart_rate',
  cleaning: 'rejuvenation',
}

export function habitTemplateId(activity: {
  templateId?: string | null
  template_id?: string | null
  name?: string | null
}): string | null {
  if (activity.templateId) return activity.templateId
  if (activity.template_id) return activity.template_id
  const name = activity.name?.trim().toLowerCase()
  if (!name) return null
  if (NAME_ALIASES[name]) return NAME_ALIASES[name]
  const template = ACTIVITY_TEMPLATES.find((item) => item.label.toLowerCase() === name)
  return template?.id ?? null
}

export function habitArtFor(activity: {
  templateId?: string | null
  template_id?: string | null
  name?: string | null
}): string | null {
  const id = activity.templateId ?? activity.template_id
  if (id && HABIT_ART[id]) return HABIT_ART[id]
  const name = activity.name?.trim().toLowerCase()
  if (!name) return null
  const alias = NAME_ALIASES[name]
  if (alias && HABIT_ART[alias]) return HABIT_ART[alias]
  const template = ACTIVITY_TEMPLATES.find((item) => item.label.toLowerCase() === name)
  if (template && HABIT_ART[template.id]) return HABIT_ART[template.id]
  return null
}

/** Larger scene art for start step 3. Falls back to the compact habit tile art. */
export function habitSizeArtFor(activity: {
  templateId?: string | null
  name?: string | null
}): string | null {
  const templateId = habitTemplateId(activity)
  if (templateId && HABIT_SIZE_ART[templateId]) return HABIT_SIZE_ART[templateId]
  return habitArtFor(activity)
}
