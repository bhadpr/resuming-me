import { ACTIVITY_TEMPLATES } from './activityTemplates'

/** Illustrations for habits that have a picture. Other habits keep their emoji. */
export const HABIT_ART: Record<string, string> = {
  exercise: '/habits/strength.png?v=3',
  stretching: '/habits/stretching.png?v=3',
  running: '/habits/running.png?v=3',
  walk: '/habits/walking.png?v=3',
  water: '/habits/water.png?v=3',
  bhramari: '/habits/bhramari.png?v=4',
  kapalabhati: '/habits/kapalabhati.png?v=4',
  bhastrika: '/habits/bhastrika.png?v=4',
  anuloma_viloma: '/habits/anuloma-viloma.png?v=4',
  meditate: '/habits/meditate.png?v=4',
  rejuvenation: '/habits/meditate.png?v=4',
  prayer: '/habits/prayer.png?v=4',
  relaxation: '/habits/relaxation.png?v=4',
  weight: '/habits/weight.png?v=3',
  steps: '/habits/steps.png?v=3',
  sleep_hours: '/habits/sleep.png?v=3',
  fasting: '/habits/fasting.png?v=3',
  protein: '/habits/protein.png?v=3',
  blood_pressure: '/habits/blood-pressure.png?v=3',
  heart_rate: '/habits/heart-rate.png?v=3',
  reading: '/habits/reading.png?v=3',
  writing: '/habits/writing.png?v=3',
  language: '/habits/language.png?v=3',
  music: '/habits/music.png?v=3',
  painting: '/habits/painting.png?v=3',
  dancing: '/habits/dancing.png?v=3',
}

/** Full-scene people art for the size step (not the compact tile icons). */
export const HABIT_SIZE_ART: Record<string, string> = {
  walk: '/habits/scenes/walking.png?v=1',
  running: '/habits/scenes/running.png?v=1',
  exercise: '/habits/scenes/strength.png?v=1',
  stretching: '/habits/scenes/exercises.png?v=1',
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
}

export function habitTemplateId(activity: {
  templateId?: string | null
  name?: string | null
}): string | null {
  if (activity.templateId) return activity.templateId
  const name = activity.name?.trim().toLowerCase()
  if (!name) return null
  if (NAME_ALIASES[name]) return NAME_ALIASES[name]
  const template = ACTIVITY_TEMPLATES.find((item) => item.label.toLowerCase() === name)
  return template?.id ?? null
}

export function habitArtFor(activity: {
  templateId?: string | null
  name?: string | null
}): string | null {
  if (activity.templateId && HABIT_ART[activity.templateId]) return HABIT_ART[activity.templateId]
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
