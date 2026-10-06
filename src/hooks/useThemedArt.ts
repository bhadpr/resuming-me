import { useCallback } from 'react'
import { themedArt } from '../lib/themedArt'
import { useTheme } from './useTheme'

/** Maps a clay picture path to the copy drawn for the theme on screen. */
export function useThemedArt(): (src: string) => string {
  const { themeId } = useTheme()
  return useCallback((src: string) => themedArt(src, themeId), [themeId])
}
