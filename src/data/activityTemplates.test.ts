import { describe, expect, it } from 'vitest'
import { ACTIVITY_TEMPLATES, HABIT_GROUPS, activityInputFromTemplate, templateById } from './activityTemplates'

describe('activity templates', () => {
  it('groups the first-screen habits and starts Reading at the tiny size', () => {
    expect(HABIT_GROUPS.map((group) => group.title)).toEqual([
      'Fitness',
      'Pranayam',
      'Heartfulness',
      'Learn',
      'Creativity',
    ])
    expect(HABIT_GROUPS.flatMap((group) => group.ids).map((id) => templateById(id)?.label)).toEqual([
      'Walking',
      'Running',
      'Strength',
      'Exercises',
      'Bhastrika',
      'Kapalabhati',
      'Anuloma Viloma',
      'Bhramari',
      'Relaxation',
      'Meditation',
      'Rejuvenation',
      'Prayer',
      'Reading',
      'Writing',
      'Language',
      'Music',
      'Painting',
      'Dancing',
    ])
    expect(HABIT_GROUPS.find((group) => group.title === 'Pranayam')?.icons).toBe(false)
    const reading = ACTIVITY_TEMPLATES.find((template) => template.id === 'reading')
    expect(reading).toBeTruthy()
    const input = activityInputFromTemplate(reading!, 'tiny')
    expect(input.targetValue).toBe(2)
    expect(input.targetUnit).toBe('minutes')
    expect(activityInputFromTemplate(reading!, 'default').targetValue).toBe(10)
  })

  it('starts exercise and water at a tiny daily size', () => {
    const exercise = ACTIVITY_TEMPLATES.find((template) => template.id === 'exercise')!
    expect(activityInputFromTemplate(exercise).targetValue).toBe(5)
    expect(activityInputFromTemplate(exercise).targetUnit).toBe('minutes')
    const water = ACTIVITY_TEMPLATES.find((template) => template.id === 'water')!
    expect(activityInputFromTemplate(water).targetValue).toBe(8)
    expect(activityInputFromTemplate(water).targetUnit).toBe('glasses')
    const protein = ACTIVITY_TEMPLATES.find((template) => template.id === 'protein')!
    expect(activityInputFromTemplate(protein).targetValue).toBe(50)
    expect(activityInputFromTemplate(protein).targetUnit).toBe('g')
    const fasting = ACTIVITY_TEMPLATES.find((template) => template.id === 'fasting')!
    expect(activityInputFromTemplate(fasting).targetValue).toBe(16)
    expect(activityInputFromTemplate(fasting).targetUnit).toBe('hours')
    expect(ACTIVITY_TEMPLATES.some((template) => template.id === 'taxes' || template.id === 'tidy')).toBe(
      false,
    )
  })
})