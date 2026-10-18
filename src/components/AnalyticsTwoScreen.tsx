import { useEffect, useState } from 'react'
import {
  fetchAlertStatus,
  fetchAppErrors,
  fetchAppInstalls,
  fetchEventPeriods,
  fetchGuestRetention,
  fetchPropBreakdown,
  type AlertStatus,
  type AppErrors,
  type AppInstalls,
  type EventPeriod,
  type EventPeriods,
  type GuestRetention,
  type RetentionPlatform,
} from '../lib/eventAnalytics'
import { AnalyticsTwoView, type WindowDays } from './AnalyticsTwoView'

/** Admin analytics, page 2: loads the numbers and hands them to the view. */
export function AnalyticsTwoScreen() {
  const [days, setDays] = useState<WindowDays>(30)
  const [installs, setInstalls] = useState<AppInstalls | null>(null)
  const [installsError, setInstallsError] = useState<string | null>(null)
  const [errors, setErrors] = useState<AppErrors | null>(null)
  const [errorsError, setErrorsError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<AlertStatus | null>(null)
  const [alertsError, setAlertsError] = useState<string | null>(null)
  const [retentionPlatform, setRetentionPlatform] = useState<RetentionPlatform>('android')
  const [retention, setRetention] = useState<GuestRetention | null>(null)
  const [retentionError, setRetentionError] = useState<string | null>(null)
  const [period, setPeriod] = useState<EventPeriod>('week')
  const [periods, setPeriods] = useState<EventPeriods | null>(null)
  const [periodsLoading, setPeriodsLoading] = useState(true)
  const [periodsError, setPeriodsError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setInstallsError(null)
    fetchAppInstalls(days)
      .then((result) => mounted && setInstalls(result))
      .catch((err) => {
        if (!mounted) return
        setInstalls(null)
        setInstallsError(err instanceof Error ? err.message : 'Could not load installs')
      })
    return () => {
      mounted = false
    }
  }, [days])

  useEffect(() => {
    let mounted = true
    setErrorsError(null)
    fetchAppErrors(days)
      .then((result) => mounted && setErrors(result))
      .catch((err) => {
        if (!mounted) return
        setErrors(null)
        setErrorsError(err instanceof Error ? err.message : 'Could not load errors')
      })
    return () => {
      mounted = false
    }
  }, [days])

  useEffect(() => {
    let mounted = true
    setRetentionError(null)
    setRetention(null)
    fetchGuestRetention(retentionPlatform)
      .then((result) => mounted && setRetention(result))
      .catch((err) => mounted && setRetentionError(err instanceof Error ? err.message : 'Could not load retention'))
    return () => {
      mounted = false
    }
  }, [retentionPlatform])

  useEffect(() => {
    let mounted = true
    setAlertsError(null)
    fetchAlertStatus(days)
      .then((result) => mounted && setAlerts(result))
      .catch((err) => {
        if (!mounted) return
        setAlerts(null)
        setAlertsError(err instanceof Error ? err.message : 'Could not load alerts')
      })
    return () => {
      mounted = false
    }
  }, [days])

  useEffect(() => {
    let mounted = true
    setPeriodsLoading(true)
    setPeriodsError(null)
    fetchEventPeriods(period)
      .then((result) => mounted && setPeriods(result))
      .catch((err) => {
        if (!mounted) return
        setPeriods(null)
        setPeriodsError(err instanceof Error ? err.message : 'Could not load events')
      })
      .finally(() => mounted && setPeriodsLoading(false))
    return () => {
      mounted = false
    }
  }, [period])

  return (
    <AnalyticsTwoView
      days={days}
      onDays={setDays}
      installs={installs}
      installsError={installsError}
      retentionPlatform={retentionPlatform}
      onRetentionPlatform={setRetentionPlatform}
      retention={retention}
      retentionError={retentionError}
      alerts={alerts}
      alertsError={alertsError}
      errors={errors}
      errorsError={errorsError}
      period={period}
      onPeriod={setPeriod}
      periods={periods}
      periodsLoading={periodsLoading}
      periodsError={periodsError}
      loadBreakdown={fetchPropBreakdown}
    />
  )
}
