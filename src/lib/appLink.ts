const APP_PROTOCOL = 'com.cheerfulgames.resuming:'

/** Opens a path in the installed iPhone app. Three slashes keep the path intact. */
export function appOpenUrl(path: string): string {
  const clean = path.startsWith('/') ? path : `/${path}`
  return `com.cheerfulgames.resuming://${clean}`
}

/**
 * The path of a resuming.me link, or the same path on the app's own scheme.
 * `scheme:///e/code` and `scheme://e/code` both become `/e/code`.
 */
export function appLinkPath(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') {
      if (parsed.hostname !== 'resuming.me' && parsed.hostname !== 'www.resuming.me') return null
      return parsed.pathname
    }
    if (parsed.protocol !== APP_PROTOCOL) return null
    const joined = parsed.hostname ? `/${parsed.hostname}${parsed.pathname}` : parsed.pathname
    return joined.replace(/\/{2,}/g, '/') || '/'
  } catch {
    return null
  }
}
