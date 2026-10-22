import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useNavigate } from 'react-router-dom'
import { readInstallAttribution } from '../lib/installReferrer'
import { sharedListCodeFromUrl, takeInstallListCode } from '../lib/sharedLists'
import { sharedEventCodeFromUrl, takeInstallEventCode } from '../lib/sharedEvents'
import { track } from '../lib/track'

/**
 * In the Android app: a resuming.me/e/<code> or /c/<code> link, or an install that came from one,
 * opens that screen. Runs before the language screen so the route waits behind it.
 */
export function useSharedEventLinks(): void {
  const navigate = useNavigate()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return
    let cancelled = false
    let remove = () => {}

    const openEvent = (code: string | null) => {
      if (!code || cancelled) return
      const path = `/e/${code}`
      if (window.location.pathname !== path) navigate(path)
    }

    const openList = (code: string | null) => {
      if (!code || cancelled) return
      const path = `/c/${code}`
      if (window.location.pathname !== path) navigate(path)
    }

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appUrlOpen', ({ url }) => {
        const eventCode = sharedEventCodeFromUrl(url)
        if (eventCode) openEvent(eventCode)
        else openList(sharedListCodeFromUrl(url))
      })
      if (cancelled) {
        void handle.remove()
        return
      }
      remove = () => {
        void handle.remove()
      }
      const launch = await App.getLaunchUrl().catch(() => undefined)
      const launchEvent = launch?.url ? sharedEventCodeFromUrl(launch.url) : null
      const launchList = launch?.url ? sharedListCodeFromUrl(launch.url) : null
      const installEvent = launchEvent || launchList ? null : await takeInstallEventCode(readInstallAttribution)
      const installList =
        launchEvent || launchList || installEvent ? null : await takeInstallListCode(readInstallAttribution)
      if (installEvent) track('shared_event_installed')
      if (installList) track('shared_list_installed')
      if (launchEvent || installEvent) openEvent(launchEvent ?? installEvent)
      else openList(launchList ?? installList)
    })()

    return () => {
      cancelled = true
      remove()
    }
  }, [navigate])
}
