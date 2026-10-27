import { todayLocalDate } from './dates'
import { isEventPhotoPath, isReminderPhotoData } from './eventPhotoUrl'
import {
  completeOccurrence,
  effectiveReminder,
  isReminderRepeat,
  isRepeating,
  reopenOccurrence,
} from './reminderRepeat'
import {
  dataUrlToBlob,
  rememberReminderPhoto,
  removeReminderPhotoIfUnused,
  uploadReminderPhoto,
  withReminderPhotoUrls,
} from './reminderPhotos'
import { planMeetupRefresh, type MeetupSource } from './meetupSync'
import { withListPhotos } from './sharedLists'
import { createSupabaseClient } from './supabase'
import {
  REMINDER_DONE_KEEP_MS,
  cleanReminderDescription,
  cleanReminderText,
  nextYearCopy,
  nextYearDay,
  reminderKindOf,
  type Reminder,
  type ReminderInput,
} from './reminderSchedule'
import type { Database } from '../types/database'

type ReminderRow = Database['public']['Tables']['reminders']['Row']

/** Thrown when the account already has the most open reminders allowed. */
export class ReminderCapError extends Error {
  constructor() {
    super('reminders_open_cap')
    this.name = 'ReminderCapError'
  }
}

function fromRow(row: ReminderRow): Reminder {
  return {
    id: row.id,
    text: row.text,
    description: row.description ?? null,
    photoPath: row.photo_path ?? null,
    day: row.day,
    hour: row.hour,
    minute: row.minute,
    remindBefore: row.remind_before ?? false,
    remindWeekBefore: row.remind_week_before ?? false,
    kind: reminderKindOf(row.kind),
    everyYear: row.every_year ?? false,
    repeat: isReminderRepeat(row.repeat_every) ? row.repeat_every : null,
    repeatUntil: row.repeat_until ?? null,
    repeatFrom: row.repeat_from ?? null,
    lastDoneOn: row.last_done_on ?? null,
    doneAt: row.done_at,
    sharedEventId: row.shared_event_id ?? null,
    sharedListItemId: row.shared_list_item_id ?? null,
    sharedListId: row.shared_list_id ?? null,
    communityId: row.community_id ?? null,
    communityPhotoPath: isEventPhotoPath(row.community_photo_path) ? row.community_photo_path : null,
    alertOff: row.alert_off ?? false,
  }
}

/** The ones among these shared events that this account made. */
async function ownedSharedEventIds(ids: string[]): Promise<Set<string>> {
  const client = createSupabaseClient()
  const { data: auth } = await client.auth.getSession()
  const userId = auth.session?.user.id
  if (!userId) return new Set()
  const { data, error } = await client.from('shared_events').select('id').eq('owner_id', userId).in('id', ids)
  if (error) return new Set()
  return new Set((data ?? []).map((row) => row.id))
}

function meetupSource(row: {
  id: string
  status: string
  photo_path: string | null
  meetup: boolean
  text: string | null
  description: string | null
  day: string
  hour: number | null
  minute: number | null
  time_zone: string
  remind_before: boolean
  kind: string
}): MeetupSource {
  const status = row.status === 'cancelled' || row.status === 'switched_off' ? row.status : 'active'
  return {
    id: row.id,
    meetup: row.meetup === true,
    text: row.text,
    description: row.description ?? null,
    day: row.day.slice(0, 10),
    hour: row.hour,
    minute: row.minute,
    timeZone: row.time_zone,
    remindBefore: row.remind_before === true,
    photoPath: isEventPhotoPath(row.photo_path) ? row.photo_path : null,
    kind: reminderKindOf(row.kind),
    status,
  }
}

