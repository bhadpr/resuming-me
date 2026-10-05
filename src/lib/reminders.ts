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
  return (data ?? []).map(fromRow)
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
