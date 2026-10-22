import { useEffect, useRef, useState, type ReactNode } from 'react'
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
import {
  emailReminderLine,
  loadCheckinOptOut,
  loadReminderEmails,
  loadReminderTime,
  saveCheckinOptOut,
  saveReminderEmails,
  saveReminderTime,
} from '../lib/checkinPrefs'
import { deleteCurrentAccount } from '../lib/deleteAccount'
import { REVIEW_WEEKDAYS } from '../lib/weeklyReview'
import { useLocale } from '../hooks/useLocale'
import { localeTag } from '../lib/i18n'
import { applyTextSize, readTextSize, TEXT_SIZES, type TextSize } from '../lib/textSize'
import { THEME_PREFERENCES } from '../lib/themes'
import { REMINDER_PARTS, readPartTimes, savePartTimes, type PartTimes } from '../lib/reminderSchedule'
import { LanguagePicker } from './LanguagePicker'
import { fetchMyMarketingGroups, type MyMarketingGroup } from '../lib/marketingData'
import { Icon, type IconName } from './Icon'
import './settings-ui.css'

function SettingsPanel({
  title,
  lead,
  children,
}: {
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <section className="st-panel">
      <div className="st-panel-head">
        <h3 className="st-panel-title">{title}</h3>
        {lead && <p className="st-panel-lead">{lead}</p>}
      </div>
      <div className="st-panel-body">{children}</div>
    </section>
  )
}

