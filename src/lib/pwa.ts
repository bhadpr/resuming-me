import { Capacitor } from '@capacitor/core'

/**
 * PWAs need a service worker; Capacitor WebViews do not.
 * A leftover SW keeps serving the previous JS bundle after APK updates,
 * which is why native Settings can lag behind the website.
 */
export async function setupServiceWorker(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  if (Capacitor.isNativePlatform()) {
    const hadController = Boolean(navigator.serviceWorker.controller)
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((registration) => registration.unregister()))
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
    if (hadController) {
      window.location.reload()
    }
    return
  }

  const { registerSW } = await import('virtual:pwa-register')
  registerSW({ immediate: true })
}
