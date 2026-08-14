import { Capacitor } from '@capacitor/core'
import type { ThemeOption } from './themes'

export async function syncNativeChrome(theme: ThemeOption): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const { StatusBar, Style } = await import('@capacitor/status-bar')
  await StatusBar.setOverlaysWebView({ overlay: false })
  await StatusBar.setBackgroundColor({ color: theme.themeColor })
  await StatusBar.setStyle({
    style: theme.colorScheme === 'dark' ? Style.Dark : Style.Light,
  })
}

export async function hideNativeSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { SplashScreen } = await import('@capacitor/splash-screen')
  await SplashScreen.hide()
}
