import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useTheme } from '../hooks/useTheme'
import { DEFAULT_THEME, type ThemeId } from '../lib/themes'
import {
  digestScheduleHint,
  loadDailyDigestPrefs,
  saveDailyDigestPrefs,
  type DailyDigestPrefs,
  type DigestItem,
} from '../lib/dailyDigest'
import {
  hasExactAlarms,
  requestDailyDigestPermission,
  requestExactAlarms,
  scheduleTestDigest,
} from '../lib/localNotifications'

const HOURS = Array.from({ length: 24 }, (_, hour) => hour)
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5)

interface SettingsScreenProps {
  onBack: () => void
  isAdmin?: boolean
  onOpenAnalytics?: () => void
  todayItems?: DigestItem[]
}

function hourLabel(hour: number): string {
  const suffix = hour >= 12 ? 'PM' : 'AM'
  const h = hour % 12 === 0 ? 12 : hour % 12
  return `${h} ${suffix}`
}

function minuteOptions(current: number): number[] {
  if (MINUTES.includes(current)) return MINUTES
  return [...MINUTES, current].sort((a, b) => a - b)
}

export function SettingsScreen({
  onBack,
  isAdmin = false,
  onOpenAnalytics,
  todayItems = [],
}: SettingsScreenProps) {
  const { themeId, themes, setThemeId } = useTheme()
  const native = Capacitor.isNativePlatform()
  const [digest, setDigest] = useState<DailyDigestPrefs>(loadDailyDigestPrefs)
  const digestRef = useRef(digest)
  digestRef.current = digest
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [testNotice, setTestNotice] = useState<string | null>(null)
  const [exactDenied, setExactDenied] = useState(false)
  const scheduleHint = digestScheduleHint(todayItems, digest)

  useEffect(() => {
    if (!native || !digest.enabled) {
      setExactDenied(false)
      return
    }
    void hasExactAlarms().then((granted) => setExactDenied(!granted))
  }, [native, digest.enabled])

  async function updateDigest(patch: Partial<DailyDigestPrefs>) {
    const previous = digestRef.current
    const next = { ...previous, ...patch }
    digestRef.current = next
    setDigest(next)
    setPermissionError(null)
    saveDailyDigestPrefs(next)

    const turningOn = !previous.enabled && next.enabled
    if (!turningOn || !native) return

    try {
      const granted = await requestDailyDigestPermission()
      if (!granted) {
        const reverted = { ...digestRef.current, enabled: false }
        digestRef.current = reverted
        setDigest(reverted)
        saveDailyDigestPrefs(reverted)
        setPermissionError(
          'Notifications are off for Resuming. You can turn them on in system settings.',
        )
        return
      }
      const exact = await requestExactAlarms()
      setExactDenied(!exact)
    } catch (err) {
      const reverted = { ...digestRef.current, enabled: false }
      digestRef.current = reverted
      setDigest(reverted)
      saveDailyDigestPrefs(reverted)
      setPermissionError(
        err instanceof Error ? err.message : 'Could not enable notifications.',
      )
    }
  }

  async function sendTestPing() {
    setPermissionError(null)
    setTestNotice(null)
    try {
      await scheduleTestDigest()
      setTestNotice('A reminder will arrive in a few seconds.')
    } catch (err) {
      setPermissionError(
        err instanceof Error ? err.message : 'Could not send a test reminder.',
      )
    }
  }

  return (
    <div className="settings-screen">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="screen-heading">
        <div>
          <h2>Settings</h2>
          <p className="screen-sub">Theme, and a daily reminder if you want one.</p>
        </div>
      </div>

      <section className="today-section">
        <h3 className="section-label">Reminders</h3>
        <div className="digest-card">
          <div className="digest-toggle">
            <span className="activity-meta">
              <span className="activity-name">Daily reminder</span>
              <span className="activity-desc">
                One ping a day if something is still open. Silent if you&apos;re done.
              </span>
            </span>
            <button
              type="button"
              className={`digest-switch ${digest.enabled ? 'digest-switch-on' : ''}`}
              role="switch"
              aria-checked={digest.enabled}
              aria-label="Daily reminder"
              disabled={!native}
              onClick={() => void updateDigest({ enabled: !digest.enabled })}
            >
              <span className="digest-switch-knob" aria-hidden />
            </button>
          </div>

          {!native && (
            <p className="digest-hint">Available in the Android app. Per-activity alerts can wait.</p>
          )}

          {native && (
            <div className="field">
              <span className="field-label" id="digest-time-label">
                Time
              </span>
              <div className="field-row" role="group" aria-labelledby="digest-time-label">
                <select
                  className="field-input field-grow"
                  value={String(digest.hour)}
                  aria-label="Hour"
                  onChange={(event) =>
                    void updateDigest({ hour: Number(event.target.value) })
                  }
                >
                  {HOURS.map((hour) => (
                    <option key={hour} value={String(hour)}>
                      {hourLabel(hour)}
                    </option>
                  ))}
                </select>
                <select
                  className="field-input field-grow"
                  value={String(digest.minute)}
                  aria-label="Minute"
                  onChange={(event) =>
                    void updateDigest({ minute: Number(event.target.value) })
                  }
                >
                  {minuteOptions(digest.minute).map((minute) => (
                    <option key={minute} value={String(minute)}>
                      {String(minute).padStart(2, '0')}
                    </option>
                  ))}
                </select>
              </div>
              <p className="digest-hint">
                If everything due today is done before this time, you&apos;ll get nothing.
              </p>
              {scheduleHint && <p className="digest-hint digest-schedule">{scheduleHint}</p>}
              {exactDenied && (
                <div className="digest-exact">
                  <p className="digest-hint">
                    Turn on Alarms &amp; reminders so this ping can arrive on time.
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      void requestExactAlarms().then((granted) => setExactDenied(!granted))
                    }}
                  >
                    Allow exact alarms
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void sendTestPing()}
              >
                Send a test reminder
              </button>
              {testNotice && <p className="digest-hint">{testNotice}</p>}
            </div>
          )}

          {permissionError && <p className="error">{permissionError}</p>}
        </div>
      </section>

      <section className="today-section">
        <h3 className="section-label">Theme</h3>
        <ul className="theme-list">
          {themes.map((theme) => {
            const selected = theme.id === themeId
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  className={`theme-option ${selected ? 'theme-option-selected' : ''}`}
                  onClick={() => setThemeId(theme.id as ThemeId)}
                  aria-pressed={selected}
                >
                  <span className={`theme-swatch theme-swatch-${theme.id}`} aria-hidden />
                  <span className="activity-meta">
                    <span className="activity-name">
                      {theme.name}
                      {theme.id === DEFAULT_THEME ? ' · default' : ''}
                      <span className={`theme-mode-badge theme-mode-${theme.colorScheme}`}>
                        {theme.colorScheme}
                      </span>
                    </span>
                    <span className="activity-desc">{theme.description}</span>
                  </span>
                  <span className="theme-check" aria-hidden>
                    {selected ? '●' : '○'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {isAdmin && onOpenAnalytics && (
        <section className="today-section">
          <h3 className="section-label">Admin</h3>
          <button
            type="button"
            className="theme-option settings-nav-link"
            onClick={onOpenAnalytics}
          >
            <span className="activity-meta">
              <span className="activity-name">Analytics</span>
              <span className="activity-desc">Website traffic and page views</span>
            </span>
            <span className="activity-chevron" aria-hidden>
              ›
            </span>
          </button>
        </section>
      )}
    </div>
  )
}
