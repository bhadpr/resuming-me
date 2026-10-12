import { describe, expect, it } from 'vitest'
import {
  habitVideoFor,
  ownHabitVideo,
  parseYoutubeLink,
  youtubeWatchUrl,
} from './habitVideos'

const ID = 'dQw4w9WgXcQ'

describe('parseYoutubeLink', () => {
  it('reads the common link shapes', () => {
    expect(parseYoutubeLink(`https://www.youtube.com/watch?v=${ID}`)).toEqual({ youtubeId: ID })
    expect(parseYoutubeLink(`https://m.youtube.com/watch?feature=share&v=${ID}`)).toEqual({ youtubeId: ID })
    expect(parseYoutubeLink(`https://youtu.be/${ID}?si=abc`)).toEqual({ youtubeId: ID })
    expect(parseYoutubeLink(`youtu.be/${ID}`)).toEqual({ youtubeId: ID })
    expect(parseYoutubeLink(`https://youtube.com/shorts/${ID}`)).toEqual({ youtubeId: ID })
    expect(parseYoutubeLink(`https://www.youtube.com/embed/${ID}?start=30`)).toEqual({ youtubeId: ID, startSeconds: 30 })
    expect(parseYoutubeLink(`https://www.youtube.com/live/${ID}`)).toEqual({ youtubeId: ID })
    expect(parseYoutubeLink(`  ${ID}  `)).toEqual({ youtubeId: ID })
  })

  it('reads the start time', () => {
    expect(parseYoutubeLink(`https://youtu.be/${ID}?t=90`)?.startSeconds).toBe(90)
    expect(parseYoutubeLink(`https://youtu.be/${ID}?t=90s`)?.startSeconds).toBe(90)
    expect(parseYoutubeLink(`https://www.youtube.com/watch?v=${ID}&t=1m5s`)?.startSeconds).toBe(65)
    expect(parseYoutubeLink(`https://www.youtube.com/watch?v=${ID}&t=1h0m2s`)?.startSeconds).toBe(3602)
    expect(parseYoutubeLink(`https://youtu.be/${ID}?t=0`)).toEqual({ youtubeId: ID })
    expect(parseYoutubeLink(`https://youtu.be/${ID}?t=soon`)).toEqual({ youtubeId: ID })
  })

  it('rejects anything that is not a YouTube video', () => {
    expect(parseYoutubeLink('')).toBeNull()
    expect(parseYoutubeLink('https://vimeo.com/123456')).toBeNull()
    expect(parseYoutubeLink(`https://evil.com/watch?v=${ID}`)).toBeNull()
    expect(parseYoutubeLink(`https://youtube.com.evil.com/watch?v=${ID}`)).toBeNull()
    expect(parseYoutubeLink('https://www.youtube.com/@channel')).toBeNull()
    expect(parseYoutubeLink('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseYoutubeLink(`javascript:alert('${ID}')`)).toBeNull()
  })
})

describe('habit video choice', () => {
  const own = { youtubeId: ID, startSeconds: 12 }

  it('plays the own video first, then the built-in one', () => {
    expect(habitVideoFor('kapalabhati', own)).toBe(own)
    expect(habitVideoFor('kapalabhati')?.youtubeId).toBe('WOw55qnKBSo')
    expect(habitVideoFor(null, own)).toBe(own)
    expect(habitVideoFor(null)).toBeNull()
    expect(habitVideoFor('walk', own)).toBe(own)
    expect(habitVideoFor('walk')).toBeNull()
    expect(habitVideoFor('toString')).toBeNull()
  })

  it('reads saved columns and builds the YouTube page link', () => {
    expect(ownHabitVideo(ID, 12)).toEqual(own)
    expect(ownHabitVideo(ID, null)).toEqual({ youtubeId: ID })
    expect(ownHabitVideo('bad id', 5)).toBeNull()
    expect(ownHabitVideo(null)).toBeNull()
    expect(youtubeWatchUrl(own)).toBe(`https://www.youtube.com/watch?v=${ID}&t=12s`)
    expect(youtubeWatchUrl({ youtubeId: ID })).toBe(`https://www.youtube.com/watch?v=${ID}`)
  })
})
