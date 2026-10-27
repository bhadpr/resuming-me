import { localEventTime } from './sharedEvents'
import { remindLeadFor, type RemindLeadMinutes, type Reminder, type ReminderKind, type SharedReminderStatus } from './reminderSchedule'

/** What the server currently says about one shared event. */
export type MeetupSource = {
  id: string
  meetup: boolean
  text: string | null
  description: string | null
  day: string
  hour: number | null
  minute: number | null
  timeZone: string
  remindBefore: boolean
  remindLeadMinutes: RemindLeadMinutes | null
  photoPath: string | null
  kind: ReminderKind
  status: SharedReminderStatus
}

export type MeetupUpdate = {
  reminderId: string
  text: string
  description: string | null
  day: string
  hour: number | null
  minute: number | null
  remindBefore: boolean
  remindLeadMinutes: RemindLeadMinutes | null
  kind: ReminderKind
  sharedPhotoPath: string | null
}

function sameClock(reminder: Reminder, next: { hour: number | null; minute: number | null }): boolean {
  return reminder.hour === next.hour && (reminder.minute ?? null) === next.minute
}

/**
 * Day, time, name, and the evening-before choice to copy onto phones that accepted a meetup.
 * A done reminder stays as that person left it. Alert off and delete are not part of this plan.
 */
export function planMeetupRefresh(
  reminders: readonly Reminder[],
  events: readonly MeetupSource[],
  deviceZone?: string,
): MeetupUpdate[] {
  const byId = new Map(events.map((event) => [event.id, event]))
  const updates: MeetupUpdate[] = []
  for (const reminder of reminders) {
    if (!reminder.sharedEventId || reminder.doneAt) continue
    const event = byId.get(reminder.sharedEventId)
    if (!event?.meetup || event.status !== 'active' || !event.text) continue
    const local = localEventTime(
      { day: event.day, hour: event.hour, minute: event.minute, timeZone: event.timeZone },
      deviceZone,
    )
    const next = {
      text: event.text,
      description: event.description,
      day: local?.day ?? event.day,
      hour: local?.hour ?? event.hour,
      minute: local?.minute ?? event.minute,
      remindBefore: event.remindBefore,
      remindLeadMinutes: remindLeadFor(event),
      kind: event.kind,
      sharedPhotoPath: event.photoPath,
    }
    const same =
      reminder.text === next.text &&
      (reminder.description ?? null) === next.description &&
      reminder.day === next.day &&
      sameClock(reminder, next) &&
      reminder.remindBefore === next.remindBefore &&
      remindLeadFor(reminder) === next.remindLeadMinutes &&
      reminder.kind === next.kind &&
      (reminder.sharedPhotoPath ?? null) === next.sharedPhotoPath
    if (same) continue
    updates.push({ reminderId: reminder.id, ...next })
  }
  return updates
}
