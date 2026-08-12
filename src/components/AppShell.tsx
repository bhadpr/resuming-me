import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth, useProfileSync } from '../hooks/useAuth'
import { useTimer } from '../hooks/useTimer'
import { ActivityList } from './ActivityList'
import { ActivityForm } from './ActivityForm'
import { ActivityDetail } from './ActivityDetail'
import { MetricList } from './MetricList'
import { MetricForm } from './MetricForm'
import { MetricDetail } from './MetricDetail'
import { TodayScreen } from './TodayScreen'
import { InsightsScreen } from './InsightsScreen'
import { SettingsScreen } from './SettingsScreen'
import { AnalyticsScreen } from './AnalyticsScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { InstallPrompt } from './InstallPrompt'
import { BrandTitle } from './BrandTitle'
import { LegalPage } from './LegalPage'
import { FeedbackPage } from './FeedbackPage'
import { SiteFooter } from './SiteFooter'
import type { SitePageId } from '../lib/site'
import { trackPageView } from '../lib/analytics'
import {
  archiveActivity,
  createActivity,
  deleteActivity,
  listActivities,
  unarchiveActivity,
  updateActivity,
  updateActivityMicroSteps,
  type Activity,
  type ActivityInput,
} from '../lib/activities'
import {
  archiveMetric,
  createMetric,
  deleteMetric,
  listMetrics,
  unarchiveMetric,
  updateMetric,
  type Metric,
  type MetricInput,
} from '../lib/metrics'
import {
  deleteCompletedEntriesForActivity,
  deleteCompletedEntriesForDate,
  deleteLogEntry,
  insertCompletedEntry,
  listLogEntriesForActivities,
  listLogEntriesForActivity,
  listRecentPostponed,
  updateLogEntry,
  type LogEntry,
} from '../lib/logs'
import {
  listMetricEntriesForDate,
  listMetricEntriesForMetric,
  upsertMetricEntry,
  type MetricEntry,
} from '../lib/metricEntries'
import {
  flushSessionQueue,
  queuedSessionsAsLogEntries,
  writeSessionEntry,
} from '../lib/sessions'
import { addDays, startOfWeekMonday, todayLocalDate } from '../lib/dates'
import { buildTodayProgress, type ActivityTodayProgress } from '../lib/today'
import {
  rescheduleDeadline,
  runClientRolloverCatchUp,
} from '../lib/rolloverClient'
import {
  computeInsights,
  type InsightsWindow,
} from '../lib/insights'
import { requestMicroSteps } from '../lib/microSteps'
import {
  getStarterActivityTemplates,
  getStarterMetricTemplates,
  needsOnboarding,
  ONBOARDING_DISMISS_KEY,
  readDismissedFlag,
  writeDismissedFlag,
} from '../lib/onboarding'

type Tab = 'today' | 'activities' | 'metrics' | 'insights'

type ActivityScreen =
  | { name: 'list' }
  | { name: 'form'; activity?: Activity }
  | { name: 'detail'; activityId: string }

type MetricScreen =
  | { name: 'list' }
  | { name: 'form'; metric?: Metric }
  | { name: 'detail'; metricId: string }

