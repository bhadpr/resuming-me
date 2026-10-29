/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cheerfulgames.resuming',
  appName: 'Resuming',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: '#fff4e8',
    contentInset: 'never',
  },
  server: {
    // YouTube rejects the default capacitor:// address and shows a player configuration error.
    iosScheme: 'https',
    hostname: 'localhost',
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_resuming',
      iconColor: '#e07a5f',
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#fff4e8',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#fff4e8',
    },
  },
}

export default config
