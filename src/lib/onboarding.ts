export const INSTALL_DISMISS_KEY = 'resuming-install-dismissed'

export function readDismissedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeDismissedFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** True when running as installed PWA / home-screen app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return Boolean(mq || iosStandalone)
}

/** Rough iOS Safari detection for Add to Home Screen tip. */
export function isLikelyIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chromeLike = /CriOS|FxiOS|EdgiOS/.test(ua)
  return iOS && webkit && !chromeLike
}

export function shouldShowInstallTip(params: {
  dismissed: boolean
  standalone: boolean
  iosSafari: boolean
}): boolean {
  return !params.dismissed && !params.standalone && params.iosSafari
}
