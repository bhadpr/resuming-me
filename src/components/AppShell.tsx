import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth, useProfileSync } from '../hooks/useAuth'
import { createSupabaseClient } from '../lib/supabase'
import {
  accountGap,
  freshStartBlock,
  freshStartCovers,
  listAccountComebacks,
  rankResumable,
  readSeenMilestones,
  shouldShowWelcomeBack,
  takeComebackMilestone,
  writeSeenMilestones,
  type FreshStartRange,
  type WelcomeBackState,
} from '../lib/comeback'
import { canLogPastGoal, countPortion } from '../lib/dayStatus'
import { pickMoment } from '../lib/moments'
import {
  loadBirthday,
  loadReviewSchedule,
  loadReviewsOff,
  loadSeenMoments,
  saveBirthday,
  saveReviewSchedule,
  saveReviewsOff,
  saveSeenMoments,
} from '../lib/reviewPrefs'
import { activeReviewWindow, buildWeeklyReview, focusApplies, nextFocusWeekStart } from '../lib/weeklyReview'
import { upsertWeeklyReview } from '../lib/weeklyReviews'
import { WeeklyReviewScreen } from './WeeklyReviewScreen'
import {
  deleteFreshStart,
  insertFreshStart,
  listFreshStarts,
  loadShowEverything,
  loadWelcomeBackState,
  saveShowEverything,
  saveWelcomeBackState,
} from '../lib/freshStarts'
import { useDailyDigest } from '../hooks/useDailyDigest'
import { useMedicines } from '../hooks/useMedicines'
import { deleteMedicine, saveMedicine } from '../lib/medicines'
import { useReminders } from '../hooks/useReminders'
import type { Reminder } from '../lib/reminderSchedule'
import { useTimer } from '../hooks/useTimer'
import { ActivityList } from './ActivityList'
import { ActivityDetail } from './ActivityDetail'
import { MetricList } from './MetricList'
import { MetricForm } from './MetricForm'
import { MetricDetail } from './MetricDetail'
import { TodayScreen } from './TodayScreen'
import { MedicineSection } from './MedicineSection'
import { MedicineEditor } from './MedicineForm'
import { ReminderEditor } from './ReminderForm'
import { askForReminderAlerts } from '../lib/reminderNotifications'
import { untimedReminderNames } from '../lib/reminderAlerts'
import { ReminderListSection } from './ReminderSection'
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
const AdminGroupsScreen = lazy(() =>
  import('./AdminGroupsScreen').then((m) => ({ default: m.AdminGroupsScreen })),
)
const ThemesScreen = lazy(() =>
  import('./ThemesScreen').then((m) => ({ default: m.ThemesScreen })),
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
import { catalogTrackId, visibleName } from '../lib/catalogName'
import { formatLongDate, t } from '../lib/i18n'
import { comebackGapDays, track } from '../lib/track'
import { useLocale } from '../hooks/useLocale'
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
import { activityInputFromTemplate, templateById } from '../data/activityTemplates'
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
import { Icon } from './Icon'

function ScreenChunkFallback() {
  return <p className="muted-center">Loading…</p>
}

function trackActivityCreated(activity: Activity): void {
  track('activity_created', {
    type: activity.type,
    tracking: activity.tracking_mode,
    target: activity.target_value ?? activity.weekly_target ?? null,
    template_id: catalogTrackId(activity.template_id),
    signed_in: true,
  })
}

function trackMetricCreated(metric: { template_id?: string | null }): void {
  track('metric_created', {
    template_id: catalogTrackId(metric.template_id),
    signed_in: true,
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
    template_id: catalogTrackId(opts.activity?.template_id),
    signed_in: true,
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
  const { locale } = useLocale()
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
  const themesOpen = view?.name === 'themes'
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
  const [habitFormPhase, setHabitFormPhase] = useState<'pick' | 'details'>('pick')
  const [vitalFormPhase, setVitalFormPhase] = useState<'pick' | 'details'>('pick')
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
  const [slipAnswer, setSlipAnswer] = useState<string[]>([])
  const [welcomeState, setWelcomeState] = useState<WelcomeBackState>(loadWelcomeBackState)
  const [visibleGapStart, setVisibleGapStart] = useState<string | null>(null)
  const [freshStarts, setFreshStarts] = useState<FreshStartRange[]>([])
  const [showEverything, setShowEverything] = useState(loadShowEverything)
  const [reviewSchedule, setReviewSchedule] = useState(loadReviewSchedule)
  const [reviewsOff, setReviewsOff] = useState(loadReviewsOff)
  const [birthday, setBirthday] = useState<string | null>(loadBirthday)
  const [seenMoments, setSeenMoments] = useState<string[]>(loadSeenMoments)
  const [focusActivityId, setFocusActivityId] = useState<string | null>(null)
  const [focusWeekStart, setFocusWeekStart] = useState<string | null>(null)
  const [milestone, setMilestone] = useState<string | null>(null)
  const [shrinkSnapshot, setShrinkSnapshot] = useState<Activity | null>(null)
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
      freshStarts,
      showEverything,
    }
  }, [restDays, activityPauses, freshStarts, showEverything])

  useEffect(() => {
    if (!user) {
      setFreshStarts([])
      return
    }
    let cancelled = false
    void listFreshStarts(user.id)
      .then((rows) => {
        if (!cancelled) setFreshStarts(rows)
      })
      .catch(() => {
        /* Table may not be migrated yet. The card still works from local state. */
      })
    return () => {
      cancelled = true
    }
  }, [user])

  useEffect(() => {
    if (!user) {
      setFocusActivityId(null)
      setFocusWeekStart(null)
      return
    }
    let cancelled = false
    void createSupabaseClient()
      .from('profiles')
      .select('focus_activity_id, focus_week_start')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return
        setFocusActivityId(data.focus_activity_id)
        setFocusWeekStart(data.focus_week_start)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const welcomeBack = useMemo(() => {
    const gap = accountGap({
      activities,
      entries: mergedLogEntries,
      today,
      restDates: dayStatusOpts.restDates,
      pauses: dayStatusOpts.pauses,
    })
    const showedToday = mergedLogEntries.some(
      (entry) =>
        entry.date === today &&
        (entry.type === 'completed' || (entry.type === 'session' && (entry.duration_seconds ?? 0) > 0)),
    )
    if (showedToday) return null
    if (
      !shouldShowWelcomeBack({
        gapDays: gap.gapDays,
        gapStart: gap.gapStart,
        state: welcomeState,
        visibleGapStart,
      })
    ) {
      return null
    }
    const ranked = rankResumable(activities, mergedLogEntries, today, {
      restDates: dayStatusOpts.restDates,
      pauses: dayStatusOpts.pauses,
      preferredTimes: slipAnswer,
    })
    const suggestion = ranked[0]
    if (!suggestion || !gap.gapStart) return null
    return {
      gapDays: gap.gapDays,
      gapStart: gap.gapStart,
      suggestion,
      alternatives: ranked.slice(1, 4),
      why: suggestion.why_matters,
      freshStart: freshStartBlock(freshStarts, today),
    }
  }, [
    activities,
    mergedLogEntries,
    today,
    dayStatusOpts,
    welcomeState,
    visibleGapStart,
    slipAnswer,
    freshStarts,
  ])

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
  const reviewWindow = useMemo(
    () =>
      activeReviewWindow({
        now: new Date(),
        timeZone,
        schedule: reviewSchedule,
        reviewsOff,
      }),
    [timeZone, reviewSchedule, reviewsOff],
  )
  const reviewWeekStart = view?.name === 'review' ? view.weekStart : null
  const weeklyReview = useMemo(() => {
    if (!reviewWindow && !reviewWeekStart) return null
    const weekStart = reviewWeekStart ?? reviewWindow?.weekStart
    if (!weekStart || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return null
    return buildWeeklyReview({
      activities,
      entries: mergedLogEntries,
      metrics,
      metricEntries: insightsMetricEntries,
      today,
      weekStart,
      restDates: dayStatusOpts.restDates,
      pauses: dayStatusOpts.pauses,
      freshStarts: dayStatusOpts.freshStarts,
      showEverything: dayStatusOpts.showEverything,
      slipAnswer: slipAnswer[0] ?? null,
    })
  }, [
    reviewWindow,
    reviewWeekStart,
    activities,
    mergedLogEntries,
    metrics,
    insightsMetricEntries,
    today,
    dayStatusOpts,
    slipAnswer,
  ])
  const moment = useMemo(
    () =>
      pickMoment({
        today,
        birthday,
        seen: seenMoments,
        activities,
        entries: mergedLogEntries,
        pauses: dayStatusOpts.pauses,
        restDates: dayStatusOpts.restDates,
        freshStarts: dayStatusOpts.freshStarts,
        showEverything: dayStatusOpts.showEverything,
        welcomeBackVisible: welcomeBack != null,
      }),
    [today, birthday, seenMoments, activities, mergedLogEntries, dayStatusOpts, welcomeBack],
  )

  useEffect(() => {
    if (loadingActivities) return
    const total = listAccountComebacks(activities, mergedLogEntries, today, 3650, dayStatusOpts).length
    const taken = takeComebackMilestone(total, readSeenMilestones())
    writeSeenMilestones(taken.seen)
    if (taken.message) setMilestone(taken.message)
  }, [loadingActivities, activities, mergedLogEntries, today, dayStatusOpts])

  useEffect(() => {
    if (!milestone) return
    const timerId = window.setTimeout(() => setMilestone(null), 6000)
    return () => window.clearTimeout(timerId)
  }, [milestone])

  useEffect(() => {
    if (!user || !reviewWindow || !weeklyReview || reviewsOff) return
    if (weeklyReview.weekStart !== reviewWindow.weekStart) return
    const key = `resuming-review-generated:${weeklyReview.weekStart}`
    if (localStorage.getItem(key) !== '1') {
      localStorage.setItem(key, '1')
      track('review_generated', { week_start: weeklyReview.weekStart })
    }
    void upsertWeeklyReview(user.id, weeklyReview).catch(() => {
      /* Migration may not be applied yet. The card still renders. */
    })
  }, [user, reviewWindow, weeklyReview, reviewsOff])

  const reviewSource = searchParams.get('source') === 'email' ? 'email' : 'app'
  useEffect(() => {
    if (!reviewWeekStart) return
    track('review_opened', { source: reviewSource })
  }, [reviewWeekStart, reviewSource])

  useEffect(() => {
    if (!welcomeBack) return
    if (visibleGapStart === welcomeBack.gapStart) return
    setVisibleGapStart(welcomeBack.gapStart)
    const next = { ...welcomeState, lastGapStartedAt: welcomeBack.gapStart }
    saveWelcomeBackState(next)
    setWelcomeState(next)
    track('welcome_back_shown', { gap_days: welcomeBack.gapDays })
    if (user) {
      void createSupabaseClient()
        .from('profiles')
        .update({
          last_gap_started_at: welcomeBack.gapStart,
          last_welcome_back_shown_at: new Date().toISOString(),
        })
        .eq('id', user.id)
    }
  }, [welcomeBack, visibleGapStart, welcomeState, user])

  function hideWelcomeBack() {
    if (!welcomeBack) return
    const next = { ...welcomeState, lastGapStartedAt: welcomeBack.gapStart }
    saveWelcomeBackState(next)
    setWelcomeState(next)
    setVisibleGapStart(null)
  }

  function dismissWelcomeBack() {
    if (!welcomeBack) return
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    const next = { lastGapStartedAt: welcomeBack.gapStart, dismissedUntil: until }
    saveWelcomeBackState(next)
    setWelcomeState(next)
    setVisibleGapStart(null)
    if (user) {
      void createSupabaseClient()
        .from('profiles')
        .update({ welcome_back_dismissed_until: until, last_gap_started_at: welcomeBack.gapStart })
        .eq('id', user.id)
    }
  }

  function handleWelcomeStart(row: ActivityTodayProgress, minutes: number | null) {
    if (minutes === 1 || minutes === 2) handleStartSmallerSession(row, minutes)
    else if (minutes != null) {
      handleTimerStart(row, { sessionTargetSeconds: minutes * 60, fromReentry: true })
    } else if (row.actionKind === 'timer') handleTimerStart(row, { fromReentry: true })
    else if (row.actionKind === 'count') void handleIncrement(row)
    else void handleCheckOff(row)
    hideWelcomeBack()
  }

  async function handleFreshStart() {
    if (!welcomeBack || !user) return
    const block = freshStartBlock(freshStarts, today)
    if (!block.allowed) return
    const covers = freshStartCovers(welcomeBack.gapStart, today)
    const row = await insertFreshStart(user.id, covers)
    setFreshStarts((current) => [row, ...current])
    dismissWelcomeBack()
  }

  const todayRows = useMemo(() => {
    return buildTodayProgress(
      activities,
      mergedLogEntries,
      postponedEntries,
      today,
      dayStatusOpts,
    )
  }, [activities, mergedLogEntries, postponedEntries, today, dayStatusOpts])

  function toActivityInput(activity: Activity, targetValue: number | null = activity.target_value): ActivityInput {
    return {
      name: activity.name,
      emoji: activity.emoji,
      type: activity.type,
      trackingMode: activity.tracking_mode,
      targetValue,
      targetUnit: activity.target_unit,
      weeklyTarget: activity.weekly_target,
      deadline: activity.deadline,
      whyMatters: activity.why_matters,
      usuallyWhen: activity.usually_when,
      templateId: activity.template_id ?? null,
      nameOverridden: activity.name_overridden ?? false,
    }
  }

  async function applyShrink(activityId: string, minutes: number) {
    const activity = activities.find((item) => item.id === activityId)
    if (!activity) return
    const nextValue = activity.target_unit === 'seconds' ? minutes * 60 : minutes
    setShrinkSnapshot(activity)
    try {
      const updated = await updateActivity(activity, toActivityInput(activity, nextValue))
      setActivities((current) => current.map((item) => (item.id === updated.id ? updated : item)))
      track('review_shrink_used', { activity_type: activity.type })
    } catch (err) {
      setShrinkSnapshot(null)
      setError(err instanceof Error ? err.message : 'Could not shrink the target')
    }
  }

  async function undoShrink() {
    if (!shrinkSnapshot) return
    const current = activities.find((item) => item.id === shrinkSnapshot.id) ?? shrinkSnapshot
    try {
      const updated = await updateActivity(current, toActivityInput(shrinkSnapshot))
      setActivities((rows) => rows.map((item) => (item.id === updated.id ? updated : item)))
      setShrinkSnapshot(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not undo the shrink')
    }
  }

  function dismissMoment(id: string) {
    setSeenMoments((current) => {
      const next = current.includes(id) ? current : [...current, id]
      saveSeenMoments(next)
      return next
    })
  }

  function handleMomentStart(activityId: string, minutes: number | null) {
    const row = todayRows.find((item) => item.activity.id === activityId)
    if (moment) dismissMoment(moment.id)
    if (!row) return
    if (minutes === 1 || minutes === 2) handleStartSmallerSession(row, minutes)
    else if (minutes != null) handleTimerStart(row, { sessionTargetSeconds: minutes * 60, fromReentry: true })
    else if (row.actionKind === 'timer') handleTimerStart(row, { fromReentry: true })
    else if (row.actionKind === 'count') void handleIncrement(row)
    else void handleCheckOff(row)
  }

  function changeBirthday(value: string | null) {
    setBirthday(value)
    saveBirthday(value)
    if (!user) return
    void createSupabaseClient().from('profiles').update({ birthday: value }).eq('id', user.id)
  }

  function changeReviewsOff(off: boolean) {
    setReviewsOff(off)
    saveReviewsOff(off)
    if (!user) return
    void createSupabaseClient().from('profiles').update({ reviews_opt_out: off }).eq('id', user.id)
  }

  function changeReviewSchedule(weekday: number, time: string) {
    const [hourText, minuteText] = time.split(':')
    const next = {
      weekday,
      hour: Number(hourText) || 0,
      minute: Number(minuteText) || 0,
    }
    setReviewSchedule(next)
    saveReviewSchedule(next)
    if (!user) return
    void createSupabaseClient()
      .from('profiles')
      .update({
        review_weekday: next.weekday,
        review_hour: next.hour,
        review_minute: next.minute,
      })
      .eq('id', user.id)
  }

  async function setWeekFocus(activityId: string) {
    const week = weeklyReview ? nextFocusWeekStart(weeklyReview.weekStart) : null
    setFocusActivityId(activityId)
    setFocusWeekStart(week)
    const activity = activities.find((item) => item.id === activityId)
    track('review_focus_set', { activity_type: activity?.type ?? 'daily' })
    if (!user || !week) return
    await createSupabaseClient()
      .from('profiles')
      .update({
        focus_activity_id: activityId,
        focus_week_start: week,
      })
      .eq('id', user.id)
  }

  const quietSchedule = useMemo(
    () => ({
      activities,
      entries: mergedLogEntries,
      today,
    }),
    [activities, mergedLogEntries, today],
  )

  const medicineState = useMedicines(user?.id)
  const reminderState = useReminders(user?.id)
  const untimedReminders = useMemo(
    () => untimedReminderNames(reminderState.reminders, reminderState.today),
    [reminderState.reminders, reminderState.today],
  )

  useDailyDigest(
    todayRows,
    !loadingActivities && !loadingToday,
    () => {
      navigate('/today')
    },
    quietSchedule,
    untimedReminders,
  )

  async function handleReminderDone(reminder: Reminder) {
    if (!(await reminderState.markDone(reminder))) return
    undoToast.show(t('reminders.doneToast', { text: reminder.text }), async () => {
      await reminderState.markNotDone(reminder)
    })
  }

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
    if (adminPage === 'groups') {
      trackPageView(location.pathname, 'Group numbers')
      return
    }
    if (themesOpen) {
      trackPageView('/settings/themes', 'Themes')
      return
    }
    if (settingsOpen) {
      trackPageView('/settings', 'Settings')
      return
    }
    if (reviewWeekStart) {
      trackPageView(`/review/${reviewWeekStart}`, 'Weekly review')
      return
    }
    if (view?.name === 'medicines') {
      trackPageView(
        view.medicineId ? `/medicines/${view.medicineId}` : '/medicines/new',
        'Medicine',
      )
      return
    }
    if (view?.name === 'reminders') {
      trackPageView(view.reminderId ? '/reminders/edit' : '/reminders/new', 'Reminder')
      return
    }
    if (tab === 'today') trackPageView('/today', 'Today')
    else if (tab === 'activities') trackPageView('/activities', 'Activity')
    else if (tab === 'metrics') trackPageView('/numbers', 'Vitals')
    else if (tab === 'insights') {
      trackPageView('/insights', 'Insights')
      track('insights_viewed', { range: insightsWindow })
    }
  }, [tab, settingsOpen, themesOpen, adminPage, location.pathname, insightsWindow, reviewWeekStart])

  useEffect(() => {
    if (!isAdmin && adminPage && adminPage !== 'groups') navigate('/today', { replace: true })
  }, [isAdmin, adminPage, navigate])

  const appTitle = adminPage
    ? adminPage === 'analytics'
      ? 'Analytics · Resuming'
      : adminPage === 'groups'
        ? 'Group numbers · Resuming'
        : 'Feedback · Resuming'
    : reviewWeekStart
      ? 'This week · Resuming'
    : themesOpen
      ? 'Themes · Resuming'
    : settingsOpen
      ? 'Settings · Resuming'
      : tab === 'today'
        ? `${t('nav.today')} · Resuming`
        : tab === 'activities'
          ? `${t('nav.abhyas')} · Resuming`
          : tab === 'metrics'
            ? `${t('nav.vitals')} · Resuming`
            : `${t('nav.insights')} · Resuming`

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

  const activityDetailId =
    tab === 'activities' && activityScreen.name === 'detail' ? activityScreen.activityId : null

  useEffect(() => {
    if (!activityDetailId) {
      setDetailLogEntries((prev) => (prev.length === 0 ? prev : []))
      return
    }
    let cancelled = false
    setLoadingDetailEntries(true)
    void listLogEntriesForActivity(activityDetailId)
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
  }, [activityDetailId])

  const metricDetailId =
    tab === 'metrics' && metricScreen.name === 'detail' ? metricScreen.metricId : null

  useEffect(() => {
    if (!metricDetailId) {
      setDetailMetricEntries((prev) => (prev.length === 0 ? prev : []))
      return
    }
    let cancelled = false
    setLoadingDetailEntries(true)
    // Load enough history for 90-day window
    const from = addDays(todayLocalDate(), -89)
    void listMetricEntriesForMetric(metricDetailId, from)
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
  }, [metricDetailId])

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
        if (user) {
          const { data } = await createSupabaseClient()
            .from('profiles')
            .select('slip_answer')
            .eq('id', user.id)
            .maybeSingle()
          const raw = data?.slip_answer
          const slip = Array.isArray(raw)
            ? raw.filter((item): item is string => typeof item === 'string')
            : []
          if (!cancelled) setSlipAnswer(slip)
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
  }, [tab, activities, metrics, today, user])

  const insights = useMemo(
    () =>
        computeInsights(activities, insightsEntries, insightsWindow, today, {
          ...dayStatusOpts,
          slipAnswer,
        }),
    [activities, insightsEntries, insightsWindow, today, dayStatusOpts, slipAnswer, locale],
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
        trackMetricCreated(created)
        setMetrics((prev) => [created, ...prev])
        navigate(`/numbers/${created.id}`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleAddStepsHabit(goal: number) {
    if (!user) return
    const template = templateById('steps')
    if (!template) return
    setSaving(true)
    setError(null)
    try {
      const created = await createActivity(user.id, {
        ...activityInputFromTemplate(template),
        targetValue: goal,
        templateId: template.id,
        nameOverridden: false,
      })
      trackActivityCreated(created)
      setActivities((prev) => [created, ...prev])
      navigate(`/activities/${created.id}`)
      await refreshTodayData(await listActivities(true))
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
      trackMetricCreated(created)
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
      undoToast.show(formatCompletedUndoMessage(visibleName(row.activity, locale)), () =>
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
    if (!user || (row.done && !canLogPastGoal(row.activity.target_unit))) return
    setBusyId(row.activity.id)
    setError(null)
    try {
      const created = await insertCompletedEntry({
        userId: user.id,
        activityId: row.activity.id,
        date: today,
      })
      const nextValue = row.current + countPortion(row.activity.target_unit, row.activity.target_value)
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
      undoToast.show(formatCountUndoMessage(visibleName(row.activity, locale)), () =>
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
      undoToast.show(formatSkipUndoMessage(visibleName(row.activity, locale)), () =>
        undoLogEntry({ entryId: created.id, activityId: row.activity.id }),
      )
      track('skip_today', { reason })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not skip today')
    } finally {
      setBusyId(null)
    }
  }

  async function handleUnskip(row: ActivityTodayProgress) {
    const skipIds = new Set(
      [...postponedEntries, ...logEntries]
        .filter((entry) => entry.activity_id === row.activity.id && entry.type === 'postponed' && entry.date === today)
        .map((entry) => entry.id),
    )
    if (skipIds.size === 0) return
    setBusyId(row.activity.id)
    try {
      for (const entryId of skipIds) await undoLogEntry({ entryId, activityId: row.activity.id })
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

  async function handlePauseActivity(duration: PauseDuration, activityId?: string) {
    const id = activityId ?? (activityScreen.name === 'detail' ? activityScreen.activityId : null)
    if (!user || !id) return
    setSaving(true)
    setError(null)
    try {
      const created = await createActivityPause({
        userId: user.id,
        activityId: id,
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

  async function handleLogMetric(metricId: string, value: number, secondaryValue?: number | null) {
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
        secondaryValue,
      })
      setMetricEntriesToday((prev) => {
        const without = prev.filter((e) => e.metric_id !== metricId)
        return [...without, entry]
      })
      const label = metric
        ? formatMetricUndoMessage(visibleName(metric, locale), value, metric.unit, secondaryValue)
        : `Logged ${value}`
      undoToast.show(label, async () => {
        try {
          if (previous) {
            const restored = await upsertMetricEntry({
              userId: user.id,
              metricId,
              date: today,
              value: previous.value,
              secondaryValue: previous.secondary_value,
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
            activityName: visibleName(activity, locale),
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
        formatSessionUndoMessage(visibleName(row.activity, locale), durationSeconds),
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
        const times =
          'times' in payload.digest && Array.isArray(payload.digest.times) && payload.digest.times.length > 0
            ? payload.digest.times
            : [{ hour: payload.digest.hour, minute: payload.digest.minute }]
        await enableDailyDigestFromOnboarding(times)
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

  const dateLabel = formatLongDate(locale)

  if (view?.name === 'admin' && view.page !== 'groups' && !isAdmin) {
    return <Navigate to="/settings" replace />
  }

  return (
    <div className="app">
      <header className="app-header">
        {adminPage === 'analytics' ? (
          <h1 className="app-title">Analytics</h1>
        ) : adminPage === 'feedback' ? (
          <h1 className="app-title">Feedback</h1>
        ) : adminPage === 'groups' ? (
          <h1 className="app-title">Group numbers</h1>
        ) : themesOpen ? (
          <h1 className="app-title">{t('settings.themes')}</h1>
        ) : settingsOpen ? (
          <h1 className="app-title">{t('settings.title')}</h1>
        ) : (
          <BrandTitle className="app-title" homeTo="/today" />
        )}
        <div className="app-header-actions">
          <button
            type="button"
            className={`icon-btn ${settingsOpen || themesOpen || adminPage ? 'icon-btn-active' : ''}`}
            aria-label={settingsOpen || themesOpen || adminPage ? t('settings.close') : t('settings.open')}
            aria-pressed={Boolean(settingsOpen || themesOpen || adminPage)}
            onClick={() => {
              setError(null)
              if (adminPage || settingsOpen || themesOpen) {
                navigateBack(navigate, '/today')
                return
              }
              navigate('/settings')
            }}
          >
            <Icon name="settings" size={24} />
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
        ) : adminPage === 'groups' ? (
          <Suspense fallback={<ScreenChunkFallback />}>
            <AdminGroupsScreen
              groupId={view?.name === 'admin' && view.page === 'groups' ? view.groupId : undefined}
            />
          </Suspense>
        ) : (
          <>
            {themesOpen ? (
              <Suspense fallback={<ScreenChunkFallback />}>
                <ThemesScreen onBack={() => navigate('/settings')} />
              </Suspense>
            ) : settingsOpen ? (
              <Suspense fallback={<ScreenChunkFallback />}>
                <SettingsScreen
                  isAdmin={isAdmin}
                  todayItems={todayRows.map((row) => ({
                    name: visibleName(row.activity, locale),
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
                  onOpenGroups={(groupId) => {
                    navigate(groupId ? `/admin/groups/${groupId}` : '/admin/groups')
                  }}
                  onOpenThemes={() => navigate('/settings/themes')}
                  onOpenPrivacy={() => navigate('/privacy')}
                  onSignOut={() => void signOut()}
                  showEverything={showEverything}
                  onShowEverything={(on) => {
                    saveShowEverything(on)
                    setShowEverything(on)
                  }}
                  canUndoFreshStart={freshStarts.length > 0}
                  onUndoFreshStart={() => {
                    const latest = freshStarts[0]
                    if (!latest) return
                    setFreshStarts((current) => current.filter((row) => row.id !== latest.id))
                    if (user) void deleteFreshStart(latest.id).catch(() => setFreshStarts(freshStarts))
                  }}
                  birthday={birthday}
                  onBirthday={changeBirthday}
                  reviewWeekday={reviewSchedule.weekday}
                  reviewTime={`${String(reviewSchedule.hour).padStart(2, '0')}:${String(reviewSchedule.minute).padStart(2, '0')}`}
                  onReviewSchedule={changeReviewSchedule}
                  reviewsOff={reviewsOff}
                  onReviewsOff={changeReviewsOff}
                />
              </Suspense>
            ) : showOnboarding ? (
              <OnboardingScreen
                saving={saving}
                error={error}
                onComplete={handleOnboardingComplete}
                onSkip={handleOnboardingSkip}
              />
            ) : reviewWeekStart ? (
              weeklyReview ? (
              <WeeklyReviewScreen
                review={weeklyReview}
                activities={activities}
                focusActivityId={focusActivityId}
                reviewWeekday={reviewSchedule.weekday}
                busy={saving}
                canUndoShrink={shrinkSnapshot != null}
                onBack={() => navigate('/today')}
                onShrink={(activityId, value) => void applyShrink(activityId, value)}
                onUndoShrink={() => void undoShrink()}
                onFocus={(activityId) => void setWeekFocus(activityId)}
                onInsights={() => navigate('/insights')}
                onTurnOff={() => {
                  changeReviewsOff(true)
                  navigate('/today')
                }}
              />
              ) : (
                <section className="empty-state">
                  <p>That review link doesn’t look right.</p>
                  <button type="button" className="btn btn-primary" onClick={() => navigate('/today')}>
                    Back to Today
                  </button>
                </section>
              )
            ) : (
              <>
                {tab === 'today' && view?.name !== 'reminders' && (
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
                    onUnskip={(row) => void handleUnskip(row)}
                    onPauseHabit={(row, duration) => void handlePauseActivity(duration, row.activity.id)}
                    onTakeRestDay={() => void handleTakeRestDay()}
                    isRestDay={dayStatusOpts.restDates.has(today)}
                    hasActivities={activeActivityCount > 0}
                    quietReentry={isQuietReentry({
                      activities,
                      entries: mergedLogEntries,
                      today,
                    })}
                    welcomeBack={welcomeBack}
                    onWelcomeStart={handleWelcomeStart}
                    onWelcomeDismiss={dismissWelcomeBack}
                    onFreshStart={() => void handleFreshStart()}
                    onAddActivity={() => {
                      setError(null)
                      navigate('/activities/new')
                    }}
                    moment={moment}
                    onMomentStart={handleMomentStart}
                    onMomentDismiss={dismissMoment}
                    reviewCard={
                      reviewWindow && weeklyReview && weeklyReview.weekStart === reviewWindow.weekStart
                        ? { weekStart: weeklyReview.weekStart, headline: weeklyReview.headline }
                        : null
                    }
                    onOpenReview={(weekStart) => navigate(`/review/${weekStart}?source=app`)}
                    focusActivityId={focusApplies(focusWeekStart, today) ? focusActivityId : null}
                    medicineDoses={medicineState.doses}
                    medicineBusyKey={medicineState.busyKey}
                    medicineError={medicineState.error}
                    onToggleMedicineDose={(dose) => void medicineState.toggleDose(dose)}
                    onSkipMedicineDose={medicineState.skipDose}
                    reminders={{
                      open: reminderState.open,
                      doneToday: reminderState.doneToday,
                      today: reminderState.today,
                      busyId: reminderState.busyId,
                      error: reminderState.error,
                      onDone: (reminder) => void handleReminderDone(reminder),
                      onNotDone: (reminder) => void reminderState.markNotDone(reminder),
                      onSkip: (reminder) => void reminderState.markDone(reminder),
                      onMove: (reminder, day) => void reminderState.move(reminder, day),
                      onCancel: (reminder) => {
                        setError(null)
                        reminderState.remove(reminder.id).catch((err: unknown) => {
                          setError(err instanceof Error ? err.message : 'Could not cancel that reminder')
                        })
                      },
                    }}
                    onAddReminder={() => {
                      setError(null)
                      navigate('/reminders/new')
                    }}
                  />
                )}

                {view?.name === 'reminders' && (
                  <ReminderEditor
                    reminderId={view.reminderId}
                    reminders={reminderState.reminders}
                    today={reminderState.today}
                    loading={reminderState.loading}
                    saving={saving}
                    error={error}
                    onCancel={() => navigateBack(navigate, '/today')}
                    onSubmit={async (input) => {
                      if (view?.name !== 'reminders') return
                      const reminderId = view.reminderId
                      setSaving(true)
                      setError(null)
                      try {
                        if (reminderId) {
                          await reminderState.update(reminderId, input)
                        } else if ((await reminderState.add(input)) === 'full') {
                          return 'full'
                        }
                        void askForReminderAlerts(input)
                        navigateBack(navigate, '/today')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not save that reminder')
                      } finally {
                        setSaving(false)
                      }
                    }}
                    onDelete={async (reminder) => {
                      setSaving(true)
                      setError(null)
                      try {
                        await reminderState.remove(reminder.id)
                        navigateBack(navigate, '/today')
                      } catch (err) {
                        setError(err instanceof Error ? err.message : 'Could not delete that reminder')
                      } finally {
                        setSaving(false)
                      }
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
                <ReminderListSection
                  dueNow={reminderState.open}
                  later={reminderState.comingUp}
                  today={reminderState.today}
                  loading={reminderState.loading}
                  error={reminderState.error}
                  onAdd={() => {
                    setError(null)
                    navigate('/reminders/new')
                  }}
                  onOpen={(reminder) => {
                    setError(null)
                    navigate(`/reminders/${reminder.id}`)
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
                  <Icon name="back" />
                  Back
                </button>
                <h2 className="form-title">
                  {selectedActivity
                    ? 'Edit habit'
                    : habitFormPhase === 'details'
                      ? 'Create habit'
                      : 'Add habit'}
                </h2>
                <Suspense fallback={<ScreenChunkFallback />}>
                  <ActivityForm
                    initial={selectedActivity ?? null}
                    existingNames={activities
                      .filter((item) => !item.archived && item.id !== selectedActivity?.id)
                      .map((item) => item.name)}
                    saving={saving}
                    error={error}
                    onPhaseChange={setHabitFormPhase}
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
                onShrink={(value) => void applyShrink(selectedActivity.id, value)}
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
                <p>Habit not found.</p>
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

        {tab === 'metrics' && view?.name === 'numbers' && (
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
                />
                <MedicineSection
                  medicines={medicineState.medicines}
                  loading={medicineState.loading}
                  error={medicineState.error}
                  onAdd={() => {
                    setError(null)
                    navigate('/medicines/new')
                  }}
                  onOpen={(medicine) => {
                    setError(null)
                    navigate(`/medicines/${medicine.id}`)
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
                    navigateBack(
                      navigate,
                      metricScreen.metricId
                        ? `/numbers/${metricScreen.metricId}`
                        : '/numbers',
                    )
                  }
                >
                  <Icon name="back" />
                  Back
                </button>
                <h2 className="form-title">
                  {selectedMetric
                    ? 'Edit vital'
                    : vitalFormPhase === 'details'
                      ? 'Create vital'
                      : 'Add vital'}
                </h2>
                <MetricForm
                  initial={selectedMetric ?? null}
                  existingNames={metrics
                    .filter((item) => !item.archived && item.id !== selectedMetric?.id)
                    .map((item) => item.name)}
                  saving={saving}
                  error={error}
                  onPhaseChange={setVitalFormPhase}
                  hasStepsHabit={activities.some(
                    (item) => !item.archived && item.template_id === 'steps',
                  )}
                  onSubmit={handleMetricSave}
                  onAddSteps={handleAddStepsHabit}
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
                <p>Vital not found.</p>
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

        {view?.name === 'medicines' && (
          <MedicineEditor
            medicineId={view.medicineId}
            medicines={medicineState.medicines}
            loading={medicineState.loading}
            saving={saving}
            error={error ?? medicineState.error}
            onSubmit={async (input) => {
              if (!user || view?.name !== 'medicines') return
              const medicineId = view.medicineId
              setSaving(true)
              setError(null)
              try {
                await saveMedicine(user.id, input, medicineId)
                await medicineState.reload(true)
                navigate('/numbers')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not save that medicine')
              } finally {
                setSaving(false)
              }
            }}
            onDelete={async (medicine) => {
              if (!user) return
              setSaving(true)
              setError(null)
              try {
                await deleteMedicine(user.id, medicine)
                await medicineState.reload(true)
                navigate('/numbers')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not delete that medicine')
              } finally {
                setSaving(false)
              }
            }}
          />
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
              slipAnswer={slipAnswer[0] ?? null}
              onOpenActivity={(activityId) => navigate(`/activities/${activityId}`)}
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
          {milestone && !undoToast.toast && <Toast message={milestone} />}
          <BottomNav tab={tab} />
        </>
      )}
    </div>
  )
}
