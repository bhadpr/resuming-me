import { Capacitor, registerPlugin } from '@capacitor/core'

export interface InstallAttribution {
  ok: boolean
  deviceKey: string
  referrer: string
}

interface InstallReferrerPlugin {
  getAttribution(): Promise<InstallAttribution>
}

const InstallReferrer = registerPlugin<InstallReferrerPlugin>('InstallReferrer')

let pending: Promise<InstallAttribution | null> | null = null

/** The Play install referrer, read once per app start. Null off Android or when Play does not answer. */
export function readInstallAttribution(): Promise<InstallAttribution | null> {
  if (Capacitor.getPlatform() !== 'android') return Promise.resolve(null)
  pending ??= InstallReferrer.getAttribution().catch(() => null)
  return pending
}
