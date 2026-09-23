import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import { DEFAULT_THEME, type ThemeId } from '../lib/themes'
import {
  digestScheduleHint,
  formatTimeInput,
  loadDailyDigestPrefs,
  parseTimeInput,
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
import { downloadUserDataExport } from '../lib/exportData'
import { loadCheckinOptOut, saveCheckinOptOut } from '../lib/checkinPrefs'
import { deleteCurrentAccount } from '../lib/deleteAccount'
import { REVIEW_WEEKDAYS } from '../lib/weeklyReview'

interface SettingsScreenProps {
  onBack: () => void
  isAdmin?: boolean
  onOpenAnalytics?: () => void
  onOpenFeedback?: () => void
  todayItems?: DigestItem[]
  onSignOut: () => void
  onOpenPrivacy: () => void
  showEverything?: boolean
  onShowEverything?: (on: boolean) => void
  canUndoFreshStart?: boolean
  onUndoFreshStart?: () => void
  birthday?: string | null
  onBirthday?: (value: string | null) => void
  reviewWeekday?: number
  reviewTime?: string
  onReviewSchedule?: (weekday: number, time: string) => void
  reviewsOff?: boolean
  onReviewsOff?: (off: boolean) => void
}

export function SettingsScreen({
  onBack,
  isAdmin = false,
  onOpenAnalytics,
  onOpenFeedback,
  todayItems = [],
  onSignOut,
  onOpenPrivacy,
  showEverything = false,
  onShowEverything,
  canUndoFreshStart = false,
  onUndoFreshStart,
  birthday = null,
  onBirthday,
  reviewWeekday = 0,
  reviewTime = '18:00',
  onReviewSchedule,
  reviewsOff = false,
  onReviewsOff,
}: SettingsScreenProps) {
  const { user } = useAuth()
  const { themeId, themes, setThemeId } = useTheme()
  const native = Capacitor.isNativePlatform()
  const [digest, setDigest] = useState<DailyDigestPrefs>(loadDailyDigestPrefs)
  const digestRef = useRef(digest)
  digestRef.current = digest
  const [permissionError, setPermissionError] = useState<string | null>(null)
  const [testNotice, setTestNotice] = useState<string | null>(null)
  const [exactDenied, setExactDenied] = useState(false)
  const [exportBusy, setExportBusy] = useState(false)
  const [exportNotice, setExportNotice] = useState<string | null>(null)
  const [exportError, setExportError] = useState<string | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const scheduleHint = digestScheduleHint(todayItems, digest)
  const [checkinsOff, setCheckinsOff] = useState(false)

  useEffect(() => {
    if (!user) return
    let mounted = true
    void loadCheckinOptOut(user.id)
      .then((off) => {
        if (mounted) setCheckinsOff(off)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [user])

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

  async function handleExport() {
    if (!user?.id) return
    setExportBusy(true)
    setExportError(null)
    setExportNotice(null)
    try {
      const filename = await downloadUserDataExport(user.id)
      setExportNotice(`Downloaded ${filename}`)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed.')
    } finally {
      setExportBusy(false)
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmText !== 'DELETE') return
    setDeleteBusy(true)
    setDeleteError(null)
    try {
      await deleteCurrentAccount()
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Could not delete account.')
      setDeleteBusy(false)
    }
  }

  return (
    <div className="settings-screen">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

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
              <input
                className="field-input time-input"
                type="time"
                value={formatTimeInput(digest.hour, digest.minute)}
                aria-labelledby="digest-time-label"
                onChange={(event) => {
                  const parsed = parseTimeInput(event.target.value)
                  if (!parsed) return
                  void updateDigest(parsed)
                }}
              />
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
        <div className="digest-card">
          <div className="digest-toggle">
            <span className="activity-meta">
              <span className="activity-name">Day 2, 3, and 7 emails</span>
              <span className="activity-desc">
                A short note if you opted in. Off stops them, including from the email link.
              </span>
            </span>
            <button
              type="button"
              className={`digest-switch ${checkinsOff ? '' : 'digest-switch-on'}`}
              role="switch"
              aria-checked={!checkinsOff}
              aria-label="Day 2, 3, and 7 emails"
              onClick={() => {
                if (!user) return
                const next = !checkinsOff
                setCheckinsOff(next)
                void saveCheckinOptOut(user.id, next).catch(() => setCheckinsOff(!next))
              }}
            >
              <span className="digest-switch-knob" aria-hidden />
            </button>
          </div>
        </div>
      </section>

      <section className="today-section">
        <h3 className="section-label">Weekly review</h3>
        <div className="digest-card">
          <div className="digest-toggle">
            <span className="activity-meta">
              <span className="activity-name">Weekly review</span>
              <span className="activity-desc">A short look at the week. Off hides the card and the email.</span>
            </span>
            <button
              type="button"
              className={`digest-switch ${reviewsOff ? '' : 'digest-switch-on'}`}
              role="switch"
              aria-checked={!reviewsOff}
              aria-label="Weekly review"
              onClick={() => onReviewsOff?.(!reviewsOff)}
            >
              <span className="digest-switch-knob" aria-hidden />
            </button>
          </div>
        </div>
        <label className="field">
          <span className="field-label">Review day</span>
          <select
            className="field-input"
            value={reviewWeekday}
            onChange={(event) => onReviewSchedule?.(Number(event.target.value), reviewTime)}
          >
            {REVIEW_WEEKDAYS.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Review time</span>
          <input
            className="field-input"
            type="time"
            value={reviewTime}
            onChange={(event) => onReviewSchedule?.(reviewWeekday, event.target.value || '18:00')}
          />
        </label>
        <label className="field">
          <span className="field-label">Birthday, optional</span>
          <input
            className="field-input"
            type="date"
            value={birthday ?? ''}
            onChange={(event) => onBirthday?.(event.target.value || null)}
          />
        </label>
        {birthday && (
          <button type="button" className="btn btn-ghost" onClick={() => onBirthday?.(null)}>
            Clear birthday
          </button>
        )}
      </section>

      <section className="today-section">
        <h3 className="section-label">History</h3>
        <div className="settings-row">
          <div>
            <span className="activity-name">Show everything</span>
            <p className="screen-sub">Reveal days hidden by a fresh start.</p>
          </div>
          <button
            type="button"
            className={`btn ${showEverything ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => onShowEverything?.(!showEverything)}
          >
            {showEverything ? 'On' : 'Off'}
          </button>
        </div>
        {canUndoFreshStart && (
          <button type="button" className="btn btn-ghost" onClick={onUndoFreshStart}>
            Undo fresh start
          </button>
        )}

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
                  {selected ? (
                    <span className="theme-check" aria-hidden>
                      ✓
                    </span>
                  ) : (
                    <span className="theme-check theme-check-empty" aria-hidden />
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {(isAdmin && onOpenAnalytics) || (isAdmin && onOpenFeedback) ? (
        <section className="today-section">
          <h3 className="section-label">Admin</h3>
          {onOpenAnalytics && (
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
          )}
          {onOpenFeedback && (
            <button
              type="button"
              className="theme-option settings-nav-link"
              onClick={onOpenFeedback}
            >
              <span className="activity-meta">
                <span className="activity-name">Feedback</span>
                <span className="activity-desc">Ratings and comments people sent</span>
              </span>
              <span className="activity-chevron" aria-hidden>
                ›
              </span>
            </button>
          )}
        </section>
      ) : null}

      <section className="today-section">
        <h3 className="section-label">Account</h3>
        <button
          type="button"
          className="theme-option settings-nav-link"
          onClick={onOpenPrivacy}
        >
          <span className="activity-meta">
            <span className="activity-name">Privacy</span>
            <span className="activity-desc">How Resuming uses your data</span>
          </span>
          <span className="activity-chevron" aria-hidden>
            ›
          </span>
        </button>

        <button
          type="button"
          className="theme-option settings-nav-link"
          onClick={() => void handleExport()}
          disabled={exportBusy || !user}
        >
          <span className="activity-meta">
            <span className="activity-name">
              {exportBusy ? 'Exporting…' : 'Export my data'}
            </span>
            <span className="activity-desc">
              Download a ZIP with your activities, logs, and metrics
            </span>
          </span>
          <span className="activity-chevron" aria-hidden>
            ›
          </span>
        </button>
        {exportNotice && <p className="digest-hint settings-account-hint">{exportNotice}</p>}
        {exportError && <p className="error">{exportError}</p>}

        {!deleteOpen ? (
          <button
            type="button"
            className="theme-option settings-nav-link settings-delete-link"
            onClick={() => {
              setDeleteOpen(true)
              setDeleteConfirmText('')
              setDeleteError(null)
            }}
          >
            <span className="activity-meta">
              <span className="activity-name">Delete my account</span>
              <span className="activity-desc">Permanently erase your Resuming data</span>
            </span>
            <span className="activity-chevron" aria-hidden>
              ›
            </span>
          </button>
        ) : (
          <div className="confirm-delete settings-delete-confirm">
            <p>
              This permanently deletes your account, activities, metrics, log history, and
              feedback tied to this Google sign-in. It cannot be undone.
            </p>
            <p>
              Want a copy first?{' '}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleExport()}
                disabled={exportBusy || deleteBusy || !user}
              >
                {exportBusy ? 'Exporting…' : 'Export my data'}
              </button>
            </p>
            <div className="field">
              <label className="field-label" htmlFor="delete-confirm-input">
                Type DELETE to confirm
              </label>
              <input
                id="delete-confirm-input"
                className="field-input"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
                disabled={deleteBusy}
                placeholder="DELETE"
              />
            </div>
            {deleteError && <p className="error">{deleteError}</p>}
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDeleteOpen(false)
                  setDeleteConfirmText('')
                  setDeleteError(null)
                }}
                disabled={deleteBusy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteBusy || deleteConfirmText !== 'DELETE'}
              >
                {deleteBusy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}

        <button type="button" className="btn btn-primary btn-lg settings-sign-out" onClick={() => void onSignOut()}>
          Sign out
        </button>
      </section>
    </div>
  )
}