/** Writes meetup changes onto this account's copies. Done and alert off stay as they are. */
async function persistMeetupUpdates(updates: ReturnType<typeof planMeetupRefresh>): Promise<void> {
  if (updates.length === 0) return
  const client = createSupabaseClient()
  const { data: auth } = await client.auth.getSession()
  if (!auth.session) return
  for (const update of updates) {
    const { error } = await client
      .from('reminders')
      .update({
        text: update.text,
        description: update.description,
        day: update.day,
        hour: update.hour,
        minute: update.minute,
        remind_before: update.remindBefore,
        kind: update.kind,
      })
      .eq('id', update.reminderId)
    if (error) return
  }
}

/** Fills in each shared reminder's event status and whether this account made it. Offline, the list comes back as it was. */
export async function withSharedStatuses<T extends Reminder>(list: readonly T[]): Promise<T[]> {
  const ids = [...new Set(list.map((item) => item.sharedEventId).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return [...list]
  try {
    const client = createSupabaseClient()
    const [{ data, error }, owned] = await Promise.all([
      client.rpc('shared_event_statuses', { p_ids: ids }),
      ownedSharedEventIds(ids).catch(() => new Set<string>()),
    ])
    const rows = new Map(error ? [] : (data ?? []).map((row) => [row.id, row]))
    const withStatus = list.map((item) => {
      if (!item.sharedEventId) return item
      const row = rows.get(item.sharedEventId)
      const next = row?.status
      const known = next === 'active' || next === 'cancelled' || next === 'switched_off'
      return {
        ...item,
        ...(known ? { sharedStatus: next } : {}),
        ...(row ? { sharedPhotoPath: isEventPhotoPath(row.photo_path) ? row.photo_path : null } : {}),
        ...(row ? { meetup: row.meetup === true } : {}),
        sharedByMe: owned.has(item.sharedEventId),
      }
    })
    const sources = [...rows.values()].filter((row) => row.meetup).map(meetupSource)
    const updates = planMeetupRefresh(withStatus, sources)
    if (updates.length === 0) return withStatus
    await persistMeetupUpdates(updates).catch(() => {})
    const byId = new Map(updates.map((update) => [update.reminderId, update]))
    return withStatus.map((item) => {
      const update = byId.get(item.id)
      if (!update) return item
      return {
        ...item,
        text: update.text,
        description: update.description,
        day: update.day,
        hour: update.hour,
        minute: update.minute,
        remindBefore: update.remindBefore,
        kind: update.kind,
        sharedPhotoPath: update.sharedPhotoPath,
      }
    })
  } catch {
    return [...list]
  }
}

/** The repeat columns for a save. They are all set together, or all cleared. */
function repeatColumns(input: ReminderInput): {
  repeat_every: string | null
  repeat_until: string | null
  repeat_from: string | null
  last_done_on: string | null
} {
  if (!isReminderRepeat(input.repeat) || !input.repeatUntil) {
    return { repeat_every: null, repeat_until: null, repeat_from: null, last_done_on: null }
  }
  return {
    repeat_every: input.repeat,
    repeat_until: input.repeatUntil,
    repeat_from: input.repeatFrom ?? input.day,
    last_done_on: input.lastDoneOn ?? null,
  }
}

function capError(error: { code?: string; message?: string }): boolean {
  return error.code === 'P0001' && (error.message ?? '').includes('reminders_open_cap')
}

/** Open reminders, plus the ones done in the last day and a half. */
export async function listReminders(now = new Date()): Promise<Reminder[]> {
  const client = createSupabaseClient()
  const since = new Date(now.getTime() - REMINDER_DONE_KEEP_MS).toISOString()
  const { data, error } = await client
    .from('reminders')
    .select('*')
    .or(`done_at.is.null,done_at.gte.${since}`)
    .order('day', { ascending: true })
  if (error) throw error
  const list = settleEndedRepeats((data ?? []).map(fromRow), now)
  return withListPhotos(await withReminderPhotoUrls(await withSharedStatuses(list)))
}

/**
 * A repeat whose end date has passed is done. Mark it so, so it stops counting toward the open limit.
 * The write is not awaited; the list is right either way.
 */
function settleEndedRepeats(list: Reminder[], now: Date): Reminder[] {
  const today = todayLocalDate(now)
  return list.map((item) => {
    const current = effectiveReminder(item, today)
    if (current === item || !current.doneAt) return current
    void setReminderDone(item.id, current.doneAt).catch(() => {})
    return current
  })
}

/** The photo to store for a new reminder: a picked one must upload; a guest's moves over if it can. */
async function photoForNewReminder(userId: string, input: ReminderInput): Promise<{ path: string | null; url: string | null }> {
  if (input.photo) {
    const path = await uploadReminderPhoto(userId, input.photo.blob)
    return { path, url: rememberReminderPhoto(path, input.photo.blob) }
  }
  if (isReminderPhotoData(input.photoData)) {
    try {
      const blob = dataUrlToBlob(input.photoData)
      const path = await uploadReminderPhoto(userId, blob)
      return { path, url: rememberReminderPhoto(path, blob) }
    } catch {
      return { path: null, url: null }
    }
  }
  return { path: input.photoPath ?? null, url: null }
}

export async function getReminder(id: string): Promise<Reminder | null> {
  const client = createSupabaseClient()
  const { data, error } = await client.from('reminders').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? fromRow(data) : null
}

export async function addReminder(
  userId: string,
  input: ReminderInput & { doneAt?: string | null },
): Promise<Reminder> {
  const client = createSupabaseClient()
  const photo = await photoForNewReminder(userId, input)
  const { data, error } = await client
    .from('reminders')
    .insert({
      user_id: userId,
      text: cleanReminderText(input.text),
      description: cleanReminderDescription(input.description),
      photo_path: photo.path,
      day: input.day,
      hour: input.hour,
      minute: input.hour == null ? null : input.minute,
      remind_before: input.remindBefore === true,
      remind_week_before: input.remindWeekBefore === true,
      kind: reminderKindOf(input.kind),
      every_year: input.everyYear === true && !input.repeat,
      ...repeatColumns(input),
      done_at: input.doneAt ?? null,
      shared_event_id: input.sharedEventId ?? null,
      shared_list_item_id: input.sharedListItemId ?? null,
      shared_list_id: input.sharedListId ?? null,
      community_id: input.communityId ?? null,
      community_photo_path: isEventPhotoPath(input.communityPhotoPath) ? input.communityPhotoPath : null,
      alert_off: input.alertOff === true,
    })
    .select('*')
    .single()
  if (error) {
    if (photo.path && photo.path !== input.photoPath) void removeReminderPhotoIfUnused(photo.path)
    if (capError(error)) throw new ReminderCapError()
    throw error
  }
  const saved = fromRow(data)
  if (photo.url) return { ...saved, photoUrl: photo.url }
  return saved.photoPath ? (await withReminderPhotoUrls([saved]))[0] : saved
}

/** Saves the edit. Returns the photo fields when the photo changed. */
export async function updateReminder(
  id: string,
  input: ReminderInput,
  options?: { detachSharedList?: boolean },
): Promise<Pick<Reminder, 'photoPath' | 'photoUrl'> | null> {
  const client = createSupabaseClient()
  const { data: existing, error: existingError } = await client
    .from('reminders')
    .select('shared_list_item_id, shared_list_id')
    .eq('id', id)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.shared_list_item_id || existing?.shared_list_id) return null
  let next: { path: string | null; url: string | null } | null = null
  let previous: string | null = null
  if (input.photo !== undefined) {
    const { data: row, error: rowError } = await client
      .from('reminders')
      .select('user_id, photo_path')
      .eq('id', id)
      .single()
    if (rowError) throw rowError
    previous = row.photo_path
    if (input.photo) {
      const path = await uploadReminderPhoto(row.user_id, input.photo.blob)
      next = { path, url: rememberReminderPhoto(path, input.photo.blob) }
    } else {
      next = { path: null, url: null }
    }
  }
  const { error } = await client
    .from('reminders')
    .update({
      text: cleanReminderText(input.text),
      description: cleanReminderDescription(input.description),
      ...(next ? { photo_path: next.path } : {}),
      day: input.day,
      hour: input.hour,
      minute: input.hour == null ? null : input.minute,
      remind_before: input.remindBefore === true,
      remind_week_before: input.remindWeekBefore === true,
      kind: reminderKindOf(input.kind),
      every_year: input.everyYear === true && !input.repeat,
      ...repeatColumns(input),
      ...(options?.detachSharedList ? { shared_list_item_id: null, shared_list_id: null } : {}),
    })
    .eq('id', id)
  if (error) {
    if (next?.path) void removeReminderPhotoIfUnused(next.path)
    throw error
  }
  if (!next) return null
  if (previous && previous !== next.path) void removeReminderPhotoIfUnused(previous)
  return { photoPath: next.path, photoUrl: next.url }
}

export async function linkReminderToSharedEvent(id: string, sharedEventId: string): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('reminders').update({ shared_event_id: sharedEventId }).eq('id', id)
  if (error) throw error
}

