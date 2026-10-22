import { Capacitor } from '@capacitor/core'
import type { ThemeOption } from './themes'

export async function syncNativeChrome(theme: ThemeOption): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const { StatusBar, Style } = await import('@capacitor/status-bar')
  const ios = Capacitor.getPlatform() === 'ios'
  if (!ios) await StatusBar.setOverlaysWebView({ overlay: false })
  await StatusBar.setBackgroundColor({ color: theme.themeColor })
  const lightBackground = theme.colorScheme !== 'dark'
  await StatusBar.setStyle({
    style: ios
      ? lightBackground
        ? Style.Dark
        : Style.Light
      : lightBackground
        ? Style.Light
        : Style.Dark,
  })
}

/** Keep the typed field above the keyboard. The bottom nav stays put. */
export async function listenForIosKeyboard(): Promise<() => void> {
  if (Capacitor.getPlatform() !== 'ios') return () => {}

  const { Keyboard, KeyboardResize } = await import('@capacitor/keyboard')
  await Keyboard.setResizeMode({ mode: KeyboardResize.None })
  const show = await Keyboard.addListener('keyboardWillShow', (info) => {
    document.documentElement.style.setProperty('--keyboard-height', `${info.keyboardHeight}px`)
    const el = document.activeElement
    if (el instanceof HTMLElement) {
      window.setTimeout(() => el.scrollIntoView({ block: 'center' }), 50)
    }
  })
  const hide = await Keyboard.addListener('keyboardWillHide', () => {
    document.documentElement.style.removeProperty('--keyboard-height')
  })
  return () => {
    void show.remove()
    void hide.remove()
  }
}

export async function hideNativeSplash(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return
  const { SplashScreen } = await import('@capacitor/splash-screen')
  await SplashScreen.hide()
}
