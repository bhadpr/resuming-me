import { addDays, daysBetween, parseLocalDate, todayLocalDate } from './dates'
import { localeTag, type Locale } from './i18n'
import { effectiveReminder, repeatDoneOn, repeatIssue, type ReminderRepeat } from './reminderRepeat'

export const REMINDER_TEXT_MAX = 120
export const REMINDER_DESCRIPTION_MAX = 500
export const REMINDER_OPEN_MAX = 200
/** Done reminders older than this are not loaded. Today only needs today's. */
export const REMINDER_DONE_KEEP_MS = 36 * 60 * 60 * 1000

/** Extra alerts offered when a reminder has a clock time. */
export const REMIND_LEAD_MINUTES = [15, 30, 60] as const
export type RemindLeadMinutes = (typeof REMIND_LEAD_MINUTES)[number]

export function remindLeadMinutesOf(value: unknown): RemindLeadMinutes | null {
  return value === 15 || value === 30 || value === 60 ? value : null
}

/** The early ping, only while the reminder has a clock time. */
export function remindLeadFor(input: {
  hour: number | null
  remindLeadMinutes?: unknown
}): RemindLeadMinutes | null {
  if (input.hour == null) return null
  return remindLeadMinutesOf(input.remindLeadMinutes)
}

/** The early ping already chosen for one followed schedule, so a new game uses it too. */
export function listLeadMinutes(
  reminders: readonly Pick<Reminder, 'sharedListId' | 'hour' | 'remindLeadMinutes'>[],
  listId: string,
): RemindLeadMinutes | null {
  for (const item of reminders) {
    if (item.sharedListId !== listId) continue
    const lead = remindLeadFor(item)
    if (lead) return lead
  }
  return null
}

export interface Reminder {
  id: string
  text: string
  /** Plain text, shown as written. Links are not made clickable. */
  description?: string | null
  /** Signed in: the private photo in storage. */
  photoPath?: string | null
  /** Signed in: a short-lived address for photoPath, filled in on load. */
  photoUrl?: string | null
  /** Guest: a small photo kept on the device as a data URL. */
  photoData?: string | null
  /** YYYY-MM-DD, local. */
  day: string
  /** Both null means any time that day. */
  hour: number | null
  minute: number | null
  /** An evening alert on the day before. */
  remindBefore: boolean
  /** An evening alert a week before. */
  remindWeekBefore?: boolean
  /** An extra alert this many minutes before the clock time. Null means only at the time. */
  remindLeadMinutes?: RemindLeadMinutes | null
  kind: ReminderKind
  /** Done makes next year's copy. */
  everyYear: boolean
  /** Comes back every day or every week until repeatUntil. Not with everyYear, and never shared. */
  repeat?: ReminderRepeat | null
  /** Last day it comes back. At most two months after repeatFrom. */
  repeatUntil?: string | null
  /** The first day of the repeat. The two-month limit counts from here. */
  repeatFrom?: string | null
  /** The day the current repeat was last marked done. Today shows it as done until tomorrow. */
  lastDoneOn?: string | null
  doneAt: string | null
  /** Set on the organizer's reminder and on every copy of a shared event. A regular share is not edited. A meetup still is. */
  sharedEventId?: string | null
  /** The community reminder this was picked from, so the list can show it as added. */
  communityId?: string | null
  /** The shared-list item this was accepted from, so it is not added twice. */
  sharedListItemId?: string | null
  /** The calendar this copy still follows. The calendar keeps the name and date. */
  sharedListId?: string | null
  /** The list's one picture, such as a school logo, learned from that item. */
  listPhotoPath?: string | null
  /** That community reminder's picture, kept on this reminder after it is picked. */
  communityPhotoPath?: string | null
  /** The person turned this reminder's alerts off. It still shows on Today. */
  alertOff?: boolean
  /** The shared event's status, learned on load. Missing means active or not known yet. */
  sharedStatus?: SharedReminderStatus
  /** The shared event's photo in storage, learned with its status. Null once the event is switched off. */
  sharedPhotoPath?: string | null
  /** This account made the shared event, so it can share it again. Copies from others are false. */
  sharedByMe?: boolean
  /** A meetup the organizer can still change. Accepted phones follow the new day and time. */
  meetup?: boolean
}

