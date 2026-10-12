import { Capacitor, registerPlugin } from '@capacitor/core'

interface SharedEventCheckPlugin {
  start(options: { url: string; anonKey: string }): Promise<void>
  stop(): Promise<void>
}

const SharedEventCheck = registerPlugin<SharedEventCheckPlugin>('SharedEventCheck')

/**
 * While alerts for shared events are armed, Android checks about once an hour
 * whether the organizer cancelled one and drops its alerts, even if the app stays closed.
 */
export async function watchSharedEventAlerts(armed: boolean): Promise<void> {
  if (Capacitor.getPlatform() !== 'android' || !Capacitor.isPluginAvailable('SharedEventCheck')) return
  const url = import.meta.env.VITE_SUPABASE_URL
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
  try {
    if (armed && url && anonKey) await SharedEventCheck.start({ url, anonKey })
    else await SharedEventCheck.stop()
  } catch {
    /* the next sync tries again */
  }
}
