import { SIGN_IN_AGAIN, dropLocalSignIn, requireAccountId } from './accountId'
import { holidayCopyText } from './communityReminders'
import { describeError } from './describeError'
import { reminderClock } from './listClock'
import { addGuestReminder, ensureGuestDraft, loadGuestDraft, removeGuestReminder } from './guestDraft'
import { getLocale } from './i18n'
import { askForReminderAlerts } from './reminderNotifications'
import { ReminderCapError, addReminder, deleteReminder } from './reminders'
import { announceRemindersChanged, remindLeadFor, type RemindLeadMinutes, type ReminderInput } from './reminderSchedule'
import { acceptSharedList, type SharedList } from './sharedLists'
import { createSupabaseClient } from './supabase'
import { track } from './track'

function isDuplicate(err: unknown): boolean {
  return typeof err === 'object' && err != null && (err as { code?: string }).code === '23505'
}

/** The stored sign-in is not an account the server still has. */
export function accountIsGone(err: unknown): boolean {
  const message = describeError(err, '')
  return (
    message.includes('_user_id_fkey') ||
    message.includes('profiles_id_fkey') ||
    message === SIGN_IN_AGAIN
  )
}

/** Leave the dead sign-in after this tap finishes, so the phone list can open first. */
function releaseDeadSignIn(): void {
  window.setTimeout(() => {
    void dropLocalSignIn()
  }, 0)
}

/** The sentence to show when a community list does not land on the phone. */
export function messageForSharedListAdd(
  err: unknown,
  connectionMessage: string,
  unavailableMessage: string,
): string {
  const message = describeError(err, connectionMessage)
  if (message.includes('shared_list_unavailable')) return unavailableMessage
  if (/fetch|network|load failed/i.test(message)) return connectionMessage
  return message
}

/** Copies every day that is not already saved. One tap, the whole list. */
export async function importSharedList(
  list: SharedList,
  userId: string | null,
  skipIds: ReadonlySet<string>,
  remindBefore = list.remindBefore,
  remindLeadMinutes: RemindLeadMinutes | null = null,
): Promise<'ok' | 'full' | 'none'> {
  const chosen = list.items.filter((item) => !skipIds.has(item.id))
  if (chosen.length === 0) return 'none'
  let ownerId: string | null = null
  if (userId) {
    try {
      ownerId = await requireAccountId()
    } catch (err) {
      if (!accountIsGone(err)) throw err
      releaseDeadSignIn()
    }
  }
  try {
    await acceptSharedList(list.id)
  } catch (err) {
    if (ownerId && accountIsGone(err)) {
      releaseDeadSignIn()
      ownerId = null
    } else if (ownerId || describeError(err, '').includes('shared_list_unavailable')) {
      throw err
    }
  }
  let created = 0
  let timed: ReminderInput | null = null
  for (const item of chosen) {
    const clock = reminderClock(item, list.timeZone)
    const input: ReminderInput = {
      text: holidayCopyText(item.text, clock.day, getLocale()),
      day: clock.day,
      hour: clock.hour,
      minute: clock.minute,
      kind: 'event',
      sharedListItemId: item.id,
      sharedListId: list.id,
      listPhotoPath: list.photoPath,
      remindBefore,
      remindLeadMinutes: remindLeadFor({ hour: clock.hour, remindLeadMinutes }),
    }
    if (input.hour != null || input.remindBefore) timed = input
    if (ownerId) {
      try {
        await addReminder(ownerId, input)
        created += 1
      } catch (err) {
        if (err instanceof ReminderCapError) {
          if (created > 0) {
            track('shared_list_added', { count: created, signed_in: true })
            if (timed) void askForReminderAlerts(timed)
          }
          return 'full'
        }
        if (isDuplicate(err)) continue
        if (!accountIsGone(err)) throw err
        releaseDeadSignIn()
        ownerId = null
      }
    }
    if (ownerId) continue
    const draft = ensureGuestDraft()
    if (draft.reminders.some((reminder) => reminder.sharedListItemId === item.id)) continue
    const next = addGuestReminder(draft, input)
    if (!next) {
      if (created > 0) {
        track('shared_list_added', { count: created, signed_in: false })
        if (timed) void askForReminderAlerts(timed)
      }
      return 'full'
    }
    created += 1
  }
  if (created === 0) return 'none'
  track('shared_list_added', { count: created, signed_in: Boolean(ownerId) })
  if (timed) void askForReminderAlerts(timed)
  return 'ok'
}

/** Takes this list's copied reminders off the phone. The shared list itself stays. */
export async function removeImportedSharedList(list: SharedList, userId: string | null): Promise<void> {
  const itemIds = list.items.map((item) => item.id)
  if (itemIds.length === 0) return
  if (userId) {
    const client = createSupabaseClient()
    const { data, error } = await client.from('reminders').select('id').in('shared_list_item_id', itemIds)
    if (error) throw error
    for (const row of data ?? []) await deleteReminder(row.id)
    announceRemindersChanged()
    return
  }
  let draft = loadGuestDraft()
  if (!draft) return
  const ids = new Set(itemIds)
  for (const reminder of [...draft.reminders]) {
    if (reminder.sharedListItemId && ids.has(reminder.sharedListItemId)) {
      draft = removeGuestReminder(draft, reminder.id)
    }
  }
}
