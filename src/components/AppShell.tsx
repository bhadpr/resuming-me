import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useProfileSync } from '../hooks/useAuth'
import { useDailyDigest } from '../hooks/useDailyDigest'
import { useTimer } from '../hooks/useTimer'
import { ActivityList } from './ActivityList'
import { ActivityDetail } from './ActivityDetail'
import { MetricList } from './MetricList'
import { MetricForm } from './MetricForm'
import { MetricDetail } from './MetricDetail'
import { TodayScreen } from './TodayScreen'
import { OnboardingScreen } from './OnboardingScreen'
import { InstallPrompt } from './InstallPrompt'
import { BrandTitle } from './BrandTitle'
import { BottomNav } from './BottomNav'
import { Toast } from './Toast'
import { SiteFooter } from './SiteFooter'

const ActivityForm = lazy(() =>
  import('./ActivityForm').then((m) => ({ default: m.ActivityForm })),
)
const InsightsScreen = lazy(() =>
  import('./InsightsScreen').then((m) => ({ default: m.InsightsScreen })),
)
const SettingsScreen = lazy(() =>
  import('./SettingsScreen').then((m) => ({ default: m.SettingsScreen })),
)
const AnalyticsScreen = lazy(() =>
  import('./AnalyticsScreen').then((m) => ({ default: m.AnalyticsScreen })),
)
const AdminFeedbackScreen = lazy(() =>
  import('./AdminFeedbackScreen').then((m) => ({ default: m.AdminFeedbackScreen })),
)
import {
  activityTargetMinutes,
  isQuietReentry,
  buildQuietInsightLine,
  lastActivityWinDate,
  shouldLogJustStartedSession,
  type SmallerChoiceMinutes,
} from '../lib/reentry'
import type { ReentryFollowUp, SkipReason } from './TodayScreen'
import { useUndoToast } from '../hooks/useUndoToast'
import {
  formatCompletedUndoMessage,
  formatCountUndoMessage,
  formatMetricUndoMessage,
  formatRestDayUndoMessage,
  formatSessionUndoMessage,
  formatSkipUndoMessage,
} from '../lib/undoMessages'
import { trackPageView } from '../lib/analytics'
import { useDocumentMeta } from '../hooks/useDocumentMeta'
import { comebackGapDays, track } from '../lib/track'
import { targetToSeconds } from '../lib/timer'
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
  deleteMetricEntry,
  type MetricEntry,
} from '../lib/metricEntries'
import {
  flushSessionQueue,
  queuedSessionsAsLogEntries,
  writeSessionEntry,
} from '../lib/sessions'
import { removeQueuedSession } from '../lib/timerStorage'
import { addDays, startOfWeekMonday, todayLocalDate } from '../lib/dates'
import { buildTodayProgress, type ActivityTodayProgress } from '../lib/today'
import {
  insertPostponedEntry,
  rescheduleDeadline,
  runClientRolloverCatchUp,
} from '../lib/rolloverClient'
import {
  createActivityPause,
  endActivityPause,
  findActivePause,
  listActivityPauses,
  pauseRowToPause,
  type ActivityPauseRow,
  type PauseDuration,
} from '../lib/activityPauses'
import {
  listRestDays,
  markRestDay,
  restDayDates,
  unmarkRestDay,
  type RestDay,
} from '../lib/restDays'
import {
  computeInsights,
  type InsightsWindow,
} from '../lib/insights'
import {
  navigateBack,
  parseAppPath,
  showAppChrome,
  tabFromView,
} from '../lib/navigation'
import { requestMicroSteps } from '../lib/microSteps'
import { enableDailyDigestFromOnboarding } from '../lib/localNotifications'
import {
  needsOnboarding,
  ONBOARDING_DISMISS_KEY,
  readDismissedFlag,
  saveDeadlineReminder,
  writeDismissedFlag,
  type OnboardingCompletePayload,
} from '../lib/onboarding'
import { readTodayCache, writeTodayCache } from '../lib/todayCache'

function ScreenChunkFallback() {
  return <p className="muted-center">Loading…</p>
}

