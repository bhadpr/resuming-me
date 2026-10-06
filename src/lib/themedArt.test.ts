import { describe, expect, it } from 'vitest'
import { themedArt } from './themedArt'

describe('themedArt', () => {
  it('uses the Sky copy of clay pictures in the Sky theme', () => {
    expect(themedArt('/habits/walking.webp', 'sky')).toBe('/themes/sky/habits/walking.webp')
    expect(themedArt('/habits/scenes/walking.webp', 'sky')).toBe('/themes/sky/habits/scenes/walking.webp')
    expect(themedArt('/reminders/bill.webp', 'sky')).toBe('/themes/sky/reminders/bill.webp')
    expect(themedArt('/medicines/ayurvedic.webp', 'sky')).toBe('/themes/sky/medicines/ayurvedic.webp')
  })

  it('keeps the original pictures in other themes', () => {
    expect(themedArt('/habits/walking.webp', 'dawn')).toBe('/habits/walking.webp')
    expect(themedArt('/habits/walking.webp', 'slate')).toBe('/habits/walking.webp')
  })

  it('leaves photos alone', () => {
    expect(themedArt('data:image/webp;base64,AAAA', 'sky')).toBe('data:image/webp;base64,AAAA')
    expect(themedArt('https://example.com/pill.jpg', 'sky')).toBe('https://example.com/pill.jpg')
  })
})
