import { useCallback, useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { todayLocalDate } from '../lib/dates'
import {
  REMINDER_OPEN_MAX,
  openReminderCount,
  remindersComingUp,
  remindersDoneToday,
  remindersForToday,
  type Reminder,
  type ReminderInput,
} from '../lib/reminderSchedule'
import {
  ReminderCapError,
  addReminder,
  deleteReminder,
  listReminders,
  moveReminder,
  setReminderDone,
  updateReminder,
} from '../lib/reminders'
import { track } from '../lib/track'

export function useReminders(userId: string | undefined) {
  const [today, setToday] = useState(todayLocalDate)
  const [reminders, setReminders] = useState<Reminder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const reload = useCallback(
    async (quiet = false) => {
      if (!userId) {
        setReminders([])
        return
      }
      if (!quiet) setLoading(true)
      setToday(todayLocalDate())
      try {
        setReminders(await listReminders())
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load reminders')
      } finally {
        setLoading(false)
      }
    },
    [userId],
  )

  useEffect(() => {
    void reload()
  }, [reload])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') void reload(true)
    }
    document.addEventListener('visibilitychange', onVisible)
    if (!Capacitor.isNativePlatform() || !userId) {
      return () => document.removeEventListener('visibilitychange', onVisible)
    }
    let cancelled = false
    let remove = () => {}
    void (async () => {
      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void reload(true)
      })
      if (cancelled) {
        void handle.remove()
        return
      }
      remove = () => {
        void handle.remove()
      }
    })()
    return () => {
      cancelled = true
      document.removeEventListener('visibilitychange', onVisible)
      remove()
    }
  }, [reload, userId])

  const open = useMemo(() => remindersForToday(reminders, today), [reminders, today])
  const doneToday = useMemo(() => remindersDoneToday(reminders, today), [reminders, today])
  const comingUp = useMemo(() => remindersComingUp(reminders, today), [reminders, today])
  const full = openReminderCount(reminders) >= REMINDER_OPEN_MAX

  function patchLocal(id: string, patch: Partial<Reminder>) {
    setReminders((current) => current.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  async function run(id: string, patch: Partial<Reminder>, write: () => Promise<void>): Promise<boolean> {
    const before = reminders.find((item) => item.id === id)
    if (!before) return false
    setBusyId(id)
    setError(null)
    patchLocal(id, patch)
    try {
      await write()
      return true
    } catch (err) {
      patchLocal(id, before)
      setError(err instanceof Error ? err.message : 'Could not update that reminder')
      return false
    } finally {
      setBusyId(null)
    }
  }

  /** Returns 'full' when the account is at the open cap. */
  async function add(input: ReminderInput): Promise<'ok' | 'full'> {
    if (!userId) return 'ok'
    if (full) return 'full'
    try {
      const saved = await addReminder(userId, input)
      setReminders((current) => [...current, saved])
      track('reminder_added', { has_time: input.hour != null, signed_in: true })
      return 'ok'
    } catch (err) {
      if (err instanceof ReminderCapError) return 'full'
      throw err
    }
  }

  async function update(id: string, input: ReminderInput): Promise<void> {
    await updateReminder(id, input)
    patchLocal(id, input)
  }

  async function remove(id: string): Promise<void> {
    await deleteReminder(id)
    setReminders((current) => current.filter((item) => item.id !== id))
  }

  async function markDone(reminder: Reminder): Promise<boolean> {
    const doneAt = new Date().toISOString()
    const ok = await run(reminder.id, { doneAt }, () => setReminderDone(reminder.id, doneAt))
    if (ok) track('reminder_done', { signed_in: true })
    return ok
  }

  async function markNotDone(reminder: Reminder): Promise<boolean> {
    return run(reminder.id, { doneAt: null }, () => setReminderDone(reminder.id, null))
  }

  async function move(reminder: Reminder, day: string): Promise<boolean> {
    return run(reminder.id, { day }, () => moveReminder(reminder.id, day))
  }

  return {
    today,
    reminders,
    open,
    doneToday,
    comingUp,
    full,
    loading,
    error,
    busyId,
    reload,
    add,
    update,
    remove,
    markDone,
    markNotDone,
    move,
  }
}
