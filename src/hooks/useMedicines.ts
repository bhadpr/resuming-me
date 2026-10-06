import { useCallback, useEffect, useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLocale } from './useLocale'
import { translate } from '../lib/i18n'
import { todayLocalDate } from '../lib/dates'
import { mealMessageKey } from '../lib/medicineFormat'
import { dosesOnDate, type DoseMark, type DueDose } from '../lib/medicineSchedule'
import { listenForMedicineNotificationActions, syncMedicineNotifications } from '../lib/medicineNotifications'
import {
  MEDICINE_REMINDER_CHANGED,
  clearSkip,
  clearSnooze,
  isDoseSkipped,
  rememberSkip,
} from '../lib/medicineReminderState'
import {
  clearDoseTaken,
  listDoseMarks,
  listMedicines,
  markDoseTaken,
  type MedicineRecord,
} from '../lib/medicines'

export function useMedicines(userId: string | undefined) {
  const { locale } = useLocale()
  const [today, setToday] = useState(todayLocalDate)
  const [medicines, setMedicines] = useState<MedicineRecord[]>([])
  const [marks, setMarks] = useState<DoseMark[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)

  const reload = useCallback(
    async (quiet = false) => {
      if (!userId) {
        setMedicines([])
        setMarks([])
        return
      }
      if (!quiet) setLoading(true)
      const date = todayLocalDate()
      setToday(date)
      try {
        const [list, doseMarks] = await Promise.all([listMedicines(), listDoseMarks(date)])
        setMedicines(list)
        setMarks(doseMarks)
        setError(null)
        void syncMedicineNotifications(list, doseMarks, new Date(), (meal) => {
          const base = translate(locale, 'medicines.alarm')
          const key = mealMessageKey(meal)
          return key ? `${base} ${translate(locale, key)}` : base
        }, {
          taken: translate(locale, 'medicines.taken'),
          skipped: translate(locale, 'medicines.skipped'),
          snooze: translate(locale, 'medicines.snooze'),
        }).catch(
          () => {},
        )
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load medicines')
      } finally {
        setLoading(false)
      }
    },
    [locale, userId],
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

  const [reminderTick, setReminderTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    let removeListener = () => {}
    const refresh = () => {
      setReminderTick((tick) => tick + 1)
      void reload(true)
    }
    window.addEventListener(MEDICINE_REMINDER_CHANGED, refresh)
    void listenForMedicineNotificationActions().then((remove) => {
      if (cancelled) {
        remove()
        return
      }
      removeListener = remove
    })
    return () => {
      cancelled = true
      window.removeEventListener(MEDICINE_REMINDER_CHANGED, refresh)
      removeListener()
    }
  }, [reload])

  const doses = useMemo(
    () =>
      dosesOnDate(medicines, today, marks).map((dose) => ({
        ...dose,
        skipped:
          !dose.taken &&
          isDoseSkipped({ medicineId: dose.medicineId, date: today, hour: dose.hour, minute: dose.minute }),
      })),
    [marks, medicines, reminderTick, today],
  )

  async function toggleDose(dose: DueDose): Promise<void> {
    if (!userId || busyKey) return
    setBusyKey(dose.key)
    setError(null)
    const ref = { medicineId: dose.medicineId, date: today, hour: dose.hour, minute: dose.minute }
    try {
      if (dose.skipped) {
        clearSkip(ref)
        await reload(true)
        return
      }
      if (dose.taken) {
        await clearDoseTaken(ref)
      } else {
        clearSkip(ref)
        clearSnooze(ref)
        await markDoseTaken(userId, ref)
      }
      await reload(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that dose')
    } finally {
      setBusyKey(null)
    }
  }

  function skipDose(dose: DueDose): void {
    rememberSkip({ medicineId: dose.medicineId, date: today, hour: dose.hour, minute: dose.minute })
  }

  return { medicines, doses, loading, error, busyKey, reload, toggleDose, skipDose }
}
