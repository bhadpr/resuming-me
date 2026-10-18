import { asCount, asList, asRecord, fetchAnalyticsSummary, missingFunctionMessage } from './adminRpc'
import { createSupabaseClient } from './supabase'

export type EventPeriod = 'week' | 'month'

/** Periods shown for each view. The database caps them at 26 weeks and 13 months. */
export const PERIOD_COUNTS: Record<EventPeriod, number> = { week: 12, month: 12 }

export interface EventSeries {
  name: string
  total: number
  /** One entry per period, oldest first, zero periods included. */
  counts: number[]
  /** Devices (anonymous ids) that sent the event in each period. */
  devices: number[]
}

export interface EventPeriods {
  period: EventPeriod
  /** YYYY-MM-DD of each period's first day, oldest first. The last one is still running. */
  starts: string[]
  currentStart: string
  events: EventSeries[]
}

function dayString(value: unknown): string | null {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null
}

function countList(value: unknown, length: number): number[] {
  const list = Array.isArray(value) ? value : []
  return Array.from({ length }, (_, i) => asCount(list[i]))
}

export function parseEventPeriods(data: unknown): EventPeriods {
  const row = asRecord(data)
  const starts = (Array.isArray(row.starts) ? row.starts : [])
    .map(dayString)
    .filter((start): start is string => start != null)
  return {
    period: row.period === 'month' ? 'month' : 'week',
    starts,
    currentStart: dayString(row.currentStart) ?? starts[starts.length - 1] ?? '',
    events: asList(row.events)
      .filter((entry) => typeof entry.name === 'string' && entry.name !== '')
      .map((entry) => ({
        name: entry.name as string,
        total: asCount(entry.total),
        counts: countList(entry.counts, starts.length),
        devices: countList(entry.devices, starts.length),
      })),
  }
}

export async function fetchEventPeriods(period: EventPeriod): Promise<EventPeriods> {
  const { data, error } = await createSupabaseClient().rpc('event_counts_by_period', {
    p_period: period,
    p_periods: PERIOD_COUNTS[period],
  })
  if (error) {
    if (error.code === '42883' || error.message.includes('event_counts_by_period')) {
      throw new Error(missingFunctionMessage('event_counts_by_period'))
    }
    throw error
  }
  return parseEventPeriods(data)
}

