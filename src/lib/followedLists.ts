import { holidayCopyText } from './communityReminders'
import { todayLocalDate } from './dates'
import { reminderClock } from './listClock'
import { isEventPhotoPath } from './eventPhotoUrl'
import { getLocale } from './i18n'
import { ReminderCapError, addReminder, deleteReminder } from './reminders'
import { REMINDER_OPEN_MAX, listLeadMinutes, type Reminder } from './reminderSchedule'
import { createSupabaseClient } from './supabase'

/** One day on a calendar the person still follows. */
export type FollowedDay = {
  id: string
  listId: string
  text: string
  day: string
  hour: number | null
  minute: number | null
  remindBefore: boolean
  photoPath: string | null
}

export type FollowedCopy = {
  id: string
  text: string
  day: string
  hour: number | null
  minute: number | null
  doneAt: string | null
  sharedListItemId?: string | null
  sharedListId?: string | null
}

export type FollowedUpdate = {
  reminderId: string
  text: string
  day: string
  hour: number | null
  minute: number | null
  sharedListId: string
  sharedListItemId: string
}

export type FollowedListPlan = {
  updates: FollowedUpdate[]
  removeIds: string[]
  add: FollowedDay[]
}

function clock(hour: number | null, minute: number | null): { hour: number | null; minute: number | null } {
  if (hour == null || minute == null) return { hour: null, minute: null }
  return { hour, minute }
}

/**
 * What to change so the copies match the calendars they still follow.
 * `days` is every current day of each calendar in `loadedListIds`.
 * A calendar that is off, or that this load could not read, is left alone.
 * A day the person already edited has no calendar id, so it is left alone.
 */
export function planFollowedListRefresh(
  reminders: readonly FollowedCopy[],
  days: readonly FollowedDay[],
  loadedListIds: ReadonlySet<string>,
  today = todayLocalDate(),
): FollowedListPlan {
  const daysById = new Map(days.map((day) => [day.id, day]))
  const held = new Set(
    reminders.map((item) => item.sharedListItemId).filter((id): id is string => typeof id === 'string' && id !== ''),
  )
  const updates: FollowedUpdate[] = []
  const removeIds: string[] = []

  for (const reminder of reminders) {
    if (reminder.doneAt) continue
    const linked = reminder.sharedListItemId ? daysById.get(reminder.sharedListItemId) : undefined
    const listId = linked?.listId ?? reminder.sharedListId ?? null
    if (!listId || !loadedListIds.has(listId)) continue
    if (!linked) {
      removeIds.push(reminder.id)
      continue
    }
    const time = clock(linked.hour, linked.minute)
    const same =
      reminder.text === linked.text &&
      reminder.day === linked.day &&
      reminder.hour === time.hour &&
      (reminder.minute ?? null) === time.minute &&
      reminder.sharedListId === linked.listId
    if (same) continue
    updates.push({
      reminderId: reminder.id,
      text: linked.text,
      day: linked.day,
      hour: time.hour,
      minute: time.minute,
      sharedListId: linked.listId,
      sharedListItemId: linked.id,
    })
  }

  const removing = new Set(removeIds)
  let room =
    REMINDER_OPEN_MAX -
    reminders.filter((item) => {
      if (item.doneAt || removing.has(item.id)) return false
      if (item.day < today && (item.sharedListItemId || item.sharedListId)) return false
      return true
    }).length
  const add: FollowedDay[] = []
  const fresh = [...days].filter((day) => loadedListIds.has(day.listId) && !held.has(day.id) && day.day >= today)
  fresh.sort((a, b) => a.day.localeCompare(b.day) || a.text.localeCompare(b.text))
  for (const day of fresh) {
    if (room <= 0) break
    add.push(day)
    room -= 1
  }
  return { updates, removeIds, add }
}

export function followedPlanIsQuiet(plan: FollowedListPlan): boolean {
  return plan.updates.length === 0 && plan.removeIds.length === 0 && plan.add.length === 0
}

type ItemRow = {
  id: string
  list_id: string
  text: string
  day: string
  hour: number | null
  minute: number | null
}

function asDay(
  row: ItemRow,
  lists: Map<string, { remind_before: boolean; photo_path: string | null; time_zone: string | null }>,
): FollowedDay {
  const list = lists.get(row.list_id)
  const time = reminderClock(
    { day: row.day.slice(0, 10), hour: row.hour, minute: row.minute },
    list?.time_zone,
  )
  return {
    id: row.id,
    listId: row.list_id,
    text: row.text,
    day: time.day,
    hour: time.hour,
    minute: time.minute,
    remindBefore: list?.remind_before === true,
    photoPath: isEventPhotoPath(list?.photo_path) ? list.photo_path : null,
  }
}

