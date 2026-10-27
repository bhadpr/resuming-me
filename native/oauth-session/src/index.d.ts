import type { Plugin } from '@capacitor/core'

export interface OAuthSessionPlugin extends Plugin {
  start(options: { url: string; callbackScheme: string }): Promise<{ url: string }>
}

export const OAuthSession: OAuthSessionPlugin