/** "14 Sep" for a week, "Sep 2026" for a month. Read in UTC so the label matches the SQL day. */
export function periodLabel(start: string, period: EventPeriod): string {
  const date = new Date(`${start}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return start
  return period === 'month'
    ? date.toLocaleDateString('en', { month: 'short', year: '2-digit', timeZone: 'UTC' })
    : date.toLocaleDateString('en', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export interface EventInfo {
  label: string
  group: string
}

export const EVENT_GROUPS = [
  'Reminders',
  'Habits',
  'Vitals',
  'Sharing',
  'Sign-up and setup',
  'Reviews and insights',
  'Features and permissions',
  'App',
  'Errors',
  'Other',
] as const

const EVENT_INFO: Record<string, EventInfo> = {
  reminder_added: { label: 'Reminders added', group: 'Reminders' },
  reminder_done: { label: 'Reminders done', group: 'Reminders' },
  onboarding_reminder_set: { label: 'Reminder chosen in setup', group: 'Reminders' },

  activity_created: { label: 'Habits created', group: 'Habits' },
  log_created: { label: 'Check-ins', group: 'Habits' },
  log_undone: { label: 'Check-ins undone', group: 'Habits' },
  smaller_opened: { label: 'Smaller step opened', group: 'Habits' },
  smaller_chosen: { label: 'Smaller step chosen', group: 'Habits' },
  skip_today: { label: 'Skipped today', group: 'Habits' },
  activity_paused: { label: 'Habit paused', group: 'Habits' },
  rest_day: { label: 'Rest day', group: 'Habits' },
  comeback: { label: 'Comebacks', group: 'Habits' },

  metric_created: { label: 'Vitals created', group: 'Vitals' },

  shared_event_created: { label: 'Shared events made', group: 'Sharing' },
  shared_event_shared: { label: 'Shared event sent', group: 'Sharing' },
  shared_event_viewed: { label: 'Shared event link opened', group: 'Sharing' },
  shared_event_added: { label: 'Shared event added', group: 'Sharing' },
  shared_event_installed: { label: 'App installed from a shared link', group: 'Sharing' },
  shared_event_reset: { label: 'Shared link reset', group: 'Sharing' },
  shared_event_cancelled: { label: 'Shared event cancelled', group: 'Sharing' },
  shared_event_reported: { label: 'Shared event reported', group: 'Sharing' },

  landing_viewed: { label: 'Landing page viewed', group: 'Sign-up and setup' },
  signin_clicked: { label: 'Sign-in tapped', group: 'Sign-up and setup' },
  get_started_clicked: { label: 'Get started tapped', group: 'Sign-up and setup' },
  signin_reveal_clicked: { label: 'Sign-in options opened', group: 'Sign-up and setup' },
  signin_method_clicked: { label: 'Sign-in method chosen', group: 'Sign-up and setup' },
  signin_shown: { label: 'Sign-in shown', group: 'Sign-up and setup' },
  signup_completed: { label: 'Sign-ups', group: 'Sign-up and setup' },
  intent_journey_started: { label: 'Intent questions started', group: 'Sign-up and setup' },
  intent_step_answered: { label: 'Intent question answered', group: 'Sign-up and setup' },
  intent_journey_completed: { label: 'Intent questions finished', group: 'Sign-up and setup' },
  intent_journey_skipped: { label: 'Intent questions skipped', group: 'Sign-up and setup' },
  onboarding_started: { label: 'Setup started', group: 'Sign-up and setup' },
  onboarding_step_completed: { label: 'Setup step finished', group: 'Sign-up and setup' },
  onboarding_timer_started: { label: 'Setup timer started', group: 'Sign-up and setup' },
  onboarding_timer_completed: { label: 'Setup timer finished', group: 'Sign-up and setup' },
  onboarding_timer_skipped: { label: 'Setup timer skipped', group: 'Sign-up and setup' },

  insights_viewed: { label: 'Insights viewed', group: 'Reviews and insights' },
  review_generated: { label: 'Weekly review made', group: 'Reviews and insights' },
  review_opened: { label: 'Weekly review opened', group: 'Reviews and insights' },
  review_focus_set: { label: 'Review focus set', group: 'Reviews and insights' },
  review_shrink_used: { label: 'Review: made it smaller', group: 'Reviews and insights' },
  pattern_shown: { label: 'Pattern shown', group: 'Reviews and insights' },
  pattern_tapped: { label: 'Pattern tapped', group: 'Reviews and insights' },
  welcome_back_shown: { label: 'Welcome back shown', group: 'Reviews and insights' },
  welcome_back_started: { label: 'Welcome back: started', group: 'Reviews and insights' },
  welcome_back_dismissed: { label: 'Welcome back dismissed', group: 'Reviews and insights' },
  fresh_start_used: { label: 'Fresh start used', group: 'Reviews and insights' },

  video_played: { label: 'Videos played', group: 'Features and permissions' },
  health_permission: { label: 'Health Connect asked', group: 'Features and permissions' },
  language_changed: { label: 'Language chosen or changed', group: 'Features and permissions' },
  alerts_status: { label: 'Alerts check (daily)', group: 'Features and permissions' },

  app_opened: { label: 'App opened', group: 'App' },
  get_app_clicked: { label: 'Get the app tapped', group: 'App' },
  install_attributed: { label: 'Install source recorded', group: 'App' },

  app_error: { label: 'App errors', group: 'Errors' },
}

/** A friendly name and group. A name the screen does not know shows as itself under Other. */
export function eventInfo(name: string): EventInfo {
  return EVENT_INFO[name] ?? { label: name, group: 'Other' }
}

/**
 * The properties worth splitting an event by on the screen. Each one is a short word or a
 * yes/no sent with the event; none of them is free text.
 */
export const EVENT_BREAKDOWNS: Record<string, readonly string[]> = {
  reminder_added: ['kind', 'repeat', 'has_time', 'day_before', 'community', 'photo', 'signed_in'],
  reminder_done: ['from', 'repeat', 'signed_in'],
  activity_created: ['template_id'],
  metric_created: ['template_id'],
  shared_event_created: ['kind', 'photo', 'has_time'],
  shared_event_viewed: ['status'],
  video_played: ['video', 'speed', 'by'],
  health_permission: ['kind', 'result'],
  language_changed: ['to', 'from', 'first'],
  alerts_status: ['notifications', 'exact_alarms', 'planned'],
  install_attributed: ['source', 'medium', 'content'],
  app_opened: ['locale'],
  get_app_clicked: ['where'],
  signin_method_clicked: ['method'],
  app_error: ['kind', 'file'],
  log_created: ['kind', 'activity_type'],
}

/** Plain names for the "Split by" chips. A missing one is shown with spaces instead of underscores. */
export const PROP_LABELS: Record<string, string> = {
  kind: 'Type',
  repeat: 'Repeats',
  has_time: 'Has a time',
  day_before: 'Day-before alert',
  community: 'From the community list',
  photo: 'Has a photo',
  signed_in: 'Signed in',
  from: 'How it was marked done',
  template_id: 'Which one',
  status: 'Status',
  video: 'Which video',
  speed: 'Speed',
  by: 'Started by',
  result: 'What they answered',
  to: 'Language they chose',
  first: 'First choice?',
  notifications: 'Notifications',
  exact_alarms: 'Alarms & reminders',
  planned: 'Alerts planned',
  source: 'Where from',
  medium: 'Link type',
  content: 'Which button',
  locale: 'Language',
  where: 'Where they tapped',
  method: 'Sign-in method',
  file: 'Which file or request',
  activity_type: 'Habit type',
}

export function propLabel(prop: string): string {
  return PROP_LABELS[prop] ?? prop.replace(/_/g, ' ')
}

export interface PropBreakdown {
  name: string
  prop: string
  rows: Array<CountRow & { devices: number }>
}

export function parsePropBreakdown(data: unknown): PropBreakdown {
  const row = asRecord(data)
  return {
    name: typeof row.name === 'string' ? row.name : '',
    prop: typeof row.prop === 'string' ? row.prop : '',
    rows: asList(row.rows)
      .filter((entry) => typeof entry.key === 'string')
      .map((entry) => ({ key: entry.key as string, count: asCount(entry.count), devices: asCount(entry.devices) })),
  }
}

export async function fetchPropBreakdown(name: string, prop: string, days: number): Promise<PropBreakdown> {
  const { data, error } = await createSupabaseClient().rpc('event_prop_breakdown', {
    p_name: name,
    p_prop: prop,
    p_days: days,
  })
  if (error) {
    if (error.code === '42883' || error.message.includes('event_prop_breakdown')) {
      throw new Error(missingFunctionMessage('event_prop_breakdown'))
    }
    throw error
  }
  return parsePropBreakdown(data)
}

/** The events that are worth a chart straight away. */
export const FEATURED_EVENTS = ['reminder_added', 'reminder_done', 'log_created', 'app_opened'] as const

export interface CountRow {
  key: string
  count: number
}

function countRows(value: unknown): CountRow[] {
  return asList(value)
    .filter((entry) => typeof entry.key === 'string')
    .map((entry) => ({ key: entry.key as string, count: asCount(entry.count) }))
}

function dayRows(value: unknown): Array<{ day: string; count: number }> {
  return asList(value)
    .map((entry) => ({ day: dayString(entry.day) ?? '', count: asCount(entry.count) }))
    .filter((entry) => entry.day !== '')
}

export interface AppInstalls {
  since: string
  /** Android devices whose first app open fell inside the window. */
  firstOpens: number
  firstOpensByVersion: CountRow[]
  firstOpensByLanguage: CountRow[]
  /** Where new installs came from, such as "resuming.me · landing". "unknown" has no recorded source. */
  firstOpensBySource: CountRow[]
  firstOpensPerDay: Array<{ day: string; count: number }>
  /** Android devices that opened the app inside the window. */
  activeDevices: number
  activeByVersion: CountRow[]
  activeByLanguage: CountRow[]
  webDevices: number
  webByLanguage: CountRow[]
  /** The first day any open carried a language. Null until a build that sends it is in use. */
  languageKnownSince: string | null
  /** The first day an install carried its source. Null until a build that sends it is in use. */
  sourceKnownSince: string | null
}

export function parseAppInstalls(data: unknown): AppInstalls {
  const row = asRecord(data)
  return {
    since: dayString(row.since) ?? '',
    firstOpens: asCount(row.firstOpens),
    firstOpensByVersion: countRows(row.firstOpensByVersion),
    firstOpensByLanguage: countRows(row.firstOpensByLanguage),
    firstOpensBySource: countRows(row.firstOpensBySource),
    firstOpensPerDay: dayRows(row.firstOpensPerDay),
    activeDevices: asCount(row.activeDevices),
    activeByVersion: countRows(row.activeByVersion),
    activeByLanguage: countRows(row.activeByLanguage),
    webDevices: asCount(row.webDevices),
    webByLanguage: countRows(row.webByLanguage),
    languageKnownSince: dayString(row.languageKnownSince),
    sourceKnownSince: dayString(row.sourceKnownSince),
  }
}

export interface AlertStatus {
  /** Android devices that reported in the window, by their latest report. */
  devices: number
  /** Notifications allowed, and exact alarms not switched off. */
  ready: number
  notificationsOff: number
  /** Notifications allowed but "Alarms & reminders" is off, so alerts may arrive late. */
  exactAlarmsOff: number
  states: Array<{ notifications: string; exactAlarms: string; count: number }>
  knownSince: string | null
}

export function parseAlertStatus(data: unknown): AlertStatus {
  const row = asRecord(data)
  return {
    devices: asCount(row.devices),
    ready: asCount(row.ready),
    notificationsOff: asCount(row.notificationsOff),
    exactAlarmsOff: asCount(row.exactAlarmsOff),
    states: asList(row.states).map((entry) => ({
      notifications: typeof entry.notifications === 'string' ? entry.notifications : 'unknown',
      exactAlarms: typeof entry.exactAlarms === 'string' ? entry.exactAlarms : 'unknown',
      count: asCount(entry.count),
    })),
    knownSince: dayString(row.knownSince),
  }
}

export async function fetchAlertStatus(days: number): Promise<AlertStatus> {
  return parseAlertStatus(await fetchAnalyticsSummary('alert_status_summary', days))
}

export type RetentionPlatform = 'android' | 'web' | 'all'

/** How many devices were measured, and how many of them were back. */
export interface RetentionRate {
  back: number
  eligible: number
}

export interface RetentionGroup {
  /** Devices that started in this cohort, measured or not. */
  size: number
  /** Back exactly the next day. */
  d1: RetentionRate
  /** Back on any of the 7 days after the first day. */
  w1: RetentionRate
  /** Back exactly 7 days after the first day. */
  d7: RetentionRate
  /** Back exactly 30 days after the first day. */
  d30: RetentionRate
}

export interface GuestRetention {
  platform: RetentionPlatform
  weeks: Array<{ weekStart: string; guest: RetentionGroup; account: RetentionGroup }>
  headline: { guest: RetentionGroup; account: RetentionGroup }
}

function retentionGroup(value: unknown): RetentionGroup {
  const row = asRecord(value)
  const rate = (back: unknown, eligible: unknown): RetentionRate => ({
    back: asCount(back),
    eligible: asCount(eligible),
  })
  return {
    size: asCount(row.size),
    d1: rate(row.r1, row.e1),
    w1: rate(row.rw1, row.e7),
    d7: rate(row.r7, row.e7),
    d30: rate(row.r30, row.e30),
  }
}

export function parseGuestRetention(data: unknown): GuestRetention {
  const row = asRecord(data)
  const headline = asRecord(row.headline)
  return {
    platform: row.platform === 'web' || row.platform === 'all' ? row.platform : 'android',
    weeks: asList(row.weeks)
      .map((entry) => ({
        weekStart: dayString(entry.weekStart) ?? '',
        guest: retentionGroup(entry.guest),
        account: retentionGroup(entry.account),
      }))
      .filter((entry) => entry.weekStart !== ''),
    headline: { guest: retentionGroup(headline.guest), account: retentionGroup(headline.account) },
  }
}

/** "34%" of the devices that could be measured, or null when none could yet. */
export function retentionPercent(rate: RetentionRate): string | null {
  if (rate.eligible === 0) return null
  return `${Math.round((100 * rate.back) / rate.eligible)}%`
}

export const RETENTION_WEEKS = 12

export async function fetchGuestRetention(platform: RetentionPlatform): Promise<GuestRetention> {
  const { data, error } = await createSupabaseClient().rpc('guest_retention_summary', {
    p_weeks: RETENTION_WEEKS,
    p_platform: platform,
  })
  if (error) {
    if (error.code === '42883' || error.message.includes('guest_retention_summary')) {
      throw new Error(missingFunctionMessage('guest_retention_summary'))
    }
    throw error
  }
  return parseGuestRetention(data)
}

const SOURCE_NAMES: Record<string, string> = {
  unknown: 'Not recorded (older build)',
  direct: 'Direct or search in Play',
  shared_event: 'Shared event link',
}

/** "resuming.me · landing" stays as it is; the words we made up get a plain name. */
export function sourceName(key: string): string {
  return SOURCE_NAMES[key] ?? key
}

export async function fetchAppInstalls(days: number): Promise<AppInstalls> {
  return parseAppInstalls(await fetchAnalyticsSummary('app_installs_summary', days))
}

export interface AppErrors {
  total: number
  devices: number
  activeDevices: number
  byVersion: Array<{ platform: string; version: string; count: number; devices: number }>
  top: Array<{
    message: string
    kind: string
    count: number
    devices: number
    lastSeen: string | null
    version: string | null
    file: string | null
    line: number | null
  }>
  perDay: Array<{ day: string; count: number }>
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null
}

export function parseAppErrors(data: unknown): AppErrors {
  const row = asRecord(data)
  return {
    total: asCount(row.total),
    devices: asCount(row.devices),
    activeDevices: asCount(row.activeDevices),
    byVersion: asList(row.byVersion).map((entry) => ({
      platform: text(entry.platform) ?? 'unknown',
      version: text(entry.version) ?? 'unknown',
      count: asCount(entry.count),
      devices: asCount(entry.devices),
    })),
    top: asList(row.top).map((entry) => {
      const line = Number(entry.line)
      return {
        message: text(entry.message) ?? '(no message)',
        kind: text(entry.kind) ?? 'error',
        count: asCount(entry.count),
        devices: asCount(entry.devices),
        lastSeen: text(entry.lastSeen),
        version: text(entry.version),
        file: text(entry.file),
        line: Number.isFinite(line) && line > 0 ? line : null,
      }
    }),
    perDay: dayRows(row.perDay),
  }
}

export async function fetchAppErrors(days: number): Promise<AppErrors> {
  return parseAppErrors(await fetchAnalyticsSummary('app_errors_summary', days))
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  gu: 'Gujarati',
  mr: 'Marathi',
  te: 'Telugu',
  ta: 'Tamil',
  bn: 'Bengali',
  unknown: 'Not known yet',
}

export function languageName(key: string): string {
  return LANGUAGE_NAMES[key] ?? key
}