/** Current days of the active calendars these reminders still follow. Null when the read fails. */
export async function loadFollowedCalendarDays(
  reminders: readonly Pick<Reminder, 'sharedListItemId' | 'sharedListId'>[],
): Promise<{ days: FollowedDay[]; loadedListIds: Set<string> } | null> {
  const itemIds = [
    ...new Set(reminders.map((item) => item.sharedListItemId).filter((id): id is string => Boolean(id))),
  ]
  const knownListIds = [
    ...new Set(reminders.map((item) => item.sharedListId).filter((id): id is string => Boolean(id))),
  ]
  if (itemIds.length === 0 && knownListIds.length === 0) return { days: [], loadedListIds: new Set() }
  try {
    const client = createSupabaseClient()
    const discovered = new Set(knownListIds)
    if (itemIds.length > 0) {
      const { data, error } = await client.from('shared_list_items').select('id, list_id').in('id', itemIds)
      if (error) return null
      for (const row of data ?? []) discovered.add(row.list_id)
    }
    if (discovered.size === 0) return { days: [], loadedListIds: new Set() }
    const { data: lists, error: listError } = await client
      .from('shared_lists')
      .select('id, status, remind_before, photo_path, time_zone')
      .in('id', [...discovered])
    if (listError || !lists) return null
    const active = lists.filter((list) => list.status === 'active')
    const loadedListIds = new Set(active.map((list) => list.id))
    if (loadedListIds.size === 0) return { days: [], loadedListIds }
    const items: ItemRow[] = []
    const listIds = [...loadedListIds]
    for (let index = 0; index < listIds.length; index += 80) {
      const ids = listIds.slice(index, index + 80)
      for (let from = 0; ; from += 1000) {
        const { data, error } = await client
          .from('shared_list_items')
          .select('id, list_id, text, day, hour, minute')
          .in('list_id', ids)
          .order('id', { ascending: true })
          .range(from, from + 999)
        if (error || !data) return null
        items.push(...data)
        if (data.length < 1000) break
      }
    }
    const meta = new Map(active.map((list) => [list.id, list]))
    const locale = getLocale()
    return {
      days: items.map((row) => {
        const day = asDay(row, meta)
        return { ...day, text: holidayCopyText(day.text, day.day, locale) }
      }),
      loadedListIds,
    }
  } catch {
    return null
  }
}

/** Writes calendar changes onto this account's copies. The list comes back already refreshed. */
export async function refreshFollowedReminders(userId: string, reminders: Reminder[]): Promise<Reminder[]> {
  if (!reminders.some((item) => item.sharedListItemId || item.sharedListId)) return reminders
  const loaded = await loadFollowedCalendarDays(reminders)
  if (!loaded) return reminders
  const plan = planFollowedListRefresh(reminders, loaded.days, loaded.loadedListIds)
  if (followedPlanIsQuiet(plan)) return reminders
  try {
    const client = createSupabaseClient()
    for (const update of plan.updates) {
      const { error } = await client
        .from('reminders')
        .update({
          text: update.text,
          day: update.day,
          hour: update.hour,
          minute: update.minute,
          shared_list_id: update.sharedListId,
        })
        .eq('id', update.reminderId)
      if (error) return reminders
    }
    for (const id of plan.removeIds) await deleteReminder(id)
    const added: Reminder[] = []
    for (const day of plan.add) {
      try {
        added.push(
          await addReminder(userId, {
            text: day.text,
            day: day.day,
            hour: day.hour,
            minute: day.minute,
            kind: 'event',
            sharedListItemId: day.id,
            sharedListId: day.listId,
            listPhotoPath: day.photoPath,
            remindBefore: day.remindBefore,
            remindLeadMinutes: day.hour == null ? null : listLeadMinutes(reminders, day.listId),
          }),
        )
      } catch (err) {
        if (err instanceof ReminderCapError) break
        if (!isDuplicate(err)) return reminders
      }
    }
    const updates = new Map(plan.updates.map((update) => [update.reminderId, update]))
    const removed = new Set(plan.removeIds)
    return [
      ...reminders
        .filter((item) => !removed.has(item.id))
        .map((item) => {
          const update = updates.get(item.id)
          if (!update) return item
          return {
            ...item,
            text: update.text,
            day: update.day,
            hour: update.hour,
            minute: update.minute,
            sharedListId: update.sharedListId,
            sharedListItemId: update.sharedListItemId,
          }
        }),
      ...added,
    ]
  } catch {
    return reminders
  }
}

function isDuplicate(err: unknown): boolean {
  return typeof err === 'object' && err != null && (err as { code?: string }).code === '23505'
}