export function AppShell() {
  const { user, signOut, isAdmin } = useAuth()
  useProfileSync(user)

  const [tab, setTab] = useState<Tab>('today')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [legalPage, setLegalPage] = useState<SitePageId | null>(null)
  const [activityScreen, setActivityScreen] = useState<ActivityScreen>({ name: 'list' })
  const [metricScreen, setMetricScreen] = useState<MetricScreen>({ name: 'list' })

  const [activities, setActivities] = useState<Activity[]>([])
  const [metrics, setMetrics] = useState<Metric[]>([])
  const [logEntries, setLogEntries] = useState<LogEntry[]>([])
  const [postponedEntries, setPostponedEntries] = useState<LogEntry[]>([])
  const [metricEntriesToday, setMetricEntriesToday] = useState<MetricEntry[]>([])

  const [showArchivedActivities, setShowArchivedActivities] = useState(false)
  const [showArchivedMetrics, setShowArchivedMetrics] = useState(false)
  const [loadingActivities, setLoadingActivities] = useState(true)
  const [loadingMetrics, setLoadingMetrics] = useState(true)
  const [loadingToday, setLoadingToday] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null)
  const [queueVersion, setQueueVersion] = useState(0)
  const [detailLogEntries, setDetailLogEntries] = useState<LogEntry[]>([])
  const [detailMetricEntries, setDetailMetricEntries] = useState<MetricEntry[]>([])
  const [loadingDetailEntries, setLoadingDetailEntries] = useState(false)
  const [insightsWindow, setInsightsWindow] = useState<InsightsWindow>('week')
  const [insightsEntries, setInsightsEntries] = useState<LogEntry[]>([])
  const [insightsMetricEntries, setInsightsMetricEntries] = useState<MetricEntry[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    readDismissedFlag(ONBOARDING_DISMISS_KEY),
  )

  const today = todayLocalDate()

  const activeActivityIds = useMemo(
    () => activities.filter((a) => !a.archived).map((a) => a.id),
    [activities],
  )

  const timer = useTimer(activeActivityIds, today)

  const refreshActivities = useCallback(async () => {
    setLoadingActivities(true)
    try {
      setActivities(await listActivities(true))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load activities')
    } finally {
      setLoadingActivities(false)
    }
  }, [])

  const refreshMetrics = useCallback(async () => {
    setLoadingMetrics(true)
    try {
      setMetrics(await listMetrics(true))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics')
    } finally {
      setLoadingMetrics(false)
    }
  }, [])

  const refreshTodayData = useCallback(
    async (activityList: Activity[]) => {
      setLoadingToday(true)
      try {
        const activeIds = activityList.filter((a) => !a.archived).map((a) => a.id)
        const from = addDays(startOfWeekMonday(today), -90)
        const [logs, postponed, metricRows] = await Promise.all([
          listLogEntriesForActivities(activeIds, from, today),
          listRecentPostponed(activeIds, from),
          listMetricEntriesForDate(today),
        ])
        setLogEntries(logs)
        setPostponedEntries(postponed)
        setMetricEntriesToday(metricRows)
        setQueueVersion((v) => v + 1)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Today')
      } finally {
        setLoadingToday(false)
      }
    },
    [today],
  )

  useEffect(() => {
    void (async () => {
      setLoadingActivities(true)
      setLoadingMetrics(true)
      try {
        if (user) {
          await runClientRolloverCatchUp(user.id)
        }
        const [acts, mets] = await Promise.all([listActivities(true), listMetrics(true)])
        setActivities(acts)
        setMetrics(mets)
        await refreshTodayData(acts)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoadingActivities(false)
        setLoadingMetrics(false)
      }
    })()
  }, [refreshTodayData, user])

  // Flush offline session queue when connectivity returns
  useEffect(() => {
    async function syncQueue() {
      try {
        const synced = await flushSessionQueue()
        if (synced.length > 0) {
          setLogEntries((prev) => {
            const ids = new Set(prev.map((e) => e.id))
            const merged = [...synced.filter((e) => !ids.has(e.id)), ...prev]
            return merged
          })
          setOfflineNotice(null)
          setQueueVersion((v) => v + 1)
        }
      } catch {
        // stay queued
      }
    }

    function onOnline() {
      setOfflineNotice(null)
      void syncQueue()
    }
    function onOffline() {
      setOfflineNotice('You are offline. Timer sessions will sync when you reconnect.')
    }

    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setOfflineNotice('You are offline. Timer sessions will sync when you reconnect.')
    }

    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
    void syncQueue()
    return () => {
      window.removeEventListener('online', onOnline)
      window.removeEventListener('offline', onOffline)
    }
  }, [])

  const mergedLogEntries = useMemo(() => {
    const queued = queuedSessionsAsLogEntries()
    if (queued.length === 0) return logEntries
    const ids = new Set(logEntries.map((e) => e.id))
    return [...queued.filter((e) => !ids.has(e.id)), ...logEntries]
    // queueVersion forces re-read of localStorage queue
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logEntries, queueVersion])

  const todayRows = useMemo(
    () => buildTodayProgress(activities, mergedLogEntries, postponedEntries, today),
    [activities, mergedLogEntries, postponedEntries, today],
  )

  const activeMetrics = useMemo(
    () => metrics.filter((m) => !m.archived),
    [metrics],
  )

  const todayMetrics = useMemo(() => {
    return activeMetrics.map((metric) => {
      const entry = metricEntriesToday.find((e) => e.metric_id === metric.id) ?? null
      return { metric, entry }
    })
  }, [activeMetrics, metricEntriesToday])

  function switchTab(next: Tab) {
    setError(null)
    setSettingsOpen(false)
    setAnalyticsOpen(false)
    setTab(next)
  }

  useEffect(() => {
    if (analyticsOpen) {
      trackPageView('/analytics', 'Analytics')
      return
    }
    if (settingsOpen) {
      trackPageView('/settings', 'Settings')
      return
    }
    if (legalPage) {
      trackPageView(`/${legalPage}`, legalPage)
      return
    }
    if (tab === 'today') trackPageView('/app/today', 'Today')
    else if (tab === 'activities') trackPageView('/app/activities', 'Activities')
    else if (tab === 'metrics') trackPageView('/app/metrics', 'Metrics')
    else if (tab === 'insights') trackPageView('/app/insights', 'Insights')
  }, [tab, settingsOpen, analyticsOpen, legalPage])

  const selectedActivity =
    activityScreen.name === 'detail' || activityScreen.name === 'form'
      ? activities.find(
          (a) =>
            a.id ===
            (activityScreen.name === 'detail'
              ? activityScreen.activityId
              : activityScreen.activity?.id),
        ) ?? (activityScreen.name === 'form' ? activityScreen.activity : undefined)
      : undefined

  const selectedMetric =
    metricScreen.name === 'detail' || metricScreen.name === 'form'
      ? metrics.find(
          (m) =>
            m.id ===
            (metricScreen.name === 'detail'
              ? metricScreen.metricId
              : metricScreen.metric?.id),
        ) ?? (metricScreen.name === 'form' ? metricScreen.metric : undefined)
      : undefined

  useEffect(() => {
    if (tab !== 'activities' || activityScreen.name !== 'detail') {
      setDetailLogEntries([])
      return
    }
    const id = activityScreen.activityId
    let cancelled = false
    setLoadingDetailEntries(true)
    void listLogEntriesForActivity(id)
      .then((rows) => {
        if (!cancelled) setDetailLogEntries(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load history')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetailEntries(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, activityScreen])

  useEffect(() => {
    if (tab !== 'metrics' || metricScreen.name !== 'detail') {
      setDetailMetricEntries([])
      return
    }
    const id = metricScreen.metricId
    let cancelled = false
    setLoadingDetailEntries(true)
    // Load enough history for 90-day window
    const from = addDays(todayLocalDate(), -89)
    void listMetricEntriesForMetric(id, from)
      .then((rows) => {
        if (!cancelled) setDetailMetricEntries(rows)
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load metric history')
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingDetailEntries(false)
      })
    return () => {
      cancelled = true
    }
  }, [tab, metricScreen])

  useEffect(() => {
    if (tab !== 'insights') return
    let cancelled = false
    setLoadingInsights(true)
    void (async () => {
      try {
        const activeIds = activities.filter((a) => !a.archived).map((a) => a.id)
        const metricIds = metrics.filter((m) => !m.archived).map((m) => m.id)
        const from = addDays(today, -89)
        const [logs, metricRows] = await Promise.all([
          listLogEntriesForActivities(activeIds, from, today),
          Promise.all(metricIds.map((id) => listMetricEntriesForMetric(id, from))),
        ])
        if (!cancelled) {
          setInsightsEntries(logs)
          setInsightsMetricEntries(metricRows.flat())
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load insights')
        }
      } finally {
        if (!cancelled) setLoadingInsights(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [tab, activities, metrics, today])

  const insights = useMemo(
    () => computeInsights(activities, insightsEntries, insightsWindow, today),
    [activities, insightsEntries, insightsWindow, today],
  )

  async function handleActivitySave(input: ActivityInput) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      if (activityScreen.name === 'form' && activityScreen.activity) {
        const updated = await updateActivity(activityScreen.activity, input)
        setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        setActivityScreen({ name: 'detail', activityId: updated.id })
      } else {
        const created = await createActivity(user.id, input)
        setActivities((prev) => [created, ...prev])
        setActivityScreen({ name: 'detail', activityId: created.id })
      }
      await refreshTodayData(
        activityScreen.name === 'form' && activityScreen.activity
          ? activities
          : await listActivities(true),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleMetricSave(input: MetricInput) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      if (metricScreen.name === 'form' && metricScreen.metric) {
        const updated = await updateMetric(metricScreen.metric, input)
        setMetrics((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        setMetricScreen({ name: 'detail', metricId: updated.id })
      } else {
        const created = await createMetric(user.id, input)
        setMetrics((prev) => [created, ...prev])
        setMetricScreen({ name: 'detail', metricId: created.id })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleCheckOff(row: ActivityTodayProgress) {
    if (!user) return
    setBusyId(row.activity.id)
    setError(null)
    try {
      const created = await insertCompletedEntry({
        userId: user.id,
        activityId: row.activity.id,
        date: today,
      })
      setLogEntries((prev) => [created, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark complete')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUncheck(row: ActivityTodayProgress) {
    setBusyId(row.activity.id)
    setError(null)
    try {
      if (row.activity.type === 'deadline') {
        await deleteCompletedEntriesForActivity(row.activity.id)
        setLogEntries((prev) =>
          prev.filter(
            (e) =>
              !(e.activity_id === row.activity.id && e.type === 'completed'),
          ),
        )
      } else {
        await deleteCompletedEntriesForDate(row.activity.id, today)
        setLogEntries((prev) =>
          prev.filter(
            (e) =>
              !(
                e.activity_id === row.activity.id &&
                e.date === today &&
                e.type === 'completed'
              ),
          ),
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo')
    } finally {
      setBusyId(null)
    }
  }

  async function handleIncrement(row: ActivityTodayProgress) {
    if (!user || row.done) return
    setBusyId(row.activity.id)
    setError(null)
    try {
      const created = await insertCompletedEntry({
        userId: user.id,
        activityId: row.activity.id,
        date: today,
      })
      setLogEntries((prev) => [created, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add +1')
    } finally {
      setBusyId(null)
    }
  }

  async function handleLogMetric(metricId: string, value: number) {
    if (!user) return
    setBusyId(metricId)
    setError(null)
    try {
      const entry = await upsertMetricEntry({
        userId: user.id,
        metricId,
        date: today,
        value,
      })
      setMetricEntriesToday((prev) => {
        const without = prev.filter((e) => e.metric_id !== metricId)
        return [...without, entry]
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log metric')
    } finally {
      setBusyId(null)
    }
  }

  function handleTimerStart(row: ActivityTodayProgress) {
    setError(null)
    try {
      timer.start(row.activity.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start timer')
    }
  }

  async function handleTimerStop() {
    if (!user) return
    const stopped = timer.stop()
    if (!stopped) return

    setBusyId(stopped.activityId)
    setError(null)
    try {
      const { entry, queued } = await writeSessionEntry({
        userId: user.id,
        activityId: stopped.activityId,
        date: stopped.date,
        durationSeconds: stopped.durationSeconds,
        startedAt: stopped.startedAt,
        source: 'timer',
      })
      setLogEntries((prev) => {
        if (prev.some((e) => e.id === entry.id)) return prev
        return [entry, ...prev]
      })
      setQueueVersion((v) => v + 1)
      if (queued) {
        setOfflineNotice('Saved offline. Will sync when you reconnect.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save session')
    } finally {
      setBusyId(null)
    }
  }

  async function handleManualMinutes(row: ActivityTodayProgress, minutes: number) {
    if (!user) return
    setBusyId(row.activity.id)
    setError(null)
    try {
      const { entry, queued } = await writeSessionEntry({
        userId: user.id,
        activityId: row.activity.id,
        date: today,
        durationSeconds: Math.round(minutes * 60),
        startedAt: null,
        source: 'manual',
      })
      setLogEntries((prev) => {
        if (prev.some((e) => e.id === entry.id)) return prev
        return [entry, ...prev]
      })
      setQueueVersion((v) => v + 1)
      if (queued) {
        setOfflineNotice('Saved offline. Will sync when you reconnect.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log minutes')
    } finally {
      setBusyId(null)
    }
  }

  async function handleRescheduleDeadline(row: ActivityTodayProgress, newDeadline: string) {
    setBusyId(row.activity.id)
    setError(null)
    try {
      await rescheduleDeadline(row.activity.id, newDeadline)
      setActivities((prev) =>
        prev.map((a) =>
          a.id === row.activity.id ? { ...a, deadline: newDeadline } : a,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reschedule')
    } finally {
      setBusyId(null)
    }
  }

  async function handleOnboardingComplete(selection: {
    activityIds: string[]
    metricIds: string[]
  }) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const activityTemplates = getStarterActivityTemplates(today)
      const metricTemplates = getStarterMetricTemplates()
      for (const id of selection.activityIds) {
        const template = activityTemplates.find((t) => t.id === id)
        if (!template) continue
        await createActivity(user.id, template.input)
      }
      for (const id of selection.metricIds) {
        const template = metricTemplates.find((t) => t.id === id)
        if (!template) continue
        await createMetric(user.id, template.input)
      }
      const acts = await listActivities(true)
      const mets = await listMetrics(true)
      setActivities(acts)
      setMetrics(mets)
      writeDismissedFlag(ONBOARDING_DISMISS_KEY, true)
      setOnboardingDismissed(true)
      await refreshTodayData(acts)
      setTab('today')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not set up starters')
    } finally {
      setSaving(false)
    }
  }

  function handleOnboardingSkip() {
    writeDismissedFlag(ONBOARDING_DISMISS_KEY, true)
    setOnboardingDismissed(true)
    setError(null)
  }

  const activeActivityCount = useMemo(
    () => activities.filter((a) => !a.archived).length,
    [activities],
  )

  const showOnboarding =
    !loadingActivities &&
    !loadingMetrics &&
    needsOnboarding(activeActivityCount, onboardingDismissed)

  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  })

  return (
    <div className="app">
      <header className="app-header">
        {analyticsOpen ? (
          <h1 className="app-title">Analytics</h1>
        ) : settingsOpen ? (
          <h1 className="app-title">Settings</h1>
        ) : (
          <BrandTitle className="app-title" />
        )}
        <div className="app-header-actions">
          <button
            type="button"
            className={`icon-btn ${settingsOpen || analyticsOpen ? 'icon-btn-active' : ''}`}
            aria-label={settingsOpen || analyticsOpen ? 'Close settings' : 'Open settings'}
            aria-pressed={settingsOpen || analyticsOpen}
            onClick={() => {
              setError(null)
              if (analyticsOpen) {
                setAnalyticsOpen(false)
                setSettingsOpen(false)
                return
              }
              setSettingsOpen((v) => !v)
            }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065Z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
              />
            </svg>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="app-main">
        <InstallPrompt />
        {legalPage === 'feedback' ? (
          <FeedbackPage
            onBack={() => setLegalPage(null)}
            defaultName={user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''}
            defaultEmail={user?.email ?? ''}
          />
        ) : legalPage ? (
          <LegalPage page={legalPage} onBack={() => setLegalPage(null)} />
        ) : analyticsOpen ? (
          <AnalyticsScreen
            onBack={() => {
              setAnalyticsOpen(false)
              setSettingsOpen(true)
            }}
          />
        ) : (
          <>
            {settingsOpen ? (
              <SettingsScreen
                isAdmin={isAdmin}
                onOpenAnalytics={() => {
                  if (!isAdmin) return
                  setAnalyticsOpen(true)
                }}
                onBack={() => setSettingsOpen(false)}
              />
            ) : showOnboarding ? (
              <OnboardingScreen
                saving={saving}
                error={error}
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
              />
            ) : (
              <>
                {tab === 'today' && (
                  <TodayScreen
                    dateLabel={dateLabel}
                    rows={todayRows}
                    metrics={todayMetrics}
                    loading={loadingToday || loadingActivities || loadingMetrics}
                    busyId={busyId}
                    error={error}
                    offlineNotice={offlineNotice}
                    activeTimer={timer.active}
                    timerElapsedSeconds={timer.elapsedSeconds}
                    onCheckOff={handleCheckOff}
                    onUncheck={handleUncheck}
                    onIncrement={handleIncrement}
                    onLogMetric={handleLogMetric}
                    onTimerStart={handleTimerStart}
                    onTimerPause={timer.pause}
                    onTimerResume={timer.resume}
                    onTimerStop={() => void handleTimerStop()}
                    onManualMinutes={handleManualMinutes}
                    onRescheduleDeadline={handleRescheduleDeadline}
                  />
                )}

        {tab === 'activities' && (
          <>
            {activityScreen.name === 'list' && (
              <>
                {error && <p className="error">{error}</p>}
                <ActivityList
                  activities={activities}
                  loading={loadingActivities}
                  showArchived={showArchivedActivities}
                  onToggleArchived={() => setShowArchivedActivities((v) => !v)}
                  onSelect={(activity) =>
                    setActivityScreen({ name: 'detail', activityId: activity.id })
                  }
                  onAdd={() => {
                    setError(null)
                    setActivityScreen({ name: 'form' })
                  }}
                />
              </>
            )}

            {activityScreen.name === 'form' && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm back-btn"
                  onClick={() =>
                    setActivityScreen(
                      activityScreen.activity
                        ? { name: 'detail', activityId: activityScreen.activity.id }
                        : { name: 'list' },
                    )
                  }
                >
                  ← Back
                </button>
                <h2 className="form-title">
                  {activityScreen.activity ? 'Edit activity' : 'Add activity'}
                </h2>
                <ActivityForm
                  initial={activityScreen.activity ?? null}
                  saving={saving}
                  error={error}
                  onSubmit={handleActivitySave}
                  onCancel={() =>
                    setActivityScreen(
                      activityScreen.activity
                        ? { name: 'detail', activityId: activityScreen.activity.id }
                        : { name: 'list' },
                    )
                  }
                />
              </>
            )}

            {activityScreen.name === 'detail' && selectedActivity && (
              <ActivityDetail
                activity={selectedActivity}
                entries={detailLogEntries}
                loadingEntries={loadingDetailEntries}
                busy={saving}
                error={error}
                onBack={() => setActivityScreen({ name: 'list' })}
                onEdit={() => {
                  setError(null)
                  setActivityScreen({ name: 'form', activity: selectedActivity })
                }}
                onUpdateEntry={async (entryId, updates) => {
                  setSaving(true)
                  setError(null)
                  try {
                    const updated = await updateLogEntry(entryId, updates)
                    setDetailLogEntries((prev) =>
                      prev
                        .map((e) => (e.id === entryId ? updated : e))
                        .sort((a, b) =>
                          b.date === a.date
                            ? b.created_at.localeCompare(a.created_at)
                            : b.date.localeCompare(a.date),
                        ),
                    )
                    await refreshTodayData(activities)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not update entry')
                    throw err
                  } finally {
                    setSaving(false)
                  }
                }}
                onDeleteEntry={async (entryId) => {
                  setSaving(true)
                  setError(null)
                  try {
                    await deleteLogEntry(entryId)
                    setDetailLogEntries((prev) => prev.filter((e) => e.id !== entryId))
                    await refreshTodayData(activities)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not delete entry')
                    throw err
                  } finally {
                    setSaving(false)
                  }
                }}
                onMarkDeadlineComplete={async () => {
                  if (!user) return
                  setSaving(true)
                  setError(null)
                  try {
                    const created = await insertCompletedEntry({
                      userId: user.id,
                      activityId: selectedActivity.id,
                      date: today,
                    })
                    setDetailLogEntries((prev) => [created, ...prev])
                    await refreshTodayData(activities)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not mark complete')
                  } finally {
                    setSaving(false)
                  }
                }}
                onRescheduleDeadline={async (newDeadline) => {
                  setSaving(true)
                  setError(null)
                  try {
                    await rescheduleDeadline(selectedActivity.id, newDeadline)
                    setActivities((prev) =>
                      prev.map((a) =>
                        a.id === selectedActivity.id
                          ? { ...a, deadline: newDeadline }
                          : a,
                      ),
                    )
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not reschedule')
                  } finally {
                    setSaving(false)
                  }
                }}
                onBreakDown={async () => {
                  const result = await requestMicroSteps(selectedActivity.name)
                  if (!result.ok) {
                    return { error: result.error }
                  }
                  try {
                    const updated = await updateActivityMicroSteps(
                      selectedActivity.id,
                      result.steps,
                    )
                    setActivities((prev) =>
                      prev.map((a) => (a.id === updated.id ? updated : a)),
                    )
                    return { steps: result.steps }
                  } catch (err) {
                    return {
                      error:
                        err instanceof Error
                          ? err.message
                          : 'Could not save breakdown steps',
                    }
                  }
                }}
                onArchive={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await archiveActivity(selectedActivity.id)
                    await refreshActivities()
                    await refreshTodayData(await listActivities(true))
                    setActivityScreen({ name: 'list' })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Archive failed')
                  } finally {
                    setSaving(false)
                  }
                }}
                onUnarchive={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await unarchiveActivity(selectedActivity.id)
                    await refreshActivities()
                    await refreshTodayData(await listActivities(true))
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Unarchive failed')
                  } finally {
                    setSaving(false)
                  }
                }}
                onDelete={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await deleteActivity(selectedActivity.id)
                    const next = activities.filter((a) => a.id !== selectedActivity.id)
                    setActivities(next)
                    await refreshTodayData(next)
                    setActivityScreen({ name: 'list' })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Delete failed')
                  } finally {
                    setSaving(false)
                  }
                }}
              />
            )}

            {activityScreen.name === 'detail' && !selectedActivity && !loadingActivities && (
              <section className="empty-state">
                <p>Activity not found.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setActivityScreen({ name: 'list' })}
                >
                  Back to list
                </button>
              </section>
            )}
          </>
        )}

        {tab === 'metrics' && (
          <>
            {metricScreen.name === 'list' && (
              <>
                {error && <p className="error">{error}</p>}
                <MetricList
                  metrics={metrics}
                  loading={loadingMetrics}
                  showArchived={showArchivedMetrics}
                  onToggleArchived={() => setShowArchivedMetrics((v) => !v)}
                  onSelect={(metric) =>
                    setMetricScreen({ name: 'detail', metricId: metric.id })
                  }
                  onAdd={() => {
                    setError(null)
                    setMetricScreen({ name: 'form' })
                  }}
                />
              </>
            )}

            {metricScreen.name === 'form' && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm back-btn"
                  onClick={() =>
                    setMetricScreen(
                      metricScreen.metric
                        ? { name: 'detail', metricId: metricScreen.metric.id }
                        : { name: 'list' },
                    )
                  }
                >
                  ← Back
                </button>
                <h2 className="form-title">
                  {metricScreen.metric ? 'Edit metric' : 'Add metric'}
                </h2>
                <MetricForm
                  initial={metricScreen.metric ?? null}
                  saving={saving}
                  error={error}
                  onSubmit={handleMetricSave}
                  onCancel={() =>
                    setMetricScreen(
                      metricScreen.metric
                        ? { name: 'detail', metricId: metricScreen.metric.id }
                        : { name: 'list' },
                    )
                  }
                />
              </>
            )}

            {metricScreen.name === 'detail' && selectedMetric && (
              <MetricDetail
                metric={selectedMetric}
                entries={detailMetricEntries}
                loadingEntries={loadingDetailEntries}
                busy={saving}
                error={error}
                onBack={() => setMetricScreen({ name: 'list' })}
                onEdit={() => {
                  setError(null)
                  setMetricScreen({ name: 'form', metric: selectedMetric })
                }}
                onArchive={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await archiveMetric(selectedMetric.id)
                    await refreshMetrics()
                    setMetricScreen({ name: 'list' })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Archive failed')
                  } finally {
                    setSaving(false)
                  }
                }}
                onUnarchive={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await unarchiveMetric(selectedMetric.id)
                    await refreshMetrics()
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Unarchive failed')
                  } finally {
                    setSaving(false)
                  }
                }}
                onDelete={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await deleteMetric(selectedMetric.id)
                    setMetrics((prev) => prev.filter((m) => m.id !== selectedMetric.id))
                    setMetricScreen({ name: 'list' })
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Delete failed')
                  } finally {
                    setSaving(false)
                  }
                }}
              />
            )}

            {metricScreen.name === 'detail' && !selectedMetric && !loadingMetrics && (
              <section className="empty-state">
                <p>Metric not found.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setMetricScreen({ name: 'list' })}
                >
                  Back to list
                </button>
              </section>
            )}
          </>
        )}

        {tab === 'insights' && (
          <InsightsScreen
            window={insightsWindow}
            onWindowChange={setInsightsWindow}
            insights={insights}
            activities={activities}
            entries={insightsEntries}
            metrics={metrics}
            metricEntries={insightsMetricEntries}
            today={today}
            loading={loadingInsights}
            error={error}
          />
        )}
          </>
        )}
        <SiteFooter onOpenPage={setLegalPage} compact />
          </>
        )}
      </main>

      {!settingsOpen && !analyticsOpen && !showOnboarding && !legalPage && (
      <nav className="app-nav" aria-label="Main">
        <button
          type="button"
          className={`nav-item ${tab === 'today' ? 'nav-item-active' : ''}`}
          onClick={() => switchTab('today')}
        >
          Today
        </button>
        <button
          type="button"
          className={`nav-item ${tab === 'activities' ? 'nav-item-active' : ''}`}
          onClick={() => switchTab('activities')}
        >
          Activities
        </button>
        <button
          type="button"
          className={`nav-item ${tab === 'metrics' ? 'nav-item-active' : ''}`}
          onClick={() => switchTab('metrics')}
        >
          Metrics
        </button>
        <button
          type="button"
          className={`nav-item ${tab === 'insights' ? 'nav-item-active' : ''}`}
          onClick={() => switchTab('insights')}
        >
          Insights
        </button>
      </nav>
      )}
    </div>
  )
}
