import { createSupabaseClient } from './supabase'
import {
  REMINDER_DONE_KEEP_MS,
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
    day: row.day,
    hour: row.hour,
    minute: row.minute,
    remindBefore: row.remind_before ?? false,
    kind: reminderKindOf(row.kind),
    everyYear: row.every_year ?? false,
    doneAt: row.done_at,
    sharedEventId: row.shared_event_id ?? null,
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

/** Fills in each shared reminder's event status and whether this account made it. Offline, the list comes back as it was. */
export async function withSharedStatuses<T extends Reminder>(list: readonly T[]): Promise<T[]> {
  const ids = [...new Set(list.map((item) => item.sharedEventId).filter((id): id is string => Boolean(id)))]
  if (ids.length === 0) return [...list]
  try {
    const [{ data, error }, owned] = await Promise.all([
      createSupabaseClient().rpc('shared_event_statuses', { p_ids: ids }),
      ownedSharedEventIds(ids).catch(() => new Set<string>()),
    ])
    const status = new Map(error ? [] : (data ?? []).map((row) => [row.id, row.status]))
    return list.map((item) => {
      if (!item.sharedEventId) return item
      const next = status.get(item.sharedEventId)
      const known = next === 'active' || next === 'cancelled' || next === 'switched_off'
      return {
        ...item,
        ...(known ? { sharedStatus: next } : {}),
        sharedByMe: owned.has(item.sharedEventId),
      }
    })
  } catch {
    return [...list]
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
  return withSharedStatuses((data ?? []).map(fromRow))
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
  const { data, error } = await client
    .from('reminders')
    .insert({
      user_id: userId,
      text: cleanReminderText(input.text),
      day: input.day,
      hour: input.hour,
      minute: input.hour == null ? null : input.minute,
      remind_before: input.remindBefore === true,
      kind: reminderKindOf(input.kind),
      every_year: input.everyYear === true,
      done_at: input.doneAt ?? null,
      shared_event_id: input.sharedEventId ?? null,
      alert_off: input.alertOff === true,
    })
    .select('*')
    .single()
  if (error) {
    if (capError(error)) throw new ReminderCapError()
    throw error
  }
  return fromRow(data)
}

export async function updateReminder(id: string, input: ReminderInput): Promise<void> {
  const client = createSupabaseClient()
  const { error } = await client
    .from('reminders')
    .update({
      text: cleanReminderText(input.text),
      day: input.day,
      hour: input.hour,
      minute: input.hour == null ? null : input.minute,
      remind_before: input.remindBefore === true,
      kind: reminderKindOf(input.kind),
      every_year: input.everyYear === true,
    })
    .eq('id', id)
  if (error) throw error
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
  const { error } = await client.from('reminders').delete().eq('id', id)
  if (error) throw error
}
