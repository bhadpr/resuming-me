/// <reference types="@capacitor/local-notifications" />
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.cheerfulgames.resuming',
  appName: 'Resuming',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_resuming',
      iconColor: '#e07a5f',
    },
    SplashScreen: {
      launchAutoHide: false,
      backgroundColor: '#faf6f0',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
      style: 'LIGHT',
      backgroundColor: '#faf6f0',
    },
  },
}

export default config
