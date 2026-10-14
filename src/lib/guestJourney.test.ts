import { describe, expect, it } from 'vitest'
import { bindLocale, t } from './i18n'
import { isCatalogLabel, templateLabel, visibleName } from './catalogName'
import { parseGuestJourney } from './guestJourney'

describe('catalog names follow the language', () => {
  it('keeps a custom name and translates a catalog habit', () => {
    bindLocale('en')
    expect(visibleName({ name: 'Walking', template_id: 'walk' })).toBe('Walking')
    expect(visibleName({ name: 'Guitar with dad', template_id: null })).toBe('Guitar with dad')
    expect(isCatalogLabel('walk', 'Walking')).toBe(true)
    expect(isCatalogLabel('walk', 'Morning walk')).toBe(false)

    bindLocale('hi')
    expect(templateLabel('walk')).toBe('चलना')
    expect(templateLabel('rejuvenation')).toBe('सफाई')
    expect(isCatalogLabel('rejuvenation', 'Cleaning')).toBe(true)
    expect(visibleName({ name: 'Walking', template_id: 'walk' })).toBe('चलना')
    bindLocale('te')
    expect(templateLabel('walk')).toBe('నడక')
    expect(templateLabel('rejuvenation')).toBe('శుభ్రం')
    expect(t('nav.abhyas')).toBe('అభ్యాసం')
    bindLocale('gu')
    expect(templateLabel('walk')).toBe('ચાલવું')
    expect(templateLabel('rejuvenation')).toBe('સફાઈ')
    expect(t('nav.abhyas')).toBe('અભ્યાસ')
    bindLocale('hi')
    expect(visibleName({ name: 'Walking', template_id: 'walk' })).toBe('चलना')
    expect(visibleName({ name: 'सुबह मंदिर', templateId: null })).toBe('सुबह मंदिर')
    expect(
      visibleName({ name: 'Morning walk', template_id: 'walk', name_overridden: true }),
    ).toBe('Morning walk')
    bindLocale('en')
  })
})

describe('parseGuestJourney', () => {
  it('reads the journey and create totals counted in the database', () => {
    const result = parseGuestJourney({
      journey: {
        landing: 1,
        intentStarted: 1,
        setupStarted: 1,
        habitsPicked: 1,
        firstLog: 1,
        signInShown: 1,
        signups: 1,
      },
      creates: {
        habitsCatalog: 1,
        habitsCustom: 1,
        vitalsCatalog: 1,
        vitalsCustom: 1,
        topHabits: [{ id: 'walk', count: 1 }],
        topVitals: [{ id: 'weight', count: 1 }],
      },
    })
    expect(result.journey).toEqual({
      landing: 1,
      intentStarted: 1,
      setupStarted: 1,
      habitsPicked: 1,
      firstLog: 1,
      signInShown: 1,
      signups: 1,
    })
    expect(result.creates).toMatchObject({ habitsCatalog: 1, habitsCustom: 1, vitalsCatalog: 1, vitalsCustom: 1 })
    expect(result.creates.topHabits).toEqual([{ id: 'walk', count: 1 }])
    expect(result.creates.topVitals).toEqual([{ id: 'weight', count: 1 }])
  })

  it('treats a missing result as zeros', () => {
    const result = parseGuestJourney(null)
    expect(result.journey.landing).toBe(0)
    expect(result.creates.topHabits).toEqual([])
  })
})
