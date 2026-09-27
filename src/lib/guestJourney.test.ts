import { describe, expect, it } from 'vitest'
import { bindLocale, t } from './i18n'
import { isCatalogLabel, templateLabel, visibleName } from './catalogName'
import { summarizeCreates, summarizeGuestJourney } from './guestJourney'

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

describe('guest journey', () => {
  it('counts unsigned steps by anonymous id and catalog vs custom creates', () => {
    const events = [
      { name: 'landing_viewed', anon_id: 'a' },
      { name: 'landing_viewed', anon_id: 'a' },
      { name: 'intent_journey_started', anon_id: 'a' },
      { name: 'onboarding_started', anon_id: 'a' },
      { name: 'onboarding_step_completed', anon_id: 'a', props: { step: 1 } },
      { name: 'log_created', anon_id: 'a', user_id: 'user-a', props: { signed_in: false } },
      { name: 'log_created', anon_id: 'b', user_id: 'user-b', props: { signed_in: true } },
      { name: 'signin_shown', anon_id: 'a' },
      { name: 'signup_completed', anon_id: 'a', user_id: 'user-a' },
      { name: 'activity_created', anon_id: 'a', props: { template_id: 'walk' } },
      { name: 'activity_created', anon_id: 'a', props: { template_id: 'custom' } },
      { name: 'metric_created', anon_id: 'c', props: { template_id: 'weight' } },
      { name: 'metric_created', anon_id: 'c', props: { template_id: 'custom' } },
      { name: 'activity_created', anon_id: 'old' },
    ]
    expect(summarizeGuestJourney(events)).toEqual({
      landing: 1,
      intentStarted: 1,
      setupStarted: 1,
      habitsPicked: 1,
      firstLog: 1,
      signInShown: 1,
      signups: 1,
    })
    expect(summarizeCreates(events)).toMatchObject({
      habitsCatalog: 1,
      habitsCustom: 1,
      vitalsCatalog: 1,
      vitalsCustom: 1,
    })
    expect(summarizeCreates(events).topHabits).toEqual([{ id: 'walk', count: 1 }])
    expect(summarizeCreates(events).topVitals).toEqual([{ id: 'weight', count: 1 }])
    expect(t('nav.today')).toBe('Today')
  })
})
