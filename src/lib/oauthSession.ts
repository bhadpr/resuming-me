import { registerPlugin } from '@capacitor/core'

export interface OAuthSessionPlugin {
  start(options: { url: string; callbackScheme: string }): Promise<{ url: string }>
}

export const OAuthSession = registerPlugin<OAuthSessionPlugin>('OAuthSession')