export async function setReminderAlertOff(id: string, alertOff: boolean): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('reminders').update({ alert_off: alertOff }).eq('id', id)
  if (error) throw error
}

export async function moveReminder(id: string, day: string): Promise<void> {
  const client = createSupabaseClient()
  const { data: existing, error: existingError } = await client
    .from('reminders')
    .select('shared_list_item_id, shared_list_id')
    .eq('id', id)
    .maybeSingle()
  if (existingError) throw existingError
  if (existing?.shared_list_item_id || existing?.shared_list_id) return
  const { error } = await client.from('reminders').update({ day }).eq('id', id)
  if (error) throw error
}

export async function setReminderDone(id: string, doneAt: string | null): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client.from('reminders').update({ done_at: doneAt }).eq('id', id)
  if (error) throw error
}

/** Marks done. An every-year reminder also gets next year's copy, unless the list is full. */
export async function completeReminder(userId: string, reminder: Reminder, doneAt: string): Promise<void> {
  const current = effectiveReminder(reminder, todayLocalDate(new Date(doneAt)))
  if (isRepeating(current)) {
    // One occurrence is done. The same reminder moves on to its next day.
    const next = completeOccurrence(current, doneAt)
    const { error } = await createSupabaseClient()
      .from('reminders')
      .update({ day: next.day, done_at: next.doneAt, last_done_on: next.lastDoneOn })
      .eq('id', reminder.id)
    if (error) throw error
    return
  }
  await setReminderDone(reminder.id, doneAt)
  if (!reminder.everyYear) return
  try {
    await addReminder(userId, nextYearCopy(reminder))
  } catch (err) {
    if (!(err instanceof ReminderCapError)) throw err
  }
}

/** Puts a done reminder back, and removes the next-year copy that Done made. */
export async function reopenReminder(reminder: Reminder): Promise<void> {
  if (isRepeating(reminder)) {
    const back = reopenOccurrence(reminder)
    const { error } = await createSupabaseClient()
      .from('reminders')
      .update({ day: back.day, done_at: back.doneAt, last_done_on: back.lastDoneOn })
      .eq('id', reminder.id)
    if (error) throw error
    return
  }
  await setReminderDone(reminder.id, null)
  if (!reminder.everyYear) return
  const client = createSupabaseClient()
  const { error } = await client
    .from('reminders')
    .delete()
    .eq('every_year', true)
    .eq('text', reminder.text)
    .eq('day', nextYearDay(reminder.day))
    .is('done_at', null)
    .neq('id', reminder.id)
  if (error) throw error
}

export async function deleteReminder(id: string): Promise<void> {
  const client = createSupabaseClient()
  const { data: row } = await client.from('reminders').select('photo_path').eq('id', id).maybeSingle()
  const { error } = await client.from('reminders').delete().eq('id', id)
  if (error) throw error
  void removeReminderPhotoIfUnused(row?.photo_path)
}
