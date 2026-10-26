import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import {
  guestMedicineSchedules,
  guestTakenMarks,
  loadGuestDraft,
  refreshGuestFollowedLists,
  saveGuestListPhotos,
  saveGuestSharedStatuses,
} from '../lib/guestDraft'
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
import { withSharedStatuses } from '../lib/reminders'
import { withListPhotos } from '../lib/sharedLists'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { BrandTitle } from './BrandTitle'
import { BottomNav } from './BottomNav'
import { GuestActivityScreen } from './GuestActivityScreen'
import { GuestActivitiesPage, GuestVitalsPage } from './GuestLibrary'
import { GuestCommunityReminders, GuestReminderEditor, GuestReminderList } from './GuestReminders'
import { InsightsHeaderButton } from './InsightsHeaderButton'
import { GuestInsightsPage } from './GuestInsightsPage'
import { GuestTodayPage } from './GuestTodayPage'

const TAB_LABEL_KEYS: Record<AppTab, string> = {
  today: 'nav.today',
  activities: 'nav.abhyas',
  reminders: 'nav.reminders',
  metrics: 'nav.vitals',
  insights: 'nav.insights',
}

function guestTabFromPath(pathname: string): AppTab {
  return tabFromView(parseAppPath(pathname))
}

/** Guest shell: same bottom nav as signed-in. */
export function GuestAppShell() {
  const location = useLocation()
  const { t } = useLocale()
  useGuestMedicineAlarms()
  useGuestReminderAlerts()
  const view = parseAppPath(location.pathname)
  const tab = guestTabFromPath(location.pathname)
  useDocumentMeta({ title: `${t(TAB_LABEL_KEYS[tab])} · Resuming`, noindex: true })

  useEffect(() => {
    if (tab !== 'insights') return
    stashAuthNext(`${location.pathname}${location.search}`)
  }, [tab, location.pathname, location.search])

  return (
    <div className="app">
      <header className="app-header">
        <BrandTitle className="app-title" homeTo="/today" />
        <div className="app-header-actions">
          <InsightsHeaderButton active={tab === 'insights'} />
        </div>
      </header>
      <main className="app-main">
        {view?.name === 'reminders' && (
          <GuestReminderEditor key={view.reminderId ?? 'new'} reminderId={view.reminderId} editing={view.edit === true} />
        )}
        {view?.name === 'reminderList' && <GuestReminderList />}
        {view?.name === 'reminderCommunity' && <GuestCommunityReminders />}
        {tab === 'today' && <GuestTodayPage />}
        {view?.name === 'activities' && view.screen === 'list' && <GuestActivitiesPage />}
        {view?.name === 'activities' && view.screen === 'detail' && (
          <GuestActivityScreen mode="detail" activityId={view.activityId} />
        )}
        {view?.name === 'activities' && view.screen === 'form' && (
          <GuestActivityScreen mode="form" activityId={view.activityId} />
        )}
        {tab === 'metrics' && <GuestVitalsPage />}
        {tab === 'insights' && <GuestInsightsPage />}
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
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      const draft = loadGuestDraft()
      if (!draft) return
      if (draft.reminders.some((item) => item.sharedEventId)) {
        void withSharedStatuses(draft.reminders).then((updated) => {
          const latest = loadGuestDraft()
          if (latest) saveGuestSharedStatuses(latest, updated)
        })
      }
      if (draft.reminders.some((item) => item.sharedListItemId || item.sharedListId)) {
        void refreshGuestFollowedLists().then(() => {
          const latest = loadGuestDraft()
          if (!latest?.reminders.some((item) => item.sharedListItemId)) return
          void withListPhotos(latest.reminders).then((updated) => {
            const after = loadGuestDraft()
            if (after) saveGuestListPhotos(after, updated)
          })
        })
      }
    }
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
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

export function isGuestAppPath(pathname: string): boolean {
  if (pathname === '/today' || pathname === '/insights') return true
  if (pathname === '/activities' || pathname.startsWith('/activities/')) return true
  if (pathname === '/numbers' || pathname.startsWith('/numbers/')) return true
  if (pathname === '/reminders' || pathname.startsWith('/reminders/')) return true
  return false
}
