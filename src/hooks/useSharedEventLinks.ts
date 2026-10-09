import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { readInstallAttribution } from '../lib/installReferrer'
import { sharedEventCodeFromUrl, takeInstallEventCode } from '../lib/sharedEvents'
import { track } from '../lib/track'

/**
 * In the Android app: a resuming.me/e/<code> link, or an install that came from one,
 * opens the confirm screen. Runs before the language screen so the route waits behind it.
 */
export function useSharedEventLinks(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false
    let remove = () => {}

    const open = (code: string | null) => {
      if (!code || cancelled) return
      const path = `/e/${code}`
      if (window.location.pathname !== path) navigate(path)
    }

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appUrlOpen', ({ url }) => open(sharedEventCodeFromUrl(url)))
      if (cancelled) {
        void handle.remove()
        return
      }
      remove = () => {
        void handle.remove()
      }
      const launch = await App.getLaunchUrl().catch(() => undefined)
      const launchCode = launch?.url ? sharedEventCodeFromUrl(launch.url) : null
      const installCode = launchCode ? null : await takeInstallEventCode(readInstallAttribution)
      if (installCode) track('shared_event_installed')
      open(launchCode ?? installCode)
    })()

    return () => {
      cancelled = true
      remove()
    }
  }, [navigate])
}
