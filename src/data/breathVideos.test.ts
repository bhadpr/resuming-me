import { describe, expect, it } from 'vitest'
import { BHASTRIKA_CLIPS, singleBreathClip, speedBreathClips } from './breathVideos'
import { KAPALABHATI_DEFAULT_SPEED } from './kapalbhatiVideos'

describe('pranayam clips', () => {
  it('starts Bhastrika with Medium in the middle, and Slow and Fast on the sides', () => {
    expect(BHASTRIKA_CLIPS.map((clip) => clip.speed)).toEqual(['slow', 'medium', 'fast'])
    expect(KAPALABHATI_DEFAULT_SPEED).toBe('medium')
    expect(speedBreathClips('bhastrika')).toBe(BHASTRIKA_CLIPS)
    for (const clip of BHASTRIKA_CLIPS) {
      expect(clip.src).toMatch(new RegExp(`/media/bhastrika-${clip.speed}\\.mp4$`))
      expect(clip.poster).toBe(`/habits/bhastrika/${clip.speed}.jpg`)
    }
  })

  it('uses one file for Bhramari and the slow Anulom Vilom clip', () => {
    expect(singleBreathClip('bhramari')?.src).toMatch(/\/media\/bhramari\.mp4$/)
    expect(singleBreathClip('anuloma_viloma')?.src).toMatch(/\/media\/anuloma-viloma\.mp4$/)
    expect(singleBreathClip('bhastrika')).toBeNull()
    expect(speedBreathClips('bhramari')).toBeNull()
    expect(speedBreathClips('kapalabhati')?.[1].speed).toBe('medium')
  })
})
