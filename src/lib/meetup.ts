import { compressEventPhoto } from './eventPhotos'
import { addReminder, deleteReminder } from './reminders'
import { remindLeadFor, type Reminder, type ReminderInput } from './reminderSchedule'
import { createSharedEvent } from './sharedEvents'

/**
 * Saves the meetup and makes its link. The link is the point of this reminder.
 * If the link cannot be made, the reminder is removed so a private copy is not left behind.
 */
export async function createMeetup(userId: string, input: ReminderInput): Promise<Reminder> {
  const saved = await addReminder(userId, {
    ...input,
    kind: input.kind && input.kind !== 'other' ? input.kind : 'event',
    everyYear: false,
    remindWeekBefore: false,
  })
  try {
    const photo = input.photo ? await compressEventPhoto(input.photo.blob).catch(() => null) : null
    const made = await createSharedEvent(userId, saved, null, photo, {
      meetup: true,
      remindBefore: input.remindBefore === true,
      remindLeadMinutes: remindLeadFor(input),
    })
    return {
      ...saved,
      sharedEventId: made.id,
      sharedByMe: true,
      meetup: true,
      sharedStatus: 'active',
      sharedPhotoPath: made.photoPath,
    }
  } catch (err) {
    await deleteReminder(saved.id).catch(() => {})
    throw err
  }
}
