import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { todayLocalDate } from '../lib/dates'
import {
  addGuestReminder,
  loadGuestDraft,
  removeGuestReminder,
  updateGuestReminder,
  type GuestDraft,
} from '../lib/guestDraft'
import { navigateBack } from '../lib/navigation'
import { askForReminderAlerts } from '../lib/reminderNotifications'
import { REMINDERS_CHANGED, remindersComingUp, remindersForToday } from '../lib/reminderSchedule'
import { forgetSharedReminder } from '../lib/sharedEvents'
import { track } from '../lib/track'
import { ReminderEditor } from './ReminderForm'
import { GuestSaveWidget } from './GuestSaveWidget'
import { ReminderListSection } from './ReminderSection'

export function GuestReminderEditor({ reminderId, editing = false }: { reminderId?: string; editing?: boolean }) {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<GuestDraft | null>(() => loadGuestDraft())
  if (!draft) return null
  const viewPath = reminderId ? `/reminders/${reminderId}` : '/reminders'

  return (
    <ReminderEditor
      reminderId={reminderId}
      reminders={draft.reminders}
      today={todayLocalDate()}
      loading={false}
      saving={false}
      error={null}
      editing={editing}
      onEdit={(reminder) => navigate(`/reminders/${reminder.id}/edit`)}
      onCancel={() => navigateBack(navigate, editing ? viewPath : '/reminders')}
      onSubmit={async (input) => {
        const current = loadGuestDraft()
        if (!current) return
        if (reminderId) {
          setDraft(updateGuestReminder(current, reminderId, input))
        } else {
          if (!addGuestReminder(current, input)) return 'full'
          track('reminder_added', {
            has_time: input.hour != null,
            day_before: input.remindBefore === true,
            kind: input.kind ?? 'other',
            every_year: input.everyYear === true,
            signed_in: false,
          })
        }
        void askForReminderAlerts(input)
        navigateBack(navigate, viewPath)
      }}
      onAlertOff={(reminder, alertOff) => {
        const current = loadGuestDraft()
        if (current) setDraft(updateGuestReminder(current, reminder.id, { alertOff }))
      }}
      onDelete={async (reminder) => {
        const current = loadGuestDraft()
        if (current) removeGuestReminder(current, reminder.id)
        forgetSharedReminder(reminder)
        navigateBack(navigate, '/reminders')
      }}
    />
  )
}

export function GuestReminderList() {
  const navigate = useNavigate()
  const [draft, setDraft] = useState<GuestDraft | null>(() => loadGuestDraft())
  useEffect(() => {
    const refresh = () => setDraft(loadGuestDraft())
    window.addEventListener(REMINDERS_CHANGED, refresh)
    return () => window.removeEventListener(REMINDERS_CHANGED, refresh)
  }, [])
  if (!draft) return null
  const today = todayLocalDate()

  return (
    <>
      <GuestSaveWidget draft={draft} />
      <ReminderListSection
        dueNow={remindersForToday(draft.reminders, today)}
        later={remindersComingUp(draft.reminders, today)}
        today={today}
        loading={false}
        error={null}
        onAdd={() => navigate('/reminders/new')}
        onOpen={(reminder) => navigate(`/reminders/${reminder.id}`)}
      />
    </>
  )
}