export type SharedReminderStatus = 'active' | 'cancelled' | 'switched_off'

/** A day copied from a reminder list. The list keeps its name and date. */
export function isFollowedListReminder(
  reminder: Pick<Reminder, 'sharedListItemId' | 'sharedListId'>,
): boolean {
  return Boolean(reminder.sharedListItemId || reminder.sharedListId)
}

const HOLIDAY_LIST_IDS = new Set([
  'a11ce001-0000-4111-8001-000000000001',
  'a11ce002-0000-4111-8001-000000000002',
])

/** How a reminder should be marked on the list. A personal one stays unmarked. */
export function reminderListKind(
  reminder: Pick<Reminder, 'meetup' | 'communityId' | 'sharedListItemId' | 'sharedListId'>,
): 'meetup' | 'holiday' | 'schedule' | null {
  if (reminder.meetup) return 'meetup'
  if (reminder.communityId || (reminder.sharedListId && HOLIDAY_LIST_IDS.has(reminder.sharedListId))) return 'holiday'
  if (isFollowedListReminder(reminder)) return 'schedule'
  return null
}

/** A copy whose event the organizer cancelled or the admin switched off. */
export function isSharedEventGone(reminder: Pick<Reminder, 'sharedStatus'>): boolean {
  return reminder.sharedStatus === 'cancelled' || reminder.sharedStatus === 'switched_off'
}

/** Whether the reminder may still alert. Done, silenced and cancelled reminders do not. */
export function reminderAlerts(reminder: Reminder): boolean {
  return !reminder.doneAt && !reminder.alertOff && !isSharedEventGone(reminder)
}

/** A photo picked on the form: a full one for the account, a small one for a guest's device. */
export interface ReminderPhoto {
  blob: Blob
  dataUrl: string
}

export interface ReminderInput {
  text: string
  description?: string | null
  /** A new photo, or null to remove it. Missing leaves it as it is. */
  photo?: ReminderPhoto | null
  /** An existing photo carried to a copy, such as next year's. */
  photoPath?: string | null
  photoData?: string | null
  day: string
  hour: number | null
  minute: number | null
  remindBefore?: boolean
  remindWeekBefore?: boolean
  remindLeadMinutes?: RemindLeadMinutes | null
  kind?: ReminderKind
  everyYear?: boolean
  repeat?: ReminderRepeat | null
  repeatUntil?: string | null
  repeatFrom?: string | null
  lastDoneOn?: string | null
  sharedEventId?: string | null
  communityId?: string | null
  communityPhotoPath?: string | null
  sharedListItemId?: string | null
  sharedListId?: string | null
  listPhotoPath?: string | null
  alertOff?: boolean
  /** A meetup. The organizer can change the day, and accepted phones follow it. */
  meetup?: boolean
}

/** Only changes the icon. A reminder with no kind chosen is Other. */
export const REMINDER_KINDS = ['errand', 'bill', 'doctor', 'event', 'other'] as const
export type ReminderKind = (typeof REMINDER_KINDS)[number]

export function reminderKindOf(value: unknown): ReminderKind {
  return REMINDER_KINDS.includes(value as ReminderKind) ? (value as ReminderKind) : 'other'
}

/** Same date next year. 29 February becomes 28 February. */
export function nextYearDay(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  const last = new Date(year + 1, month, 0).getDate()
  return `${year + 1}-${String(month).padStart(2, '0')}-${String(Math.min(date, last)).padStart(2, '0')}`
}

/** The open copy that appears when an every-year reminder is done. */
export function nextYearCopy(reminder: Reminder): ReminderInput {
  return {
    text: reminder.text,
    description: reminder.description ?? null,
    ...(reminder.photoPath ? { photoPath: reminder.photoPath } : {}),
    ...(reminder.photoData ? { photoData: reminder.photoData } : {}),
    day: nextYearDay(reminder.day),
    hour: reminder.hour,
    minute: reminder.minute,
    remindBefore: reminder.remindBefore,
    ...(reminder.remindWeekBefore ? { remindWeekBefore: true } : {}),
    ...(remindLeadFor(reminder) ? { remindLeadMinutes: remindLeadFor(reminder) } : {}),
    kind: reminder.kind,
    everyYear: true,
  }
}

