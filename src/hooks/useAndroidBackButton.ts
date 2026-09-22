import { useEffect } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Capacitor Android hardware back: follow router history; exit only from /today.
 */
export function useAndroidBackButton(): void {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return

    let remove = () => {}
    let cancelled = false

    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('backButton', () => {
        if (pathname === '/today') {
          void App.exitApp()
          return
        }
        const idx =
          typeof window.history.state?.idx === 'number' ? window.history.state.idx : 0
        if (idx > 0) navigate(-1)
        else navigate('/today')
      })
      if (cancelled) {
        void handle.remove()
        return
      }
      remove = () => {
        void handle.remove()
      }
    })()

    return () => {
      cancelled = true
      remove()
    }
  }, [navigate, pathname])
}
