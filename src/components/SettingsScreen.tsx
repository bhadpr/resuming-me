import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'
import {
  digestScheduleHint,
  formatTimeInput,
  loadDailyDigestPrefs,
  parseTimeInput,
  saveDailyDigestPrefs,
  withDigestTimes,
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
import { loadCheckinOptOut, loadReminderTime, saveCheckinOptOut, saveReminderTime, emailReminderLine } from '../lib/checkinPrefs'
import { deleteCurrentAccount } from '../lib/deleteAccount'
import { REVIEW_WEEKDAYS } from '../lib/weeklyReview'
import { useLocale } from '../hooks/useLocale'
import { localeTag } from '../lib/i18n'
import { applyTextSize, readTextSize, TEXT_SIZES, type TextSize } from '../lib/textSize'
import { LanguagePicker } from './LanguagePicker'
import { fetchMyMarketingGroups, type MyMarketingGroup } from '../lib/marketingData'
import { Icon } from './Icon'
interface SettingsScreenProps {
  onBack: () => void
  isAdmin?: boolean
  onOpenAnalytics?: () => void
  onOpenFeedback?: () => void
  onOpenGroups?: (groupId?: string) => void
  onOpenThemes?: () => void
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

function GroupsSettingsLink({
  isAdmin,
  onOpen,
}: {
  isAdmin: boolean
  onOpen?: (groupId?: string) => void
}) {
  const { t } = useLocale()
  const [rows, setRows] = useState<MyMarketingGroup[]>([])

  useEffect(() => {
    if (isAdmin) return
    let cancel = false
    void fetchMyMarketingGroups()
      .then((next) => {
        if (!cancel) setRows(next)
      })
      .catch(() => {
        if (!cancel) setRows([])
      })
    return () => {
      cancel = true
    }
  }, [isAdmin])

  if (!isAdmin && rows.length > 0) {
    return (
      <section className="today-section">
        <h3 className="section-label">{t('settings.yourGroup')}</h3>
        {rows.map((row) => (
          <button
            key={row.group.id}
            type="button"
            className="theme-option settings-nav-link"
            onClick={() => onOpen?.(row.group.id)}
          >
            <span className="activity-meta">
              <span className="activity-name">{row.group.name}</span>
              <span className="activity-desc">
                {t('settings.groupStats', {
                  installs: row.counts.installs.toLocaleString('en-IN'),
                  retained: row.counts.retained.toLocaleString('en-IN'),
                })}
              </span>
            </span>
            <span className="activity-chevron" aria-hidden>
              <Icon name="chevron" />
            </span>
          </button>
        ))}
      </section>
    )
  }

  return (
    <section className="today-section">
      <h3 className="section-label">Groups</h3>
      <button
        type="button"
        className="theme-option settings-nav-link"
        onClick={() => onOpen?.()}
      >
        <span className="activity-meta">
          <span className="activity-name">Group numbers</span>
          <span className="activity-desc">Installs and five-day returns</span>
        </span>
        <span className="activity-chevron" aria-hidden>
          <Icon name="chevron" />
        </span>
      </button>
    </section>
  )
}

export function SettingsScreen({
  onBack,
  isAdmin = false,
  onOpenAnalytics,
  onOpenFeedback,
  onOpenGroups,
  onOpenThemes,
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
  const { t, locale } = useLocale()
  const { preference } = useTheme()
  const [textSize, setTextSize] = useState<TextSize>(readTextSize)
  const weekdayNames = REVIEW_WEEKDAYS.map((_, index) =>
    new Date(2024, 0, 7 + index).toLocaleDateString(localeTag(locale), { weekday: 'long' }),
  )
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
  const [reminderTime, setReminderTime] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    let mounted = true
    void Promise.all([loadCheckinOptOut(user.id), loadReminderTime(user.id)])
      .then(([off, time]) => {
        if (!mounted) return
        setCheckinsOff(off)
        setReminderTime(time)
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
    let next: DailyDigestPrefs = { ...previous, ...patch }
    if (patch.times) {
      next = withDigestTimes(next, patch.times)
    } else if (patch.hour != null || patch.minute != null) {
      const currentTimes = previous.times?.length
        ? previous.times
        : [{ hour: previous.hour, minute: previous.minute }]
      const times = currentTimes.map((item, index) =>
        index === 0 ? { hour: next.hour, minute: next.minute } : item,
      )
      next = withDigestTimes(next, times)
    } else {
      next = withDigestTimes(next, next.times?.length ? next.times : [{ hour: next.hour, minute: next.minute }])
    }
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
        setPermissionError(t('settings.notifOff'))
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
        err instanceof Error ? err.message : t('settings.notifFailed'),
      )
    }
  }

  async function sendTestPing() {
    setPermissionError(null)
    setTestNotice(null)
    try {
      await scheduleTestDigest()
      setTestNotice(t('settings.testSent'))
    } catch (err) {
      setPermissionError(
        err instanceof Error ? err.message : t('settings.testFailed'),
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
      setExportNotice(t('settings.exported', { file: filename }))
    } catch (err) {
      setExportError(err instanceof Error ? err.message : t('settings.exportFailed'))
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
      setDeleteError(err instanceof Error ? err.message : t('settings.deleteFailed'))
      setDeleteBusy(false)
    }
  }

  return (
    <div className="settings-screen">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <Icon name="back" />
        {t('settings.back')}
      </button>

      <GroupsSettingsLink isAdmin={Boolean(isAdmin)} onOpen={onOpenGroups} />

      <section className="today-section">
        <h3 className="section-label">{t('settings.notifications')}</h3>
        <div className="digest-card">
          <div className="digest-toggle">
            <span className="activity-meta">
              <span className="activity-name">{t('settings.daily')}</span>
              <span className="activity-desc">
                {t('settings.dailyDesc')}
                {native ? '' : ` ${t('settings.dailyWeb')}`}
              </span>
            </span>
            {native ? (
              <button
                type="button"
                className={`digest-switch ${digest.enabled ? 'digest-switch-on' : ''}`}
                role="switch"
                aria-checked={digest.enabled}
                aria-label={t('settings.daily')}
                onClick={() => void updateDigest({ enabled: !digest.enabled })}
              >
                <span className="digest-switch-knob" aria-hidden />
              </button>
            ) : null}
          </div>

          {native && (
            <div className="field">
              <span className="field-label">{t('settings.times')}</span>
              <div className="reminder-times">
                {(digest.times ?? [{ hour: digest.hour, minute: digest.minute }]).map(
                  (time, index) => (
                    <div key={`digest-time-${index}`} className="reminder-time-row">
                      <input
                        className="field-input time-input"
                        type="time"
                        value={formatTimeInput(time.hour, time.minute)}
                        aria-label={index === 0 ? t('settings.reminderTime') : t('settings.reminderN', { n: index + 1 })}
                        onChange={(event) => {
                          const parsed = parseTimeInput(event.target.value)
                          if (!parsed) return
                          const current = digest.times ?? [
                            { hour: digest.hour, minute: digest.minute },
                          ]
                          const times = current.map((item, i) => (i === index ? parsed : item))
                          void updateDigest({
                            hour: times[0].hour,
                            minute: times[0].minute,
                            times,
                          })
                        }}
                      />
                      {(digest.times?.length ?? 1) > 1 && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          aria-label={t('settings.removeN', { n: index + 1 })}
                          onClick={() => {
                            const current = digest.times ?? [
                              { hour: digest.hour, minute: digest.minute },
                            ]
                            const times = current.filter((_, i) => i !== index)
                            void updateDigest({
                              hour: times[0].hour,
                              minute: times[0].minute,
                              times,
                            })
                          }}
                        >
                          {t('settings.remove')}
                        </button>
                      )}
                    </div>
                  ),
                )}
              </div>
              {(digest.times?.length ?? 1) < 5 && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    const current = digest.times ?? [
                      { hour: digest.hour, minute: digest.minute },
                    ]
                    const times = [...current, { hour: 12, minute: 0 }]
                    void updateDigest({
                      hour: times[0].hour,
                      minute: times[0].minute,
                      times,
                    })
                  }}
                >
                  {t('settings.addTime')}
                </button>
              )}
              <p className="digest-hint">
                {t('settings.nudgeHint')}
              </p>
              {scheduleHint && <p className="digest-hint digest-schedule">{scheduleHint}</p>}
              {exactDenied && (
                <div className="digest-exact">
                  <p className="digest-hint">
                    {t('settings.exactHint')}
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      void requestExactAlarms().then((granted) => setExactDenied(!granted))
                    }}
                  >
                    {t('settings.exactAllow')}
                  </button>
                </div>
              )}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void sendTestPing()}
              >
                {t('settings.test')}
              </button>
              {testNotice && <p className="digest-hint">{testNotice}</p>}
            </div>
          )}

          {permissionError && <p className="error">{permissionError}</p>}
        </div>
      </section>

      <section className="today-section">
        <h3 className="section-label">{t('settings.emails')}</h3>
        <div className="digest-card">
          <div className="digest-toggle">
            <span className="activity-meta">
              <span className="activity-name">{t('settings.checkins')}</span>
              <span className="activity-desc">
                {reminderTime && !checkinsOff
                  ? emailReminderLine(reminderTime)
                  : t('settings.checkinsDesc')}
              </span>
            </span>
            <button
              type="button"
              className={`digest-switch ${checkinsOff ? '' : 'digest-switch-on'}`}
              role="switch"
              aria-checked={!checkinsOff}
              aria-label={t('settings.checkins')}
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
          {!checkinsOff && (
            <label className="field">
              <span className="field-label">{t('settings.emailTime')}</span>
              <input
                className="field-input"
                type="time"
                value={reminderTime ?? ''}
                onChange={(event) => {
                  const next = event.target.value
                  if (!next) return
                  const previous = reminderTime
                  setReminderTime(next)
                  if (!user) return
                  void saveReminderTime(user.id, next).catch(() => setReminderTime(previous))
                }}
              />
            </label>
          )}
        </div>
      </section>

      <section className="today-section">
        <h3 className="section-label">{t('settings.review')}</h3>
        <div className="digest-card">
          <div className="digest-toggle">
            <span className="activity-meta">
              <span className="activity-name">{t('settings.review')}</span>
              <span className="activity-desc">{t('settings.reviewDesc')}</span>
            </span>
            <button
              type="button"
              className={`digest-switch ${reviewsOff ? '' : 'digest-switch-on'}`}
              role="switch"
              aria-checked={!reviewsOff}
              aria-label={t('settings.review')}
              onClick={() => onReviewsOff?.(!reviewsOff)}
            >
              <span className="digest-switch-knob" aria-hidden />
            </button>
          </div>
          <label className="field">
            <span className="field-label">{t('settings.reviewDay')}</span>
            <select
              className="field-input"
              value={reviewWeekday}
              onChange={(event) => onReviewSchedule?.(Number(event.target.value), reviewTime)}
            >
              {REVIEW_WEEKDAYS.map((name, index) => (
                <option key={name} value={index}>
                  {weekdayNames[index]}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field-label">{t('settings.reviewTime')}</span>
            <input
              className="field-input"
              type="time"
              value={reviewTime}
              onChange={(event) => onReviewSchedule?.(reviewWeekday, event.target.value || '18:00')}
            />
          </label>
        </div>
      </section>

      <section className="today-section">
        <h3 className="section-label">{t('settings.birthday')}</h3>
        <div className="digest-card">
          <label className="field">
            <span className="field-label">{t('settings.birthdayDate')}</span>
            <input
              className="field-input"
              type="date"
              value={birthday ?? ''}
              onChange={(event) => onBirthday?.(event.target.value || null)}
            />
            <p className="digest-hint">
              {t('settings.birthdayHint')}
            </p>
          </label>
          {birthday && (
            <button type="button" className="btn btn-ghost" onClick={() => onBirthday?.(null)}>
              {t('settings.birthdayClear')}
            </button>
          )}
        </div>
      </section>

      <section className="today-section">
        <h3 className="section-label">{t('settings.history')}</h3>
        <div className="digest-card">
          <div className="settings-row">
            <div>
              <span className="activity-name">{t('settings.covered')}</span>
              <p className="screen-sub">
                {t('settings.coveredDesc')}
              </p>
            </div>
            <button
              type="button"
              className={`btn ${showEverything ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onShowEverything?.(!showEverything)}
            >
              {showEverything ? t('settings.on') : t('settings.off')}
            </button>
          </div>
          {canUndoFreshStart && (
            <button type="button" className="btn btn-ghost" onClick={onUndoFreshStart}>
              {t('settings.undoFresh')}
            </button>
          )}
        </div>
      </section>

      <section className="today-section">
        <h3 className="section-label">{t('language.label')}</h3>
        <LanguagePicker />
        <p className="activity-desc">{t('language.hint')}</p>
      </section>

      <section className="today-section">
        <h3 className="section-label">{t('settings.textSize')}</h3>
        <div className="segmented" role="group" aria-label={t('settings.textSize')}>
          {TEXT_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              className={`segmented-btn ${textSize === size ? 'segmented-btn-active' : ''}`}
              aria-pressed={textSize === size}
              onClick={() => {
                setTextSize(size)
                applyTextSize(size)
              }}
            >
              {t(size === 'normal' ? 'settings.textNormal' : size === 'large' ? 'settings.textLarge' : 'settings.textXlarge')}
            </button>
          ))}
        </div>
        <p className="activity-desc">{t('settings.textSizeHint')}</p>
      </section>

      <section className="today-section">
        <h3 className="section-label">{t('settings.appearance')}</h3>
        <button
          type="button"
          className="theme-option settings-nav-link"
          onClick={onOpenThemes}
        >
          <span className="activity-meta">
            <span className="activity-name">{t('settings.themes')}</span>
            <span className="activity-desc">{t(`themes.${preference}`)}</span>
          </span>
          <span className="activity-chevron" aria-hidden>
            <Icon name="chevron" />
          </span>
        </button>
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
                <Icon name="chevron" />
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
                <Icon name="chevron" />
              </span>
            </button>
          )}
        </section>
      ) : null}

      <section className="today-section">
        <h3 className="section-label">{t('settings.account')}</h3>
        <button
          type="button"
          className="theme-option settings-nav-link"
          onClick={onOpenPrivacy}
        >
          <span className="activity-meta">
            <span className="activity-name">{t('settings.privacy')}</span>
            <span className="activity-desc">{t('settings.privacyDesc')}</span>
          </span>
          <span className="activity-chevron" aria-hidden>
            <Icon name="chevron" />
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
              {exportBusy ? t('settings.exporting') : t('settings.export')}
            </span>
            <span className="activity-desc">{t('settings.exportDesc')}</span>
          </span>
          <span className="activity-chevron" aria-hidden>
            <Icon name="chevron" />
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
              <span className="activity-name">{t('settings.delete')}</span>
              <span className="activity-desc">{t('settings.deleteDesc')}</span>
            </span>
            <span className="activity-chevron" aria-hidden>
              <Icon name="chevron" />
            </span>
          </button>
        ) : (
          <div className="confirm-delete settings-delete-confirm">
            <p>{t('settings.deleteWarn')}</p>
            <p>
              {t('settings.deleteCopy')}{' '}
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => void handleExport()}
                disabled={exportBusy || deleteBusy || !user}
              >
                {exportBusy ? t('settings.exporting') : t('settings.export')}
              </button>
            </p>
            <div className="field">
              <label className="field-label" htmlFor="delete-confirm-input">
                {t('settings.deleteType')}
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
                {t('settings.cancel')}
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => void handleDeleteAccount()}
                disabled={deleteBusy || deleteConfirmText !== 'DELETE'}
              >
                {deleteBusy ? t('settings.deleting') : t('settings.deleteForever')}
              </button>
            </div>
          </div>
        )}

        <button type="button" className="btn btn-primary btn-lg settings-sign-out" onClick={() => void onSignOut()}>
          {t('settings.signOut')}
        </button>
      </section>
    </div>
  )
}
