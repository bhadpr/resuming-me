import { Capacitor } from '@capacitor/core'
import { useLocale } from '../hooks/useLocale'
import { PLAY_STORE_URL } from '../lib/marketing'
import { track } from '../lib/track'

/** Browsers cannot ring at a set time, so on the website alerts point to the Android app. */
export function AppAlertsNote({ where }: { where: 'today' | 'medicine' | 'reminder' }) {
  const { t } = useLocale()
  if (Capacitor.isNativePlatform()) return null
  return (
    <p className="app-alerts-note">
      {t('reminders.alertsAppOnly')}{' '}
      <a
        href={PLAY_STORE_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => track('get_app_clicked', { where })}
      >
        {t('landing.getApp')}
      </a>
    </p>
  )
}
