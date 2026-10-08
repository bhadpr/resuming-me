import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { loadGuestDraft, toggleGuestDose, guestDosesOnDate } from './guestDraft'
import { clearDoseTaken, markDoseTaken } from './medicines'
import {
  activeSnoozeAlarms,
  clearSkip,
  clearSnooze,
  rememberSkip,
  rememberSnooze,
  skippedDoseMarks,
} from './medicineReminderState'
import {
  applyMedicineSnoozes,
  medicineNotificationIds,
  medicineSnoozeIds,
  planMedicineAlarms,
  type DoseMark,
  type MealRelation,
  type MedicineSchedule,
} from './medicineSchedule'
import { createSupabaseClient } from './supabase'
import { MEDICINES_ENABLED } from '../config'

const CHANNEL_ID = 'medicine'
const ACTION_TYPE = 'medicine-dose'
const ACTION_TAKEN = 'taken'
const ACTION_SKIPPED = 'skipped'
const ACTION_SNOOZE = 'snooze'

export type MedicineActionLabels = {
  taken: string
  skipped: string
  snooze: string
}

const ENGLISH_ACTIONS: MedicineActionLabels = {
  taken: 'Taken',
  skipped: 'Skipped',
  snooze: 'Snooze 30 min',
}

function nativePluginAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('LocalNotifications')
}

function doseFromExtra(extra: unknown): DoseMark | null {
  if (!extra || typeof extra !== 'object') return null
  const value = extra as Record<string, unknown>
  if (value.kind !== 'medicine' || typeof value.medicineId !== 'string' || typeof value.date !== 'string') {
    return null
  }
  const hour = Number(value.hour)
  const minute = Number(value.minute)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  return { medicineId: value.medicineId, date: value.date, hour, minute }
}

async function ensureMedicineChannel(): Promise<void> {
  try {
    const { channels } = await LocalNotifications.listChannels()
    if (channels.some((channel) => channel.id === CHANNEL_ID)) return
  } catch {
    /* create below */
  }
  try {
    await LocalNotifications.createChannel({
      id: CHANNEL_ID,
      name: 'Medicine',
      description: 'A reminder at the time you take a medicine.',
      importance: 4,
      vibration: false,
    })
  } catch {
    /* already exists */
  }
}

async function registerMedicineActions(labels: MedicineActionLabels): Promise<void> {
  await LocalNotifications.registerActionTypes({
    types: [
      {
        id: ACTION_TYPE,
        actions: [
          { id: ACTION_TAKEN, title: labels.taken },
          { id: ACTION_SKIPPED, title: labels.skipped },
          { id: ACTION_SNOOZE, title: labels.snooze },
        ],
      },
    ],
  })
}

async function cancelMedicineNotifications(): Promise<void> {
  await LocalNotifications.cancel({
    notifications: [...medicineNotificationIds(), ...medicineSnoozeIds()].map((id) => ({ id })),
  })
}

/** Reschedules dose alarms only. The daily nudge uses a different id range. */
export async function syncMedicineNotifications(
  medicines: readonly MedicineSchedule[],
  marks: readonly DoseMark[],
  now = new Date(),
  body?: string | ((meal: MealRelation | null) => string),
  labels: MedicineActionLabels = ENGLISH_ACTIONS,
): Promise<void> {
  if (!nativePluginAvailable()) return
  if (!MEDICINES_ENABLED) {
    await cancelMedicineNotifications()
    return
  }
  await registerMedicineActions(labels)
  await cancelMedicineNotifications()
  const alarms = applyMedicineSnoozes(
    planMedicineAlarms(medicines, [...marks, ...skippedDoseMarks()], now, body),
    activeSnoozeAlarms(now),
  )
  if (alarms.length === 0) return
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return
  await ensureMedicineChannel()
  await LocalNotifications.schedule({
    notifications: alarms.map((alarm) => ({
      id: alarm.id,
      title: alarm.title,
      body: alarm.body,
      schedule: { at: alarm.at, allowWhileIdle: true },
      extra: {
        dest: 'today',
        kind: 'medicine',
        medicineId: alarm.medicineId,
        date: alarm.date,
        hour: alarm.hour,
        minute: alarm.minute,
      },
      channelId: CHANNEL_ID,
      actionTypeId: ACTION_TYPE,
      autoCancel: true,
    })),
  })
}

async function markTakenFromNotification(dose: DoseMark): Promise<void> {
  clearSkip(dose)
  clearSnooze(dose)
  if (dose.medicineId.startsWith('guest:')) {
    const draft = loadGuestDraft()
    if (!draft) return
    const match = guestDosesOnDate(draft, dose.date).find(
      (item) => item.medicineId === dose.medicineId && item.hour === dose.hour && item.minute === dose.minute,
    )
    if (match && !match.taken) toggleGuestDose(draft, match, dose.date)
    return
  }
  const client = createSupabaseClient()
  const { data } = await client.auth.getUser()
  if (!data.user) return
  await markDoseTaken(data.user.id, dose)
}

async function handleMedicineAction(actionId: string, extra: unknown, title: string, body: string): Promise<void> {
  const dose = doseFromExtra(extra)
  if (!dose) return
  if (actionId === ACTION_TAKEN) {
    await markTakenFromNotification(dose)
    return
  }
  if (actionId === ACTION_SKIPPED) {
    rememberSkip(dose)
    if (!dose.medicineId.startsWith('guest:')) {
      const client = createSupabaseClient()
      const { data } = await client.auth.getUser()
      if (data.user) await clearDoseTaken(dose)
    }
    return
  }
  if (actionId === ACTION_SNOOZE) {
    rememberSnooze(dose, title, body)
  }
}

/** Taken, Skipped, and Snooze 30 min on a medicine reminder. */
export async function listenForMedicineNotificationActions(): Promise<() => void> {
  if (!nativePluginAvailable()) return () => {}
  const handle = await LocalNotifications.addListener('localNotificationActionPerformed', (event) => {
    const extra = event.notification.extra as { kind?: string } | undefined
    if (extra?.kind !== 'medicine') return
    if (event.actionId !== ACTION_TAKEN && event.actionId !== ACTION_SKIPPED && event.actionId !== ACTION_SNOOZE) {
      return
    }
    void handleMedicineAction(
      event.actionId,
      event.notification.extra,
      event.notification.title,
      event.notification.body,
    )
  })
  return () => {
    void handle.remove()
  }
}
