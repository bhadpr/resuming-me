import { useEffect, useMemo, useState } from 'react'
import { describeActivity, type Activity } from '../lib/activities'
import { visibleName } from '../lib/catalogName'
import { useLocale } from '../hooks/useLocale'
import { HabitMark } from './HabitMark'
import type { LogEntry } from '../lib/logs'
import {
  computeActivityStats,
  describeLogEntry,
  formatAvgSession,
} from '../lib/stats'
import {
  buildActivityInsightSeriesForDays,
  computeActivitySeriesStats,
  type ActivityChartWindowDays,
  type DayStatusOpts,
} from '../lib/insights'
import {
  buildActivityHistory,
  formatHistoryDay,
  formatQuietRange,
} from '../lib/activityHistory'
import { formatMonthDay, freshStartCovering, listActivityComebacks, longestReturnedGap } from '../lib/comeback'
import { addDays, todayLocalDate } from '../lib/dates'
import { getDayStatus } from '../lib/dayStatus'
import { isDeadlineOverdue } from '../lib/rollover'
import {
  findActivePause,
  type ActivityPauseRow,
  type PauseDuration,
} from '../lib/activityPauses'
import { DeadlineOverduePrompt } from './DeadlineOverduePrompt'
import { MicroStepsSection } from './MicroStepsSection'
import { ActivityInsightChart } from './ActivityInsightChart'
import { microStepsAvailable, type MicroStep } from '../lib/microSteps'
import { Icon } from './Icon'
import { habitTemplateId } from '../data/habitArt'
import { isListedVital } from '../lib/vitalKey'
import { tracksDistance } from '../lib/healthDistance'
import { SessionDistanceLine, SessionDistanceSuffix } from './SessionDistance'
import { StepsWeek } from './StepsWeek'
import { DEFAULT_STEP_GOAL } from '../lib/steps'
import './activity-detail-ui.css'

const PAUSE_OPTIONS: { duration: PauseDuration; label: string }[] = [
  { duration: '1_week', label: '1 week' },
  { duration: '2_weeks', label: '2 weeks' },
  { duration: 'until_resume', label: 'Until I resume' },
]

function heatClass(status: string): string {
  if (status === 'done' || status === 'partial') return 'showed'
  if (status === 'skipped' || status === 'rest') return 'outline'
  if (status === 'paused') return 'paused'
  if (status === 'missed') return 'missed'
  if (status === 'fresh') return 'outline'
  return 'open'
}

function heatWords(status: string): string {
  if (status === 'done' || status === 'partial') return 'showed up'
  if (status === 'missed') return 'quiet'
  if (status === 'paused') return 'paused'
  return 'not scheduled'
}

interface ActivityDetailProps {
  activity: Activity
  entries: LogEntry[]
  pauses?: ActivityPauseRow[]
  dayStatusOpts?: DayStatusOpts
  loadingEntries?: boolean
  busy?: boolean
  error?: string | null
  onEdit: () => void
  onBack: () => void
  onArchive: () => Promise<void>
  onUnarchive: () => Promise<void>
  onDelete: () => Promise<void>
  onUpdateEntry: (
    entryId: string,
    updates: { date?: string; duration_seconds?: number | null; note?: string | null },
  ) => Promise<void>
  onDeleteEntry: (entryId: string) => Promise<void>
  onMarkDeadlineComplete?: () => Promise<void>
  onRescheduleDeadline?: (newDeadline: string) => Promise<void>
  onBreakDown?: () => Promise<{ steps?: MicroStep[]; error?: string }>
  onPause?: (duration: PauseDuration) => Promise<void>
  onResume?: () => Promise<void>
  onShrink?: (value: number) => void
  /** Clipart or photo for a habit named on this device. */
  icon?: string | null
  photo?: string | null
}