/** Whether a reminder is the copy made when this every-year reminder was done. */
export function isNextYearCopyOf(candidate: Reminder, reminder: Reminder): boolean {
  return (
    candidate.id !== reminder.id &&
    candidate.everyYear &&
    !candidate.doneAt &&
    candidate.text === reminder.text &&
    candidate.day === nextYearDay(reminder.day)
  )
}

export type ReminderIssue = 'text' | 'day' | 'repeat' | 'full'

export const REMINDER_PARTS = ['morning', 'afternoon', 'evening'] as const
export type ReminderPart = (typeof REMINDER_PARTS)[number]
export type PartTimes = Record<ReminderPart, { hour: number; minute: number }>

export const DEFAULT_PART_TIMES: PartTimes = {
  morning: { hour: 9, minute: 0 },
  afternoon: { hour: 14, minute: 0 },
  evening: { hour: 18, minute: 0 },
}

export const PART_TIMES_STORAGE_KEY = 'resuming-reminder-part-times'
/** Fired when reminders or their alerts change outside React, such as from a notification button. */
export const REMINDERS_CHANGED = 'resuming-reminders-changed'

export function announceRemindersChanged(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(REMINDERS_CHANGED))
}

export function cleanReminderText(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, REMINDER_TEXT_MAX)
}

/** Keeps line breaks, at most one blank line in a row. Null when empty. */
export function cleanReminderDescription(text: string | null | undefined): string | null {
  if (typeof text !== 'string') return null
  const cleaned = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, REMINDER_DESCRIPTION_MAX)
    .trim()
  return cleaned || null
}

export function isDay(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
}

/** Values passed in router state as { reminderPrefill }, as Cancel and make a new one does. */
export function reminderPrefillFrom(state: unknown): ReminderInput | undefined {
  const value = (state as { reminderPrefill?: unknown } | null)?.reminderPrefill as Partial<ReminderInput> | undefined
  if (!value || typeof value.text !== 'string' || !isDay(value.day)) return undefined
  const timed = Number.isInteger(value.hour) && Number.isInteger(value.minute)
  return {
    text: value.text,
    description: cleanReminderDescription(value.description),
    day: value.day,
    hour: timed ? value.hour! : null,
    minute: timed ? value.minute! : null,
    remindBefore: value.remindBefore === true,
    ...(value.remindWeekBefore === true ? { remindWeekBefore: true } : {}),
    ...(remindLeadFor({ hour: timed ? value.hour! : null, remindLeadMinutes: value.remindLeadMinutes })
      ? { remindLeadMinutes: remindLeadFor({ hour: timed ? value.hour! : null, remindLeadMinutes: value.remindLeadMinutes }) }
      : {}),
    kind: reminderKindOf(value.kind),
  }
}

/** Router state { reminderShare: true }: the list's Share opens the reminder at its share section. */
export function reminderShareRequested(state: unknown): boolean {
  return (state as { reminderShare?: unknown } | null)?.reminderShare === true
}

export function validateReminder(input: ReminderInput): ReminderIssue | null {
  if (!cleanReminderText(input.text)) return 'text'
  if (!isDay(input.day)) return 'day'
  if (repeatIssue(input)) return 'repeat'
  return null
}

/** Local day a done time falls on. */
export function doneDay(reminder: Pick<Reminder, 'doneAt'>): string | null {
  if (!reminder.doneAt) return null
  const at = new Date(reminder.doneAt)
  return Number.isNaN(at.getTime()) ? null : todayLocalDate(at)
}

function byDayThenTime(a: Reminder, b: Reminder): number {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1
  if (a.hour == null && b.hour == null) return 0
  if (a.hour == null) return 1
  if (b.hour == null) return -1
  return a.hour - b.hour || (a.minute ?? 0) - (b.minute ?? 0)
}

/** A meetup, a holiday, or a community calendar day. Once that day passes, it is gone. */
export function reminderExpires(
  reminder: Pick<Reminder, 'meetup' | 'communityId' | 'sharedListItemId' | 'sharedListId'>,
): boolean {
  return reminderListKind(reminder) != null
}

/**
 * The reminder as it should be shown today.
 * A meetup, holiday, or community day keeps its date, so a past one can be dropped.
 * A personal reminder that was not marked done moves onto today.
 */
