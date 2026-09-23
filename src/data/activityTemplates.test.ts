import { describe, expect, it } from 'vitest'
import { ACTIVITY_TEMPLATES, activityInputFromTemplate } from './activityTemplates'

describe('activity templates', () => {
  it('includes Pranayam and starts Reading at the tiny size', () => {
    expect(ACTIVITY_TEMPLATES.some((template) => template.label === 'Pranayam')).toBe(true)
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
    expect(ACTIVITY_TEMPLATES.some((template) => template.id === 'taxes' || template.id === 'tidy')).toBe(
      false,
    )
  })
})