export function ActivityDetail({
  activity,
  entries,
  pauses = [],
  dayStatusOpts,
  loadingEntries = false,
  busy = false,
  error = null,
  onEdit,
  onBack,
  onArchive,
  onUnarchive,
  onDelete,
  onUpdateEntry,
  onDeleteEntry,
  onMarkDeadlineComplete,
  onRescheduleDeadline,
  onBreakDown,
  onPause,
  onResume,
  icon = null,
  photo = null,
}: ActivityDetailProps) {
  const { locale, t } = useLocale()
  const name = visibleName(activity, locale)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<ActivityChartWindowDays>(30)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [expandedFresh, setExpandedFresh] = useState<string | null>(null)
  const [heatDate, setHeatDate] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const today = todayLocalDate()
  const activePause = findActivePause(pauses, activity.id, today)

  const stats = useMemo(
    () => computeActivityStats(activity, entries),
    [activity, entries],
  )

  const series = useMemo(
    () =>
      buildActivityInsightSeriesForDays(
        activity,
        entries,
        windowDays,
        today,
        dayStatusOpts,
      ),
    [activity, entries, windowDays, today, dayStatusOpts],
  )

  const seriesStats = useMemo(
    () => computeActivitySeriesStats(series, windowDays),
    [series, windowDays],
  )

  const historyGroups = useMemo(
    () => buildActivityHistory(activity, entries, today, dayStatusOpts),
    [activity, entries, today, dayStatusOpts],
  )
  const comebackHits = useMemo(
    () => listActivityComebacks(activity, entries, today, 30, dayStatusOpts),
    [activity, entries, today, dayStatusOpts],
  )
  const longestGap = longestReturnedGap(comebackHits)
  const heatDays = useMemo(() => {
    if (activity.type === 'deadline') return []
    const created = activity.created_at.slice(0, 10)
    const mine = entries.filter((entry) => entry.activity_id === activity.id)
    const days: { date: string; status: string }[] = []
    for (let offset = 89; offset >= 0; offset -= 1) {
      const date = addDays(today, -offset)
      if (date < created) continue
      if (
        !dayStatusOpts?.showEverything &&
        freshStartCovering(date, dayStatusOpts?.freshStarts ?? [])
      ) {
        days.push({ date, status: 'fresh' })
        continue
      }
      const status = getDayStatus({
        activity,
        entriesForDay: mine,
        date,
        today,
        timezone: 'UTC',
        restDates: dayStatusOpts?.restDates,
        pauses: dayStatusOpts?.pauses,
      }).status
      days.push({ date, status })
    }
    return days
  }, [activity, entries, today, dayStatusOpts])

  const overdue = isDeadlineOverdue(activity, entries, today)
  const showChart = activity.type !== 'deadline' && habitTemplateId(activity) !== 'steps'
  const canPause = Boolean(onPause) && !activity.archived && activity.type !== 'deadline'
  const canResume = Boolean(onResume) && Boolean(activePause)
  const showsDistance = tracksDistance(habitTemplateId(activity))
  const stepsHabit = habitTemplateId(activity) === 'steps'
  const vitalPage = isListedVital(activity)
  const ownDescription = vitalPage ? activity.why_matters?.trim() : ''
  const showedInWindow = seriesStats.done + seriesStats.partial
  const scheduledInWindow = showedInWindow + seriesStats.skipped + seriesStats.open
  const historyCount = historyGroups.reduce((total, group) => {
    return (
      total +
      group.rows.filter((row) => row.kind === 'entry' || row.kind === 'count').length
    )
  }, 0)

  return (
    <div className="activity-detail ad">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <Icon name="back" />
        Back
      </button>

      <div className="ad-hero">
        <HabitMark name={name} templateId={activity.template_id} icon={icon} photo={photo} />
        <div className="ad-hero-text">
          <h2>{name}</h2>
          <p className="screen-sub">{ownDescription || describeActivity(activity)}</p>
          {activity.archived && <span className="badge">Archived</span>}
          {activePause && <span className="badge badge-paused">{t('list.paused')}</span>}
        </div>
      </div>
      <div className="detail-top-actions">
        <button type="button" className="btn btn-primary" onClick={onEdit} disabled={busy}>
          {t('metricDetail.edit')}
        </button>
      </div>
      {activePause?.paused_until && (
        <p className="activity-desc">Paused until {activePause.paused_until}.</p>
      )}

      {stepsHabit && <StepsWeek goal={activity.target_value ?? DEFAULT_STEP_GOAL} />}

      {overdue && onMarkDeadlineComplete && onRescheduleDeadline && (
        <DeadlineOverduePrompt
          activity={activity}
          busy={busy}
          onMarkComplete={() => void onMarkDeadlineComplete()}
          onReschedule={(date) => void onRescheduleDeadline(date)}
        />
      )}

      {activity.type === 'deadline' && onBreakDown && microStepsAvailable() && (
        <MicroStepsSection activity={activity} busy={busy} onBreakDown={onBreakDown} />
      )}

      {showChart && (
        <section className="ad-story">
          <div className="ad-story-head">
            <div className="segmented window-toggle">
              {([7, 30, 90] as const).map((days) => (
                <button
                  key={days}
                  type="button"
                  className={`segmented-btn ${windowDays === days ? 'segmented-btn-active' : ''}`}
                  onClick={() => setWindowDays(days)}
                >
                  {days}d
                </button>
              ))}
            </div>
          </div>
          <div className="ad-kpis">
            <div className="ad-kpi">
              <span className="ad-kpi-value">
                {scheduledInWindow === 0 ? '—' : `${showedInWindow}/${scheduledInWindow}`}
              </span>
              <span className="ad-kpi-label">{t('insights.kpiShowed')}</span>
            </div>
            <div className="ad-kpi">
              <span className="ad-kpi-value">{comebackHits.length}</span>
              <span className="ad-kpi-label">{t('insights.kpiComebacks')}</span>
            </div>
            <div className="ad-kpi">
              <span className="ad-kpi-value">{longestGap == null ? '—' : `${longestGap}d`}</span>
              <span className="ad-kpi-label">Longest return</span>
            </div>
          </div>
          {activity.tracking_mode === 'timer' && stats.averageSessionSeconds != null && (
            <p className="ad-note">Avg session {formatAvgSession(stats.averageSessionSeconds)}</p>
          )}
          {loadingEntries ? (
            <p className="muted-center">Loading trend…</p>
          ) : (
            <ActivityInsightChart
              points={series}
              windowLabel={`${windowDays}-day`}
              target={
                activity.tracking_mode === 'checkbox'
                  ? 1
                  : activity.target_unit === 'seconds'
                    ? (activity.target_value ?? 0) / 60
                    : activity.target_value
              }
            />
          )}
        </section>
      )}

      {heatDays.length >= 7 && !stepsHabit && (
        <section className="heat-section ad-heat">
          <h3 className="section-label">Last 90 days</h3>
          <div className="heat-scroll">
            <div className="heat-row" role="list">
              {heatDays.map((day) => (
                <button
                  key={day.date}
                  type="button"
                  role="listitem"
                  className={`heat-cell heat-${heatClass(day.status)} ${heatDate === day.date ? 'heat-selected' : ''}`}
                  aria-label={`${day.date}, ${heatWords(day.status)}`}
                  onClick={() => setHeatDate((current) => (current === day.date ? null : day.date))}
                />
              ))}
            </div>
          </div>
          {heatDate && (
            <p className="ad-note">
              {formatHistoryDay(heatDate)}
              {entries.some((entry) => entry.activity_id === activity.id && entry.date === heatDate)
                ? ` · ${entries
                    .filter((entry) => entry.activity_id === activity.id && entry.date === heatDate)
                    .map((entry) => describeLogEntry(entry))
                    .join(', ')}`
                : ' · nothing logged'}
            </p>
          )}
        </section>
      )}

      {!stepsHabit && (
        <section className={`history-section ${historyOpen ? 'is-open' : ''}`}>
          <button
            type="button"
            className="history-toggle"
            aria-expanded={historyOpen}
            onClick={() => setHistoryOpen((open) => !open)}
          >
            <h3 className="section-label">
              History
              {historyCount > 0 && <span className="ad-history-count">{historyCount}</span>}
            </h3>
            <span className="activity-chevron" aria-hidden>
              <Icon name="chevron" />
            </span>
          </button>
          {historyOpen && showsDistance && (
            <SessionDistanceLine
              entries={entries.filter((entry) => entry.activity_id === activity.id)}
              showTotal={false}
            />
          )}
          {!historyOpen ? null : loadingEntries ? (
            <p className="muted-center">Loading history…</p>
          ) : historyGroups.length === 0 ? (
            <p className="muted-center">No log entries yet.</p>
          ) : (
            <div className="history-groups">
              {historyGroups.map((group) => (
                <section key={group.monthKey} className="history-month">
                  <h4 className="history-month-header">{group.monthLabel}</h4>
                  <ul className="history-list">
                    {group.rows.map((row) =>
                      row.kind === 'quiet' ? (
                        <li key={row.id} className="history-item history-item-quiet">
                          <span className="history-row history-row-quiet">
                            <span className="history-date">
                              {formatQuietRange(row.from, row.to)}
                            </span>
                          </span>
                        </li>
                      ) : row.kind === 'count' ? (
                        <li key={row.id} className="history-item">
                          <span className="history-row">
                            <span className="history-date">{formatHistoryDay(row.date)}</span>
                            <span className="history-desc">{row.label}</span>
                          </span>
                        </li>
                      ) : row.kind === 'fresh' ? (
                        <li key={row.id} className="history-item history-item-quiet">
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              setExpandedFresh((current) => (current === row.id ? null : row.id))
                            }
                          >
                            Fresh start · {formatMonthDay(row.startedOn)} · Before your fresh start · {row.days} days · tap to {expandedFresh === row.id ? 'hide' : 'show'}
                          </button>
                          {expandedFresh === row.id && (
                            <ul className="history-list">
                              {entries
                                .filter(
                                  (entry) =>
                                    entry.activity_id === activity.id &&
                                    entry.date >= row.coversFrom &&
                                    entry.date <= row.coversTo,
                                )
                                .map((entry) => (
                                  <li key={entry.id} className="history-item">
                                    <span className="history-date">{formatHistoryDay(entry.date)}</span>
                                    <span>{describeLogEntry(entry)}</span>
                                  </li>
                                ))}
                            </ul>
                          )}
                        </li>
                      ) : editingId === row.entry.id ? (
                        <li key={row.entry.id} className="history-item">
                          <LogEntryEditor
                            entry={row.entry}
                            busy={busy}
                            onCancel={() => setEditingId(null)}
                            onSave={async (updates) => {
                              await onUpdateEntry(row.entry.id, updates)
                              setEditingId(null)
                            }}
                            onDelete={async () => {
                              await onDeleteEntry(row.entry.id)
                              setEditingId(null)
                            }}
                          />
                        </li>
                      ) : (
                        <li key={row.entry.id} className="history-item">
                          <button
                            type="button"
                            className="history-row"
                            onClick={() => setEditingId(row.entry.id)}
                          >
                            <span className="history-date">
                              {formatHistoryDay(row.entry.date)}
                            </span>
                            <span className="history-desc">
                              {describeLogEntry(row.entry)}
                              {showsDistance && (
                                <SessionDistanceSuffix entry={row.entry} />
                              )}
                              {row.entry.updated_at && (
                                <span className="badge">edited</span>
                              )}
                            </span>
                            <span className="activity-chevron" aria-hidden>
                              <Icon name="chevron" />
                            </span>
                          </button>
                        </li>
                      ),
                    )}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </section>
      )}

      {error && <p className="error">{error}</p>}

      <div className="detail-actions">
        {canResume ? (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void onResume?.()}
          >
            Resume habit
          </button>
        ) : canPause ? (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              aria-expanded={pauseOpen}
              onClick={() => setPauseOpen((open) => !open)}
            >
              Pause
            </button>
            {pauseOpen && (
              <div className="detail-pause-sheet">
                <p className="activity-desc">Pause for — it stays hidden from Today until you come back.</p>
                <div className="detail-pause-options">
                  {PAUSE_OPTIONS.map(({ duration, label }) => (
                    <button
                      key={duration}
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => {
                        void onPause?.(duration)
                        setPauseOpen(false)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : null}

        {activity.archived ? (
          <div className="detail-archive">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onUnarchive()}
              disabled={busy}
            >
              Show on Today again
            </button>
            <p className="activity-desc">Hidden from Today. History was never lost.</p>
          </div>
        ) : (
          <div className="detail-archive">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => onArchive()}
              disabled={busy}
            >
              Hide from Today
            </button>
            <p className="activity-desc">
              Hide from Today. History stays. Delete is what removes it.
            </p>
          </div>
        )}

        {!confirmDelete ? (
          <button
            type="button"
            className="btn btn-danger-ghost"
            onClick={() => setConfirmDelete(true)}
            disabled={busy}
          >
            Delete permanently…
          </button>
        ) : (
          <div className="confirm-delete">
            <p>
              This permanently deletes <strong>{name}</strong> and all its history.
              This can&apos;t be undone.
            </p>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmDelete(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() => onDelete()}
                disabled={busy}
              >
                {busy ? 'Deleting…' : 'Delete forever'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function LogEntryEditor({
  entry,
  busy,
  onCancel,
  onSave,
  onDelete,
}: {
  entry: LogEntry
  busy: boolean
  onCancel: () => void
  onSave: (updates: {
    date?: string
    duration_seconds?: number | null
    note?: string | null
  }) => Promise<void>
  onDelete: () => Promise<void>
}) {
  const [date, setDate] = useState(entry.date)
  const [minutes, setMinutes] = useState(
    entry.duration_seconds != null
      ? String(Math.round((entry.duration_seconds / 60) * 10) / 10)
      : '',
  )
  const [note, setNote] = useState(entry.note ?? '')
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    setDate(entry.date)
    setMinutes(
      entry.duration_seconds != null
        ? String(Math.round((entry.duration_seconds / 60) * 10) / 10)
        : '',
    )
    setNote(entry.note ?? '')
  }, [entry])

  return (
    <div className="log-editor">
      <label className="field">
        <span className="field-label">Date</span>
        <input
          className="field-input"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>

      {entry.type === 'session' && (
        <label className="field">
          <span className="field-label">Duration (minutes)</span>
          <input
            className="field-input"
            type="number"
            min={0.1}
            step={0.1}
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
          />
        </label>
      )}

      {(entry.type === 'postponed' || entry.type === 'completed') && (
        <label className="field">
          <span className="field-label">Note</span>
          <input
            className="field-input"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Optional"
          />
        </label>
      )}

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy}
          onClick={() =>
            void onSave({
              date,
              duration_seconds:
                entry.type === 'session'
                  ? Math.round(Number(minutes) * 60)
                  : undefined,
              note:
                entry.type === 'postponed' || entry.type === 'completed'
                  ? note || null
                  : undefined,
            })
          }
        >
          Save
        </button>
      </div>

      {!confirmDelete ? (
        <button
          type="button"
          className="btn btn-danger-ghost"
          disabled={busy}
          onClick={() => setConfirmDelete(true)}
        >
          Delete entry…
        </button>
      ) : (
        <div className="confirm-delete">
          <p>Delete this log entry? This can&apos;t be undone.</p>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setConfirmDelete(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => void onDelete()}
              disabled={busy}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