function trackActivityCreated(activity: Activity): void {
  track('activity_created', {
    type: activity.type,
    tracking: activity.tracking_mode,
    target: activity.target_value ?? activity.weekly_target ?? null,
  })
}

function trackLogAndComeback(opts: {
  activity: Activity | undefined
  kind: 'session' | 'completed' | 'count'
  minutes: number | null
  wasPartial: boolean
  entries: LogEntry[]
  activities: Activity[]
  today: string
}): void {
  const activityType = opts.activity?.type ?? 'unknown'
  track('log_created', {
    activity_type: activityType,
    kind: opts.kind,
    minutes: opts.minutes,
    was_partial: opts.wasPartial,
  })

  const activeIds = new Set(
    opts.activities.filter((a) => !a.archived).map((a) => a.id),
  )
  const lastWin = lastActivityWinDate(opts.entries, activeIds)
  const gap = comebackGapDays(lastWin, opts.today, 3)
  if (gap != null) {
    track('comeback', { gap_days: gap })
  }
}

function sessionWasPartial(
  activity: Activity | undefined,
  durationSeconds: number,
): boolean {
  if (!activity || activity.tracking_mode !== 'timer') return false
  if (activity.type === 'weekly_n' || activity.type === 'deadline') return false
  const target = targetToSeconds(activity)
  if (target <= 0) return false
  return durationSeconds > 0 && durationSeconds < target
}

