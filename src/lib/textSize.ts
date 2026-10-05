/** In-app text size. Scales every rem-based size from the root. */
export type TextSize = 'normal' | 'large' | 'xlarge'

export const TEXT_SIZES: TextSize[] = ['normal', 'large', 'xlarge']

export const TEXT_SIZE_STORAGE_KEY = 'resuming-text-size'

const ROOT_PX: Record<TextSize, number> = { normal: 16, large: 18, xlarge: 20 }

export function isTextSize(value: string | null | undefined): value is TextSize {
  return value === 'normal' || value === 'large' || value === 'xlarge'
}

export function textSizeRootPx(size: TextSize): number {
  return ROOT_PX[size]
}

export function readTextSize(): TextSize {
  try {
    const raw = localStorage.getItem(TEXT_SIZE_STORAGE_KEY)
    return isTextSize(raw) ? raw : 'normal'
  } catch {
    return 'normal'
  }
}

export function applyTextSize(size: TextSize): void {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--font-size-root', `${ROOT_PX[size]}px`)
  try {
    localStorage.setItem(TEXT_SIZE_STORAGE_KEY, size)
  } catch {
    /* ignore */
  }
}
