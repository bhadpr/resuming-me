import type { ThemeId } from './themes'

/** Themes with their own recoloured copy of the clay pictures, under /themes/<id>/. */
const THEMES_WITH_ART: ReadonlySet<ThemeId> = new Set(['sky'])

const ART_FOLDERS = ['/habits/', '/reminders/', '/medicines/']

/** The picture to show for this theme. Photos and other images pass through unchanged. */
export function themedArt(src: string, themeId: ThemeId): string {
  if (!THEMES_WITH_ART.has(themeId)) return src
  if (!ART_FOLDERS.some((folder) => src.startsWith(folder))) return src
  return `/themes/${themeId}${src}`
}