export function AppShell() {
  const { user, signOut, isAdmin } = useAuth()
  const native = Capacitor.isNativePlatform()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  useProfileSync(user)

  const today = todayLocalDate()
  const initialCache = useMemo(
    () => (user ? readTodayCache(user.id, today) : null),
    // Mount-only hydrate from last Today payload
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  const hadCache = initialCache != null

  const view = parseAppPath(location.pathname)
  const tab = tabFromView(view)
  const settingsOpen = view?.name === 'settings'
  const adminPage = view?.name === 'admin' ? view.page : null
  const activityScreen =
    view?.name === 'activities'
      ? view.screen === 'list'
        ? { name: 'list' as const }
        : view.screen === 'form'
          ? { name: 'form' as const, activityId: view.activityId }
          : { name: 'detail' as const, activityId: view.activityId }
      : { name: 'list' as const }
  const metricScreen =
    view?.name === 'numbers'
      ? view.screen === 'list'
        ? { name: 'list' as const }
        : view.screen === 'form'
          ? { name: 'form' as const, metricId: view.metricId }
          : { name: 'detail' as const, metricId: view.metricId }
      : { name: 'list' as const }
  const insightsWindow: InsightsWindow =
    searchParams.get('range') === 'month' ? 'month' : 'week'

  const [activities, setActivities] = useState<Activity[]>(
    () => initialCache?.activities ?? [],
  )
  const [metrics, setMetrics] = useState<Metric[]>(() => initialCache?.metrics ?? [])
  const [logEntries, setLogEntries] = useState<LogEntry[]>(
    () => initialCache?.logEntries ?? [],
  )
  const [postponedEntries, setPostponedEntries] = useState<LogEntry[]>(
    () => initialCache?.postponedEntries ?? [],
  )
  const [metricEntriesToday, setMetricEntriesToday] = useState<MetricEntry[]>(
    () => initialCache?.metricEntriesToday ?? [],
  )
  const [activityPauses, setActivityPauses] = useState<ActivityPauseRow[]>([])
  const [restDays, setRestDays] = useState<RestDay[]>([])
  const metricsRef = useRef(metrics)
  metricsRef.current = metrics

  const [showArchivedActivities, setShowArchivedActivities] = useState(false)
  const [showArchivedMetrics, setShowArchivedMetrics] = useState(false)
  const [loadingActivities, setLoadingActivities] = useState(!hadCache)
  const [loadingMetrics, setLoadingMetrics] = useState(!hadCache)
  const [loadingToday, setLoadingToday] = useState(!hadCache)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [offlineNotice, setOfflineNotice] = useState<string | null>(null)
  const [softNotice, setSoftNotice] = useState<string | null>(null)
  const [reentryFollowUp, setReentryFollowUp] = useState<ReentryFollowUp | null>(null)
  const [queueVersion, setQueueVersion] = useState(0)
  const [detailLogEntries, setDetailLogEntries] = useState<LogEntry[]>([])
  const [detailMetricEntries, setDetailMetricEntries] = useState<MetricEntry[]>([])
  const [loadingDetailEntries, setLoadingDetailEntries] = useState(false)
  const [insightsEntries, setInsightsEntries] = useState<LogEntry[]>([])
  const [insightsMetricEntries, setInsightsMetricEntries] = useState<MetricEntry[]>([])
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [onboardingDismissed, setOnboardingDismissed] = useState(() =>
    readDismissedFlag(ONBOARDING_DISMISS_KEY),
  )

  const undoToast = useUndoToast()

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
      setError(err instanceof Error ? err.message : 'Failed to load numbers')
    } finally {
      setLoadingMetrics(false)
    }
  }, [])

  const refreshTodayData = useCallback(
    async (
      activityList: Activity[],
      opts?: { background?: boolean; metricsList?: Metric[] },
    ) => {
      const background = opts?.background === true
      if (!background) setLoadingToday(true)
      try {
        const activeIds = activityList.filter((a) => !a.archived).map((a) => a.id)
        const from = addDays(startOfWeekMonday(today), -90)
        const [logs, postponed, metricRows, pauses, rests] = await Promise.all([
          listLogEntriesForActivities(activeIds, from, today),
          listRecentPostponed(activeIds, from),
          listMetricEntriesForDate(today),
          listActivityPauses(from),
          listRestDays(from, today),
        ])
        setLogEntries(logs)
        setPostponedEntries(postponed)
        setMetricEntriesToday(metricRows)
        setActivityPauses(pauses)
        setRestDays(rests)
        setQueueVersion((v) => v + 1)
        if (user) {
          writeTodayCache({
            userId: user.id,
            date: today,
            activities: activityList,
            metrics: opts?.metricsList ?? metricsRef.current,
            logEntries: logs,
            postponedEntries: postponed,
            metricEntriesToday: metricRows,
          })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load Today')
      } finally {
        setLoadingToday(false)
      }
    },
    [today, user],
  )

  useEffect(() => {
    void (async () => {
      const background = hadCache
      if (!background) {
        setLoadingActivities(true)
        setLoadingMetrics(true)
      }
      try {
        if (user) {
          await runClientRolloverCatchUp(user.id)
        }
        const [acts, mets] = await Promise.all([listActivities(true), listMetrics(true)])
        setActivities(acts)
        setMetrics(mets)
        await refreshTodayData(acts, { background, metricsList: mets })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      } finally {
        setLoadingActivities(false)
        setLoadingMetrics(false)
      }
    })()
  }, [refreshTodayData, user, hadCache])

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

  const dayStatusOpts = useMemo(() => {
    return {
      restDates: restDayDates(restDays),
      pauses: activityPauses.map(pauseRowToPause),
    }
  }, [restDays, activityPauses])

  const todayRows = useMemo(() => {
    return buildTodayProgress(
      activities,
      mergedLogEntries,
      postponedEntries,
      today,
      dayStatusOpts,
    )
  }, [activities, mergedLogEntries, postponedEntries, today, dayStatusOpts])

  const quietSchedule = useMemo(
    () => ({
      activities,
      entries: mergedLogEntries,
      today,
    }),
    [activities, mergedLogEntries, today],
  )

  useDailyDigest(
    todayRows,
    !loadingActivities && !loadingToday,
    () => {
      navigate('/today')
    },
    quietSchedule,
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

  useEffect(() => {
    if (adminPage === 'analytics') {
      trackPageView('/admin/analytics', 'Analytics')
      return
    }
    if (adminPage === 'feedback') {
      trackPageView('/admin/feedback', 'Admin feedback')
      return
    }
    if (settingsOpen) {
      trackPageView('/settings', 'Settings')
      return
    }
    if (tab === 'today') trackPageView('/today', 'Today')
    else if (tab === 'activities') trackPageView('/activities', 'Activities')
    else if (tab === 'metrics') trackPageView('/numbers', 'Numbers')
    else if (tab === 'insights') {
      trackPageView('/insights', 'Insights')
      track('insights_viewed', { range: insightsWindow })
    }
  }, [tab, settingsOpen, adminPage, location.pathname, insightsWindow])

  useEffect(() => {
    if (!isAdmin && adminPage) navigate('/today', { replace: true })
  }, [isAdmin, adminPage, navigate])

  const appTitle = adminPage
    ? adminPage === 'analytics'
      ? 'Analytics · Resuming'
      : 'Feedback · Resuming'
    : settingsOpen
      ? 'Settings · Resuming'
      : tab === 'today'
        ? 'Today · Resuming'
        : tab === 'activities'
          ? 'Activities · Resuming'
          : tab === 'metrics'
            ? 'Numbers · Resuming'
            : 'Insights · Resuming'

  useDocumentMeta({
    title: appTitle,
    noindex: true,
  })

  const selectedActivityId =
    activityScreen.name === 'detail' || activityScreen.name === 'form'
      ? activityScreen.activityId
      : undefined
  const selectedActivity = selectedActivityId
    ? activities.find((a) => a.id === selectedActivityId)
    : undefined

  const selectedMetricId =
    metricScreen.name === 'detail' || metricScreen.name === 'form'
      ? metricScreen.metricId
      : undefined
  const selectedMetric = selectedMetricId
    ? metrics.find((m) => m.id === selectedMetricId)
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
          setError(err instanceof Error ? err.message : 'Failed to load number history')
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
    () =>
      computeInsights(
        activities,
        insightsEntries,
        insightsWindow,
        today,
        dayStatusOpts,
      ),
    [activities, insightsEntries, insightsWindow, today, dayStatusOpts],
  )

  async function handleActivitySave(input: ActivityInput) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      if (activityScreen.name === 'form' && selectedActivity) {
        const updated = await updateActivity(selectedActivity, input)
        setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
        navigate(`/activities/${updated.id}`)
      } else {
        const created = await createActivity(user.id, input)
        trackActivityCreated(created)
        setActivities((prev) => [created, ...prev])
        navigate(`/activities/${created.id}`)
      }
      await refreshTodayData(
        activityScreen.name === 'form' && selectedActivity
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
      if (metricScreen.name === 'form' && selectedMetric) {
        const updated = await updateMetric(selectedMetric, input)
        setMetrics((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
        navigate(`/numbers/${updated.id}`)
      } else {
        const created = await createMetric(user.id, input)
        setMetrics((prev) => [created, ...prev])
        navigate(`/numbers/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleQuickAddMetric(input: MetricInput) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const created = await createMetric(user.id, input)
      setMetrics((prev) => [created, ...prev])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add number')
    } finally {
      setSaving(false)
    }
  }

  function removeLogEntryLocally(entryId: string) {
    setLogEntries((prev) => prev.filter((e) => e.id !== entryId))
    setDetailLogEntries((prev) => prev.filter((e) => e.id !== entryId))
    setInsightsEntries((prev) => prev.filter((e) => e.id !== entryId))
    setPostponedEntries((prev) => prev.filter((e) => e.id !== entryId))
  }

  function removeMetricEntryLocally(entryId: string, metricId: string) {
    setMetricEntriesToday((prev) => prev.filter((e) => e.id !== entryId))
    setDetailMetricEntries((prev) => prev.filter((e) => e.id !== entryId))
    setInsightsMetricEntries((prev) => prev.filter((e) => e.id !== entryId))
    // Keep list keyed by metric_id in sync if another slice still holds it
    void metricId
  }

  async function undoLogEntry(opts: {
    entryId: string
    queued?: boolean
    activityId?: string
    kind?: 'session' | 'completed' | 'count'
  }) {
    try {
      if (opts.queued) {
        // TODO(P1): offline undo for completions/metrics/skip — only sessions queue today.
        removeQueuedSession(opts.entryId)
        setQueueVersion((v) => v + 1)
      } else {
        await deleteLogEntry(opts.entryId)
      }
      removeLogEntryLocally(opts.entryId)
      track('log_undone', { kind: opts.kind ?? 'session' })
      if (opts.activityId) {
        setReentryFollowUp((prev) =>
          prev?.excludeActivityId === opts.activityId ? null : prev,
        )
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo')
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
      trackLogAndComeback({
        activity: row.activity,
        kind: 'completed',
        minutes: null,
        wasPartial: false,
        entries: logEntries,
        activities,
        today,
      })
      setLogEntries((prev) => [created, ...prev])
      undoToast.show(formatCompletedUndoMessage(row.activity.name), () =>
        undoLogEntry({
          entryId: created.id,
          activityId: row.activity.id,
          kind: 'completed',
        }),
      )
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
      undoToast.dismiss()
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
      const nextValue = row.current + 1
      trackLogAndComeback({
        activity: row.activity,
        kind: 'count',
        minutes: null,
        wasPartial: nextValue < row.target,
        entries: logEntries,
        activities,
        today,
      })
      setLogEntries((prev) => [created, ...prev])
      undoToast.show(formatCountUndoMessage(row.activity.name), () =>
        undoLogEntry({
          entryId: created.id,
          activityId: row.activity.id,
          kind: 'count',
        }),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add +1')
    } finally {
      setBusyId(null)
    }
  }


  async function handleSkipToday(row: ActivityTodayProgress, reason: SkipReason) {
    if (!user) return
    setBusyId(row.activity.id)
    setError(null)
    try {
      const created = await insertPostponedEntry({
        userId: user.id,
        activityId: row.activity.id,
        date: today,
        note: reason,
      })
      if (!created) return
      setLogEntries((prev) => [created, ...prev])
      setPostponedEntries((prev) => [created, ...prev])
      undoToast.show(formatSkipUndoMessage(row.activity.name), () =>
        undoLogEntry({ entryId: created.id, activityId: row.activity.id }),
      )
      track('skip_today', { reason })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not skip today')
    } finally {
      setBusyId(null)
    }
  }

  async function handleTakeRestDay() {
    if (!user) return
    setBusyId('rest-day')
    setError(null)
    try {
      const created = await markRestDay({ userId: user.id, date: today })
      setRestDays((prev) => {
        if (prev.some((r) => r.id === created.id)) return prev
        return [...prev, created]
      })
      undoToast.show(formatRestDayUndoMessage(), async () => {
        await unmarkRestDay(created.id)
        setRestDays((prev) => prev.filter((r) => r.id !== created.id))
      })
      track('rest_day', { duration: 'today' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark rest day')
    } finally {
      setBusyId(null)
    }
  }

  async function handlePauseActivity(duration: PauseDuration) {
    if (!user || activityScreen.name !== 'detail') return
    const activityId = activityScreen.activityId
    setSaving(true)
    setError(null)
    try {
      const created = await createActivityPause({
        userId: user.id,
        activityId,
        duration,
      })
      setActivityPauses((prev) => [created, ...prev])
      track('activity_paused', { duration })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not pause activity')
    } finally {
      setSaving(false)
    }
  }

  async function handleResumeActivity() {
    if (activityScreen.name !== 'detail') return
    const activityId = activityScreen.activityId
    const active = findActivePause(activityPauses, activityId, today)
    if (!active) return
    setSaving(true)
    setError(null)
    try {
      const updated = await endActivityPause(active.id)
      setActivityPauses((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not resume activity')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogMetric(metricId: string, value: number) {
    if (!user) return
    const metric = metrics.find((m) => m.id === metricId)
    const previous = metricEntriesToday.find((e) => e.metric_id === metricId) ?? null
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
      const label = metric
        ? formatMetricUndoMessage(metric.name, value, metric.unit)
        : `Logged ${value}`
      undoToast.show(label, async () => {
        try {
          if (previous) {
            const restored = await upsertMetricEntry({
              userId: user.id,
              metricId,
              date: today,
              value: previous.value,
            })
            setMetricEntriesToday((prev) => {
              const without = prev.filter((e) => e.metric_id !== metricId)
              return [...without, restored]
            })
            setDetailMetricEntries((prev) => {
              const without = prev.filter((e) => e.id !== entry.id)
              return [...without, restored]
            })
            setInsightsMetricEntries((prev) => {
              const without = prev.filter((e) => e.id !== entry.id)
              return [...without, restored]
            })
          } else {
            await deleteMetricEntry(entry.id)
            removeMetricEntryLocally(entry.id, metricId)
          }
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Could not undo')
        }
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log number')
    } finally {
      setBusyId(null)
    }
  }

  function handleTimerStart(row: ActivityTodayProgress, options?: {
    sessionTargetSeconds?: number | null
    fromReentry?: boolean
  }) {
    setError(null)
    setSoftNotice(null)
    try {
      timer.start(row.activity.id, options)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start timer')
    }
  }

  function handleStartSmallerSession(
    row: ActivityTodayProgress,
    minutes: SmallerChoiceMinutes,
  ) {
    handleTimerStart(row, {
      sessionTargetSeconds: minutes == null ? null : minutes * 60,
      fromReentry: true,
    })
  }

  function handleShrinkRunningTimer(minutes: SmallerChoiceMinutes) {
    timer.setSessionTarget(minutes == null ? null : minutes * 60)
  }

  async function handleTimerStop() {
    if (!user) return
    const stopped = timer.stop()
    if (!stopped) return

    const isFreeRun = stopped.sessionTargetSeconds === null
    if (isFreeRun && !shouldLogJustStartedSession(stopped.durationSeconds)) {
      setSoftNotice('No worries. Try again anytime.')
      return
    }

    const durationSeconds = Math.max(1, stopped.durationSeconds)
    setBusyId(stopped.activityId)
    setError(null)
    setSoftNotice(null)
    try {
      const { entry, queued } = await writeSessionEntry({
        userId: user.id,
        activityId: stopped.activityId,
        date: stopped.date,
        durationSeconds,
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

      const activity = activities.find((a) => a.id === stopped.activityId)
      const name = activity?.name ?? 'activity'
      trackLogAndComeback({
        activity,
        kind: 'session',
        minutes: Math.round((durationSeconds / 60) * 10) / 10,
        wasPartial: sessionWasPartial(activity, durationSeconds),
        entries: logEntries,
        activities,
        today,
      })
      undoToast.show(formatSessionUndoMessage(name, durationSeconds), () =>
        undoLogEntry({
          entryId: entry.id,
          queued,
          activityId: stopped.activityId,
          kind: 'session',
        }),
      )

      if (stopped.fromReentry) {
        const row = todayRows.find((r) => r.activity.id === stopped.activityId)
        const maxMinutes =
          (row && activityTargetMinutes(row)) ??
          (activity?.target_value != null
            ? activity.target_unit === 'seconds'
              ? activity.target_value / 60
              : activity.target_value
            : null)
        if (activity && maxMinutes != null) {
          setReentryFollowUp({
            activityName: activity.name,
            maxTargetMinutes: maxMinutes,
            excludeActivityId: stopped.activityId,
          })
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save session')
    } finally {
      setBusyId(null)
    }
  }

  async function handleManualMinutes(row: ActivityTodayProgress, minutes: number) {
    if (!user) return false
    setBusyId(row.activity.id)
    setError(null)
    try {
      const durationSeconds = Math.round(minutes * 60)
      const { entry, queued } = await writeSessionEntry({
        userId: user.id,
        activityId: row.activity.id,
        date: today,
        durationSeconds,
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
      trackLogAndComeback({
        activity: row.activity,
        kind: 'session',
        minutes: Math.round((durationSeconds / 60) * 10) / 10,
        wasPartial: sessionWasPartial(row.activity, durationSeconds),
        entries: logEntries,
        activities,
        today,
      })
      undoToast.show(
        formatSessionUndoMessage(row.activity.name, durationSeconds),
        () =>
          undoLogEntry({
            entryId: entry.id,
            queued,
            activityId: row.activity.id,
            kind: 'session',
          }),
      )
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not log minutes')
      return false
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

  async function handleOnboardingComplete(payload: OnboardingCompletePayload) {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      for (const item of payload.activities) {
        const created = await createActivity(user.id, item.input)
        trackActivityCreated(created)
        if (item.deadlineCadence) {
          saveDeadlineReminder(created.id, item.deadlineCadence)
        }
      }
      if (payload.digest.enabled) {
        await enableDailyDigestFromOnboarding(payload.digest.hour, payload.digest.minute)
      }
      const acts = await listActivities(true)
      const mets = await listMetrics(true)
      setActivities(acts)
      setMetrics(mets)
      writeDismissedFlag(ONBOARDING_DISMISS_KEY, true)
      setOnboardingDismissed(true)
      await refreshTodayData(acts)
      navigate('/today')
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

  if (view?.name === 'admin' && !isAdmin) {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="app">
      <header className="app-header">
        {adminPage === 'analytics' ? (
          <h1 className="app-title">Analytics</h1>
        ) : adminPage === 'feedback' ? (
          <h1 className="app-title">Feedback</h1>
        ) : settingsOpen ? (
          <h1 className="app-title">Settings</h1>
        ) : (
          <BrandTitle className="app-title" />
        )}
        <div className="app-header-actions">
          <button
            type="button"
            className={`icon-btn ${settingsOpen || adminPage ? 'icon-btn-active' : ''}`}
            aria-label={settingsOpen || adminPage ? 'Close settings' : 'Open settings'}
            aria-pressed={Boolean(settingsOpen || adminPage)}
            onClick={() => {
              setError(null)
              if (adminPage || settingsOpen) {
                navigateBack(navigate, '/today')
                return
              }
              navigate('/settings')
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
        </div>
      </header>

      <main className="app-main">
        {!showOnboarding && <InstallPrompt />}
        {adminPage === 'analytics' ? (
          <Suspense fallback={<ScreenChunkFallback />}>
            <AnalyticsScreen />
          </Suspense>
        ) : adminPage === 'feedback' ? (
          <Suspense fallback={<ScreenChunkFallback />}>
            <AdminFeedbackScreen />
          </Suspense>
        ) : (
          <>
            {settingsOpen ? (
              <Suspense fallback={<ScreenChunkFallback />}>
                <SettingsScreen
                  isAdmin={isAdmin}
                  todayItems={todayRows.map((row) => ({
                    name: row.activity.name,
                    done: row.done,
                  }))}
                  onBack={() => navigateBack(navigate, '/today')}
                  onOpenAnalytics={() => {
                    if (!isAdmin) return
                    navigate('/admin/analytics')
                  }}
                  onOpenFeedback={() => {
                    if (!isAdmin) return
                    navigate('/admin/feedback')
                  }}
                  onOpenPrivacy={() => navigate('/privacy')}
                  onSignOut={() => void signOut()}
                />
              </Suspense>
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
                    softNotice={softNotice}
                    activeTimer={timer.active}
                    timerElapsedSeconds={timer.elapsedSeconds}
                    reentryFollowUp={reentryFollowUp}
                    onCheckOff={handleCheckOff}
                    onUncheck={handleUncheck}
                    onIncrement={handleIncrement}
                    onLogMetric={handleLogMetric}
                    onTimerStart={handleTimerStart}
                    onTimerPause={timer.pause}
                    onTimerResume={timer.resume}
                    onTimerStop={() => void handleTimerStop()}
                    onManualMinutes={handleManualMinutes}
                    onStartSmallerSession={handleStartSmallerSession}
                    onShrinkRunningTimer={handleShrinkRunningTimer}
                    onRescheduleDeadline={handleRescheduleDeadline}
                    onSkipToday={handleSkipToday}
                    onTakeRestDay={() => void handleTakeRestDay()}
                    isRestDay={dayStatusOpts.restDates.has(today)}
                    hasActivities={activeActivityCount > 0}
                    quietReentry={isQuietReentry({
                      activities,
                      entries: mergedLogEntries,
                      today,
                    })}
                    onEmptySetup={() => {
                      writeDismissedFlag(ONBOARDING_DISMISS_KEY, false)
                      setOnboardingDismissed(false)
                    }}
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
                  onSelect={(activity) => navigate(`/activities/${activity.id}`)}
                  onAdd={() => {
                    setError(null)
                    navigate('/activities/new')
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
                    navigateBack(
                      navigate,
                      activityScreen.activityId
                        ? `/activities/${activityScreen.activityId}`
                        : '/activities',
                    )
                  }
                >
                  ← Back
                </button>
                <h2 className="form-title">
                  {selectedActivity ? 'Edit activity' : 'Add activity'}
                </h2>
                <Suspense fallback={<ScreenChunkFallback />}>
                  <ActivityForm
                    initial={selectedActivity ?? null}
                    saving={saving}
                    error={error}
                    onSubmit={handleActivitySave}
                    onCancel={() =>
                      navigate(
                        selectedActivity
                          ? `/activities/${selectedActivity.id}`
                          : '/activities',
                      )
                    }
                  />
                </Suspense>
              </>
            )}

            {activityScreen.name === 'detail' && selectedActivity && (
              <ActivityDetail
                activity={selectedActivity}
                entries={detailLogEntries}
                pauses={activityPauses}
                dayStatusOpts={dayStatusOpts}
                loadingEntries={loadingDetailEntries}
                busy={saving}
                error={error}
                onBack={() => navigate('/activities')}
                onEdit={() => {
                  setError(null)
                  navigate(`/activities/${selectedActivity.id}/edit`)
                }}
                onPause={handlePauseActivity}
                onResume={handleResumeActivity}
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
                    navigate('/activities')
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
                    navigate('/activities')
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
                  onClick={() => navigate('/activities')}
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
                  onSelect={(metric) => navigate(`/numbers/${metric.id}`)}
                  onAdd={() => {
                    setError(null)
                    navigate('/numbers/new')
                  }}
                  onQuickAdd={(input) => void handleQuickAddMetric(input)}
                />
              </>
            )}

            {metricScreen.name === 'form' && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm back-btn"
                  onClick={() =>
                    navigateBack(
                      navigate,
                      metricScreen.metricId
                        ? `/numbers/${metricScreen.metricId}`
                        : '/numbers',
                    )
                  }
                >
                  ← Back
                </button>
                <h2 className="form-title">
                  {selectedMetric ? 'Edit number' : 'Add number'}
                </h2>
                <MetricForm
                  initial={selectedMetric ?? null}
                  saving={saving}
                  error={error}
                  onSubmit={handleMetricSave}
                  onCancel={() =>
                    navigate(
                      selectedMetric ? `/numbers/${selectedMetric.id}` : '/numbers',
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
                onBack={() => navigate('/numbers')}
                onEdit={() => {
                  setError(null)
                  navigate(`/numbers/${selectedMetric.id}/edit`)
                }}
                onArchive={async () => {
                  setSaving(true)
                  setError(null)
                  try {
                    await archiveMetric(selectedMetric.id)
                    await refreshMetrics()
                    navigate('/numbers')
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
                    navigate('/numbers')
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
                <p>Number not found.</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => navigate('/numbers')}
                >
                  Back to list
                </button>
              </section>
            )}
          </>
        )}

        {tab === 'insights' && (
          <Suspense fallback={<ScreenChunkFallback />}>
            <InsightsScreen
              window={insightsWindow}
              onWindowChange={(next) => {
                setSearchParams(next === 'week' ? {} : { range: next }, { replace: true })
              }}
              insights={insights}
              activities={activities}
              entries={insightsEntries}
              metrics={metrics}
              metricEntries={insightsMetricEntries}
              today={today}
              dayStatusOpts={dayStatusOpts}
              loading={loadingInsights}
              error={error}
              onAddActivity={() => {
                setError(null)
                navigate('/activities/new')
              }}
              onAddMetric={(input) => void handleQuickAddMetric(input)}
              quietLine={buildQuietInsightLine({
                activities,
                entries: mergedLogEntries,
                today,
                rows: todayRows,
              })}
            />
          </Suspense>
        )}
          </>
        )}
        {!native && !showOnboarding && <SiteFooter compact />}
          </>
        )}
      </main>

      {showAppChrome(view) && !showOnboarding && (
        <>
          {undoToast.toast && (
            <Toast
              message={undoToast.toast.message}
              onUndo={() => void undoToast.undo()}
            />
          )}
          <BottomNav tab={tab} />
        </>
      )}
    </div>
  )
}