function SettingsLink({
  title,
  desc,
  onClick,
  icon,
  danger = false,
  disabled = false,
}: {
  title: string
  desc: string
  onClick?: () => void
  icon: IconName
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      className={`st-link ${danger ? 'st-link-danger' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      <span className="st-link-icon" aria-hidden>
        <Icon name={icon} />
      </span>
      <span className="st-link-text">
        <span className="st-link-title">{title}</span>
        <span className="st-link-desc">{desc}</span>
      </span>
      <span className="st-link-chevron" aria-hidden>
        <Icon name="chevron" />
      </span>
    </button>
  )
}
interface SettingsScreenProps {
  onBack: () => void
  isAdmin?: boolean
  onOpenAnalytics?: () => void
  onOpenAnalytics2?: () => void
  onOpenFeedback?: () => void
  onOpenSharedEvents?: () => void
  onOpenCommunity?: () => void
  onOpenSharedLists?: () => void
  onOpenGroups?: (groupId?: string) => void
  todayItems?: DigestItem[]
  onSignOut: () => void
  onOpenPrivacy: () => void
  page?: 'main' | 'reminders'
  onOpenReminders?: () => void
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

  if (!isAdmin && rows.length === 0) return null

  if (!isAdmin && rows.length > 0) {
    return (
      <SettingsPanel title={t('settings.yourGroup')}>
        {rows.map((row) => (
          <SettingsLink
            key={row.group.id}
            title={row.group.name}
            desc={t('settings.groupStats', {
              installs: row.counts.installs.toLocaleString('en-IN'),
              retained: row.counts.retained.toLocaleString('en-IN'),
            })}
            icon="activities"
            onClick={() => onOpen?.(row.group.id)}
          />
        ))}
      </SettingsPanel>
    )
  }

  return (
    <SettingsPanel title="Groups" lead="Installs and five-day returns from a shared link.">
      <SettingsLink
        title="Group numbers"
        desc="Installs and five-day returns"
        icon="activities"
        onClick={() => onOpen?.()}
      />
    </SettingsPanel>
  )
}

export function SettingsScreen({
  onBack,
  isAdmin = false,
  onOpenAnalytics,
  onOpenAnalytics2,
  onOpenFeedback,
  onOpenSharedEvents,
  onOpenCommunity,
  onOpenSharedLists,
  onOpenGroups,
  todayItems = [],
  onSignOut,
  onOpenPrivacy,
  page = 'main',
  onOpenReminders,
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
  const { preference, setPreference } = useTheme()
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
  const [reminderEmails, setReminderEmails] = useState(false)
  const [partTimes, setPartTimes] = useState<PartTimes>(readPartTimes)

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
    void loadReminderEmails(user.id)
      .then((on) => {
        if (mounted) setReminderEmails(on)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [user])

  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android' || !digest.enabled) {
      setExactDenied(false)
      return
    }
    void hasExactAlarms().then((granted) => setExactDenied(!granted))
  }, [digest.enabled])

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

  if (page === 'reminders') {
    return (
      <div className="settings-screen st">
        <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
          <Icon name="back" />
          {t('settings.back')}
        </button>

      {native && (
      <SettingsPanel title={t('settings.notifications')} lead={t('settings.dailyDesc')}>
        <div className="digest-card">
          <div className="digest-toggle">
            <span className="activity-meta">
              <span className="activity-name">{t('settings.daily')}</span>
              <span className="activity-desc">{t('settings.dailyDesc')}</span>
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
      </SettingsPanel>
      )}

      <SettingsPanel title={t('settings.emails')} lead={t('settings.checkinsDesc')}>
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
          {!native && (
            <div className="digest-toggle">
              <span className="activity-meta">
                <span className="activity-name">{t('settings.reminderEmails')}</span>
                <span className="activity-desc">{t('settings.reminderEmailsDesc')}</span>
              </span>
              <button
                type="button"
                className={`digest-switch ${reminderEmails ? 'digest-switch-on' : ''}`}
                role="switch"
                aria-checked={reminderEmails}
                aria-label={t('settings.reminderEmails')}
                onClick={() => {
                  if (!user) return
                  const next = !reminderEmails
                  setReminderEmails(next)
                  void saveReminderEmails(user.id, next).catch(() => setReminderEmails(!next))
                }}
              >
                <span className="digest-switch-knob" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </SettingsPanel>

      <SettingsPanel title={t('settings.review')} lead={t('settings.reviewDesc')}>
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
      </SettingsPanel>

      <SettingsPanel title={t('reminders.partTimes')} lead={t('reminders.partTimesHint')}>
        <div className="digest-card">
          {REMINDER_PARTS.map((part) => (
            <label key={part} className="field">
              <span className="field-label">{t(`reminders.${part}`)}</span>
              <input
                className="field-input"
                type="time"
                value={`${String(partTimes[part].hour).padStart(2, '0')}:${String(partTimes[part].minute).padStart(2, '0')}`}
                onChange={(event) => {
                  const match = /^(\d{2}):(\d{2})$/.exec(event.target.value)
                  if (!match) return
                  const next = { ...partTimes, [part]: { hour: Number(match[1]), minute: Number(match[2]) } }
                  setPartTimes(next)
                  savePartTimes(next)
                }}
              />
            </label>
          ))}
        </div>
      </SettingsPanel>

      <SettingsPanel title={t('settings.birthday')} lead={t('settings.birthdayHint')}>
        <div className="digest-card">
          <label className="field">
            <span className="field-label">{t('settings.birthdayDate')}</span>
            <input
              className="field-input"
              type="date"
              value={birthday ?? ''}
              onChange={(event) => onBirthday?.(event.target.value || null)}
            />
          </label>
          {birthday && (
            <button type="button" className="btn btn-ghost" onClick={() => onBirthday?.(null)}>
              {t('settings.birthdayClear')}
            </button>
          )}
        </div>
      </SettingsPanel>

      </div>
    )
  }

  return (
    <div className="settings-screen st">
      <header className="st-intro">
        <p className="st-intro-kicker">{user?.email ? t('settings.account') : t('settings.title')}</p>
        <h2 className="st-intro-title">{user?.email ?? t('settings.title')}</h2>
      </header>

      <SettingsPanel title={t('settings.appearance')} lead={t('settings.textSizeHint')}>
        <div className="st-block">
          <h4 className="st-block-title">{t('settings.textSize')}</h4>
          <div className="st-range" role="group" aria-label={t('settings.textSize')}>
            {TEXT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                className={`st-range-btn ${textSize === size ? 'st-range-btn-active' : ''}`}
                aria-pressed={textSize === size}
                onClick={() => {
                  setTextSize(size)
                  applyTextSize(size)
                }}
              >
                {t(size === 'normal' ? 'settings.textNormal' : 'settings.textLarge')}
              </button>
            ))}
          </div>
        </div>
        <div className="st-block">
          <h4 className="st-block-title">{t('language.label')}</h4>
          <LanguagePicker variant="chips" />
          <p className="st-hint">{t('language.hint')}</p>
        </div>
        <div className="st-block">
          <h4 className="st-block-title">{t('settings.themes')}</h4>
          <div className="st-themes" role="group" aria-label={t('settings.themes')}>
            {THEME_PREFERENCES.map((id) => (
              <button
                key={id}
                type="button"
                className={`st-theme ${preference === id ? 'st-theme-active' : ''}`}
                aria-pressed={preference === id}
                onClick={() => setPreference(id)}
              >
                <span className={`theme-swatch theme-swatch-${id}`} aria-hidden />
                <span className="st-theme-name">{t(`themes.${id}`)}</span>
              </button>
            ))}
          </div>
          <p className="st-hint st-theme-desc">{t(`themes.${preference}Desc`)}</p>
        </div>
      </SettingsPanel>

      <SettingsPanel title={t('settings.notifications')} lead={t('settings.remindersPageDesc')}>
        <SettingsLink
          title={t('settings.remindersPage')}
          desc={t('settings.remindersPageDesc')}
          icon="reminders"
          onClick={onOpenReminders}
        />
        {canUndoFreshStart && (
          <button type="button" className="btn btn-ghost" onClick={onUndoFreshStart}>
            {t('settings.undoFresh')}
          </button>
        )}
      </SettingsPanel>

      {((isAdmin && onOpenAnalytics) || (isAdmin && onOpenFeedback)) && (
        <SettingsPanel title="Admin" lead="Numbers and tools only you can see.">
          <div className="st-grid st-grid-2">
            {onOpenAnalytics && (
              <SettingsLink
                title="Visitors & growth"
                desc="Who visits, who signs up, who stays"
                icon="insights"
                onClick={onOpenAnalytics}
              />
            )}
            {onOpenAnalytics2 && (
              <SettingsLink
                title="App health"
                desc="Installs, who comes back, problems"
                icon="metrics"
                onClick={onOpenAnalytics2}
              />
            )}
            {onOpenFeedback && (
              <SettingsLink
                title="Feedback"
                desc="Ratings and comments people sent"
                icon="today"
                onClick={onOpenFeedback}
              />
            )}
            {onOpenSharedEvents && (
              <SettingsLink
                title="Shared events"
                desc="Reports, and switching an event off"
                icon="calendar"
                onClick={onOpenSharedEvents}
              />
            )}
            {onOpenCommunity && (
              <SettingsLink
                title="Community reminders"
                desc="Diwali, Christmas and other days people can pick"
                icon="reminders"
                onClick={onOpenCommunity}
              />
            )}
            {onOpenSharedLists && (
              <SettingsLink
                title="Reminder lists"
                desc="One link that adds many reminders"
                icon="share"
                onClick={onOpenSharedLists}
              />
            )}
          </div>
        </SettingsPanel>
      )}

      <GroupsSettingsLink isAdmin={Boolean(isAdmin)} onOpen={onOpenGroups} />

      <SettingsPanel title={t('settings.account')}>
        <SettingsLink
          title={t('settings.privacy')}
          desc={t('settings.privacyDesc')}
          icon="lock"
          onClick={onOpenPrivacy}
        />
        <SettingsLink
          title={exportBusy ? t('settings.exporting') : t('settings.export')}
          desc={t('settings.exportDesc')}
          icon="share"
          disabled={exportBusy || !user}
          onClick={() => void handleExport()}
        />
        {exportNotice && <p className="st-hint">{exportNotice}</p>}
        {exportError && <p className="error">{exportError}</p>}
        {user && (
          <button type="button" className="btn btn-secondary st-sign-out" onClick={() => void onSignOut()}>
            {t('settings.signOut')}
          </button>
        )}
        {!deleteOpen ? (
          <SettingsLink
            title={t('settings.delete')}
            desc={t('settings.deleteDesc')}
            icon="close"
            danger
            onClick={() => {
              setDeleteOpen(true)
              setDeleteConfirmText('')
              setDeleteError(null)
            }}
          />
        ) : (
          <div className="confirm-delete settings-delete-confirm st-danger">
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
      </SettingsPanel>
    </div>
  )
}
