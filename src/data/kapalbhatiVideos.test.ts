import { describe, expect, it } from 'vitest'
import {
  KAPALABHATI_CLIPS,
  KAPALABHATI_DEFAULT_SPEED,
  kapalabhatiNeighbours,
  usesKapalabhatiClips,
} from './kapalbhatiVideos'

describe('Kapalabhati clips', () => {
  it('has the three speeds in order, each with a file and a picture', () => {
    expect(KAPALABHATI_CLIPS.map((clip) => clip.speed)).toEqual(['slow', 'medium', 'fast'])
    for (const clip of KAPALABHATI_CLIPS) {
      expect(clip.src).toMatch(new RegExp(`/media/kapalbhati-${clip.speed}\\.mp4$`))
      expect(clip.poster).toBe(`/habits/kapalbhati/${clip.speed}.webp`)
    }
  })

  it('starts with Medium in the middle', () => {
    expect(KAPALABHATI_DEFAULT_SPEED).toBe('medium')
    expect(kapalabhatiNeighbours('medium')).toEqual({ left: 'slow', right: 'fast' })
  })

  it('goes round so both sides are always filled', () => {
    expect(kapalabhatiNeighbours('slow')).toEqual({ left: 'fast', right: 'medium' })
    expect(kapalabhatiNeighbours('fast')).toEqual({ left: 'medium', right: 'slow' })
  })

  it('replaces the built-in video for Kapalabhati only, and never one the person added', () => {
    expect(usesKapalabhatiClips('kapalabhati')).toBe(true)
    expect(usesKapalabhatiClips('bhastrika')).toBe(false)
    expect(usesKapalabhatiClips(null)).toBe(false)
    expect(usesKapalabhatiClips('kapalabhati', { youtubeId: 'abcdefghijk' })).toBe(false)
  })
})
