import { describe, expect, it } from 'vitest'
import { ayurvedicSuggestions } from './ayurvedicMedicines'

describe('ayurvedic suggestions', () => {
  it('waits until they type', () => {
    expect(ayurvedicSuggestions('')).toEqual([])
    expect(ayurvedicSuggestions('   ')).toEqual([])
  })

  it('matches a short name and a common alias', () => {
    expect(ayurvedicSuggestions('ash')[0]).toBe('Ashwagandha')
    expect(ayurvedicSuggestions('guduchi')).toEqual(['Giloy'])
  })

  it('keeps the list to 20', () => {
    expect(ayurvedicSuggestions('a').length).toBeLessThanOrEqual(20)
  })
})
