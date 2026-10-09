import { Capacitor } from '@capacitor/core'
import { todayLocalDate } from './dates'
import { readInstallAttribution } from './installReferrer'
import { codesFromReferrer } from './marketing'
import { createSupabaseClient, isSupabaseConfigured } from './supabase'

const REPORTED_ON_KEY = 'resuming-marketing-open-on'

/** Tag this Android device from the Play install link, then record each new local day. */
export async function captureMarketingOpen(): Promise<void> {
  if (Capacitor.getPlatform() !== 'android') return
  if (!isSupabaseConfigured()) return

  const today = todayLocalDate()
  try {
    if (localStorage.getItem(REPORTED_ON_KEY) === today) return
  } catch {
    /* still try the network call */
  }

  const attribution = await readInstallAttribution()
  if (!attribution?.ok || !/^[0-9a-f]{64}$/.test(attribution.deviceKey)) return

  const codes = codesFromReferrer(attribution.referrer)
  const { error } = await createSupabaseClient().rpc('marketing_record_open', {
    p_device_key: attribution.deviceKey,
    p_group_code: codes?.groupCode ?? '',
    p_member_code: codes?.memberCode ?? '',
    p_opened_on: today,
  })
  if (error) return

  try {
    localStorage.setItem(REPORTED_ON_KEY, today)
  } catch {
    /* the server already has the day */
  }
}