function shownReminder<T extends Reminder>(reminder: T, today: string): T {
  const current = effectiveReminder(reminder, today)
  if (current.doneAt || current.day >= today || reminderExpires(current) || isSharedEventGone(current)) {
    return current
  }
  return { ...current, day: today }
}

/** Open reminders for today. A past meetup, holiday, or community day is left out. */
export function remindersForToday(list: readonly Reminder[], today: string): Reminder[] {
  return list
    .map((item) => shownReminder(item, today))
    .filter((item) => !item.doneAt && item.day === today)
    .sort(byDayThenTime)
}

/** Reminders marked done today, newest first. */
export function remindersDoneToday(list: readonly Reminder[], today: string): Reminder[] {
  return list
    .map((item) => shownReminder(item, today))
    .filter((item) => doneDay(item) === today || (!item.doneAt && repeatDoneOn(item, today)))
    .sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
}

/** Open reminders after today, by date. */
export function remindersComingUp(list: readonly Reminder[], today: string): Reminder[] {
  return list
    .map((item) => shownReminder(item, today))
    .filter((item) => !item.doneAt && item.day > today)
    .sort(byDayThenTime)
}

/** Open reminders that still take a slot. A meetup, holiday, or community day that has passed does not. */
export function openReminderCount(list: readonly Reminder[], today = todayLocalDate()): number {
  return list.filter((item) => {
    const current = effectiveReminder(item, today)
    if (current.doneAt) return false
    return !(reminderExpires(current) && current.day < today)
  }).length
}

export function tomorrowOf(today: string): string {
  return addDays(today, 1)
}

function isClock(value: unknown): value is { hour: number; minute: number } {
  if (!value || typeof value !== 'object') return false
  const { hour, minute } = value as { hour: unknown; minute: unknown }
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    (hour as number) >= 0 &&
    (hour as number) <= 23 &&
    (minute as number) >= 0 &&
    (minute as number) <= 59
  )
}

/** Morning, afternoon, and evening times on this device. */
export function readPartTimes(): PartTimes {
  try {
    const raw = localStorage.getItem(PART_TIMES_STORAGE_KEY)
    if (!raw) return DEFAULT_PART_TIMES
    const parsed = JSON.parse(raw) as Partial<Record<ReminderPart, unknown>>
    const next = { ...DEFAULT_PART_TIMES }
    for (const part of REMINDER_PARTS) {
      const value = parsed[part]
      if (isClock(value)) next[part] = { hour: value.hour, minute: value.minute }
    }
    return next
  } catch {
    return DEFAULT_PART_TIMES
  }
}

export function savePartTimes(times: PartTimes): void {
  try {
    localStorage.setItem(PART_TIMES_STORAGE_KEY, JSON.stringify(times))
  } catch {
    /* ignore */
  }
  announceRemindersChanged()
}

/** Which time chip a saved reminder belongs to. */
export function partOfTime(
  hour: number | null,
  minute: number | null,
  parts: PartTimes,
): ReminderPart | 'any' | 'pick' {
  if (hour == null || minute == null) return 'any'
  const match = REMINDER_PARTS.find((part) => parts[part].hour === hour && parts[part].minute === minute)
  return match ?? 'pick'
}

export function formatReminderTime(hour: number, minute: number, locale: Locale): string {
  const date = new Date(2024, 0, 7, hour, minute)
  return date.toLocaleTimeString(localeTag(locale), { hour: 'numeric', minute: '2-digit' })
}

/** "9 am" on the hour, "9:30 am" otherwise. */
export function formatShortReminderTime(hour: number, minute: number, locale: Locale): string {
  const date = new Date(2024, 0, 7, hour, minute)
  return date.toLocaleTimeString(
    localeTag(locale),
    minute === 0 ? { hour: 'numeric' } : { hour: 'numeric', minute: '2-digit' },
  )
}

/** Weekday name within the past or coming week, otherwise a short date. */
export function formatReminderDay(day: string, today: string, locale: Locale): string {
  const date = parseLocalDate(day)
  const gap = Math.abs(daysBetween(today, day))
  if (gap <= 6) return date.toLocaleDateString(localeTag(locale), { weekday: 'long' })
  return date.toLocaleDateString(localeTag(locale), { weekday: 'short', day: 'numeric', month: 'short' })
}
