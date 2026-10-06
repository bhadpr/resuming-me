import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLocale } from '../hooks/useLocale'
import { guestMedicineSchedules, guestTakenMarks, loadGuestDraft } from '../lib/guestDraft'
import { mealMessageKey } from '../lib/medicineFormat'
import { listenForMedicineNotificationActions, syncMedicineNotifications } from '../lib/medicineNotifications'
import { MEDICINE_REMINDER_CHANGED } from '../lib/medicineReminderState'
import { parseAppPath, stashAuthNext, tabFromView, type AppTab } from '../lib/navigation'
import {
  listenForReminderNotificationActions,
  reminderAlertText,
  syncReminderNotifications,
} from '../lib/reminderNotifications'
import { REMINDERS_CHANGED } from '../lib/reminderSchedule'
import { track } from '../lib/track'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { BrandTitle } from './BrandTitle'
import { BottomNav } from './BottomNav'
import { EmailSignInForm } from './EmailSignInForm'
import { GuestActivitiesPage, GuestVitalsPage } from './GuestLibrary'
import { GuestReminderEditor } from './GuestReminders'
import { GuestTodayPage } from './GuestTodayPage'

function guestTabFromPath(pathname: string): AppTab {
  return tabFromView(parseAppPath(pathname))
}

/** Guest shell: same bottom nav as signed-in; gated tabs show sign-in in-place. */
export function GuestAppShell() {
  const location = useLocation()
  const { t } = useLocale()
  useGuestMedicineAlarms()
  useGuestReminderAlerts()
  const view = parseAppPath(location.pathname)
  const tab = guestTabFromPath(location.pathname)
  const label =
    tab === 'activities'
      ? t('nav.abhyas')
      : tab === 'metrics'
        ? t('nav.vitals')
        : tab === 'insights'
          ? t('nav.insights')
          : t('nav.today')
  useDocumentMeta({ title: `${label} · Resuming`, noindex: true })

  useEffect(() => {
    if (tab !== 'insights') return
    stashAuthNext(`${location.pathname}${location.search}`)
  }, [tab, location.pathname, location.search])

  return (
    <div className="app">
      <header className="app-header">
        <BrandTitle className="app-title" homeTo="/today" />
      </header>
      <main className="app-main">
        {view?.name === 'reminders' ? (
          <GuestReminderEditor key={view.reminderId ?? 'new'} reminderId={view.reminderId} />
        ) : (
          tab === 'today' && <GuestTodayPage />
        )}
        {tab === 'activities' && <GuestActivitiesPage />}
        {tab === 'metrics' && <GuestVitalsPage />}
        {tab === 'insights' && <GuestSignInPanel tab={tab} />}
      </main>
      <BottomNav tab={tab} />
    </div>
  )
}

function useGuestMedicineAlarms(): void {
  const { t } = useLocale()

  useEffect(() => {
    let cancelled = false
    let remove = () => {}
    void listenForMedicineNotificationActions().then((next) => {
      if (cancelled) {
        next()
        return
      }
      remove = next
    })
    return () => {
      cancelled = true
      remove()
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      const draft = loadGuestDraft()
      if (!draft) return
      void syncMedicineNotifications(
        guestMedicineSchedules(draft),
        guestTakenMarks(draft),
        new Date(),
        (meal) => {
          const base = t('medicines.alarm')
          const key = mealMessageKey(meal)
          return key ? `${base} ${t(key)}` : base
        },
        {
          taken: t('medicines.taken'),
          skipped: t('medicines.skipped'),
          snooze: t('medicines.snooze'),
        },
      )
    }
    sync()
    window.addEventListener(MEDICINE_REMINDER_CHANGED, sync)
    return () => window.removeEventListener(MEDICINE_REMINDER_CHANGED, sync)
  }, [t])
}

function useGuestReminderAlerts(): void {
  const { locale } = useLocale()

  useEffect(() => {
    let cancelled = false
    let remove = () => {}
    void listenForReminderNotificationActions().then((next) => {
      if (cancelled) {
        next()
        return
      }
      remove = next
    })
    return () => {
      cancelled = true
      remove()
    }
  }, [])

  useEffect(() => {
    const sync = () => {
      const { copy, labels } = reminderAlertText(locale)
      void syncReminderNotifications(loadGuestDraft()?.reminders ?? [], copy, labels).catch(() => {})
    }
    sync()
    window.addEventListener(REMINDERS_CHANGED, sync)
    return () => window.removeEventListener(REMINDERS_CHANGED, sync)
  }, [locale])
}

function GuestSignInPanel({ tab }: { tab: AppTab }) {
  const { signInWithGoogle, authError } = useAuth()
  const { t } = useLocale()
  const [signingIn, setSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const label =
    tab === 'activities'
      ? t('nav.abhyas')
      : tab === 'metrics'
        ? t('nav.vitals')
        : tab === 'insights'
          ? t('nav.insights')
          : t('nav.today')
  const displayError = authError || error

  async function handleGoogle() {
    track('signin_method_clicked', { method: 'google' })
    setError(null)
    setSigningIn(true)
    try {
      await signInWithGoogle()
    } catch (err) {
      setError(err instanceof Error ? err.message : t('guest.signInFailed'))
      setSigningIn(false)
    }
  }

  return (
    <div className="guest-auth-stage">
      <div className="guest-auth-panel">
        <div className="guest-auth-panel-header">
          <h2>{label}</h2>
          <p className="screen-sub">{t('guest.signInToUse', { label })}</p>
        </div>
        {displayError && (
          <div className="notice notice-warning">
            <p>{displayError}</p>
          </div>
        )}
        <div className="landing-signin guest-auth-signin">
          <EmailSignInForm onClick={() => track('signin_method_clicked', { method: 'email' })} />
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => void handleGoogle()}
            disabled={signingIn}
          >
            {signingIn ? t('guest.openingGoogle') : t('landing.google')}
          </button>
        </div>
      </div>
    </div>
  )
}

export function isGuestAppPath(pathname: string): boolean {
  if (pathname === '/today' || pathname === '/insights') return true
  if (pathname === '/activities' || pathname.startsWith('/activities/')) return true
  if (pathname === '/numbers' || pathname.startsWith('/numbers/')) return true
  if (pathname.startsWith('/reminders/')) return true
  return false
}
