import { useEffect, useMemo, useState } from 'react'
import { describeActivity, type Activity } from '../lib/activities'
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
import { formatMonthDay, freshStartCovering, listActivityComebacks, longestReturnedGap, showedUpDayCount } from '../lib/comeback'
import { addDays, todayLocalDate } from '../lib/dates'
import { getDayStatus } from '../lib/dayStatus'
import { isDeadlineOverdue } from '../lib/rollover'
import { shrinkOffer } from '../lib/weeklyReview'
import {
  findActivePause,
  type ActivityPauseRow,
  type PauseDuration,
} from '../lib/activityPauses'
import { DeadlineOverduePrompt } from './DeadlineOverduePrompt'
import { MicroStepsSection } from './MicroStepsSection'
import { ActivityInsightChart } from './ActivityInsightChart'
import type { MicroStep } from '../lib/microSteps'

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
  onShrink,
}: ActivityDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<ActivityChartWindowDays>(30)
  const [pauseOpen, setPauseOpen] = useState(false)
  const [expandedFresh, setExpandedFresh] = useState<string | null>(null)
  const [heatDate, setHeatDate] = useState<string | null>(null)

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
  const showedUp30 = useMemo(
    () => showedUpDayCount(activity, entries, today, 30, dayStatusOpts),
    [activity, entries, today, dayStatusOpts],
  )
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
  const shrink = shrinkOffer(activity)

  const overdue = isDeadlineOverdue(activity, entries, today)
  const showChart = activity.type !== 'deadline'
  const canPause = Boolean(onPause) && !activity.archived && activity.type !== 'deadline'
  const canResume = Boolean(onResume) && Boolean(activePause)

  return (
    <div className="activity-detail">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="detail-hero">
        <HabitMark name={activity.name} />
        <h2>{activity.name}</h2>
        <p className="screen-sub">{describeActivity(activity)}</p>
        {activity.archived && <span className="badge">Archived</span>}
        {activePause && <span className="badge">Paused</span>}
      </div>

      {heatDays.length > 0 && (
        <section className="heat-section">
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
            <p className="screen-sub">
              {heatDate}
              {entries.some((entry) => entry.activity_id === activity.id && entry.date === heatDate)
                ? ` · ${entries
                    .filter((entry) => entry.activity_id === activity.id && entry.date === heatDate)
                    .map((entry) => describeLogEntry(entry))
                    .join(', ')}`
                : ' · nothing logged'}
            </p>
          )}
          <div className="heat-legend">
            <span className="heat-legend-item">
              <span className="heat-cell heat-showed" aria-hidden />
              Showed up
            </span>
            <span className="heat-legend-item">
              <span className="heat-cell heat-missed" aria-hidden />
              Quiet
            </span>
            <span className="heat-legend-item">
              <span className="heat-cell heat-outline" aria-hidden />
              Not scheduled
            </span>
          </div>
        </section>
      )}

      {(canPause || canResume) && (
        <div className="detail-pause">
          {canResume ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void onResume?.()}
            >
              Resume habit
            </button>
          ) : pauseOpen ? (
            <div className="detail-pause-sheet">
              <p className="activity-desc">Pause for</p>
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
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setPauseOpen(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setPauseOpen(true)}
            >
              Pause
            </button>
          )}
          <p className="activity-desc">Pause. This habit stays hidden until you come back.</p>
          {activePause?.paused_until && (
            <p className="activity-desc">Until {activePause.paused_until}.</p>
          )}
        </div>
      )}

      {overdue && onMarkDeadlineComplete && onRescheduleDeadline && (
        <DeadlineOverduePrompt
          activity={activity}
          busy={busy}
          onMarkComplete={() => void onMarkDeadlineComplete()}
          onReschedule={(date) => void onRescheduleDeadline(date)}
        />
      )}

      {activity.type === 'deadline' && onBreakDown && (
        <MicroStepsSection activity={activity} busy={busy} onBreakDown={onBreakDown} />
      )}

      {showChart && (
        <>
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

          {loadingEntries ? (
            <p className="muted-center">Loading trend…</p>
          ) : (
            <>
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

              <dl className="detail-facts">
                <div>
                  <dt>Done</dt>
                  <dd>{seriesStats.done}</dd>
                </div>
                <div>
                  <dt>Partial</dt>
                  <dd>{seriesStats.partial}</dd>
                </div>
                <div>
                  <dt>Skipped</dt>
                  <dd>{seriesStats.skipped}</dd>
                </div>
                <div>
                  <dt>Open</dt>
                  <dd>{seriesStats.open}</dd>
                </div>
                {seriesStats.min != null && (
                  <>
                    <div>
                      <dt>Min</dt>
                      <dd>{formatSeriesValue(seriesStats.min, seriesStats.unit)}</dd>
                    </div>
                    <div>
                      <dt>Max</dt>
                      <dd>{formatSeriesValue(seriesStats.max!, seriesStats.unit)}</dd>
                    </div>
                    <div>
                      <dt>Avg</dt>
                      <dd>{formatSeriesValue(seriesStats.avg!, seriesStats.unit)}</dd>
                    </div>
                  </>
                )}
              </dl>
            </>
          )}
        </>
      )}

      <dl className="detail-facts">
        {activity.type !== 'deadline' && (
          <>
            <div>
              <dt>Comebacks (30d)</dt>
              <dd>{comebackHits.length}</dd>
            </div>
            <div>
              <dt>Longest gap returned from</dt>
              <dd>{longestGap == null ? '—' : `${longestGap} days`}</dd>
            </div>
            <div>
              <dt>Times shown up (30d)</dt>
              <dd>{showedUp30}</dd>
            </div>
          </>
        )}
        {activity.tracking_mode === 'timer' && (
          <div>
            <dt>Avg session</dt>
            <dd>{formatAvgSession(stats.averageSessionSeconds)}</dd>
          </div>
        )}
        <div>
          <dt>Type</dt>
          <dd>{activity.type.replace('_', ' ')}</dd>
        </div>
        <div>
          <dt>Tracking</dt>
          <dd>{activity.tracking_mode}</dd>
        </div>
        {activity.target_value != null && (
          <div>
            <dt>Target</dt>
            <dd>
              {activity.target_value}
              {activity.target_unit ? ` ${activity.target_unit}` : ''}
            </dd>
          </div>
        )}
        {activity.weekly_target != null && (
          <div>
            <dt>Weekly</dt>
            <dd>{activity.weekly_target}×</dd>
          </div>
        )}
        {activity.deadline && (
          <div>
            <dt>Deadline</dt>
            <dd>{activity.deadline}</dd>
          </div>
        )}
      </dl>

      <section className="history-section">
        <h3 className="section-label">History</h3>
        {loadingEntries ? (
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
                            {row.entry.updated_at && (
                              <span className="badge">edited</span>
                            )}
                          </span>
                          <span className="activity-chevron" aria-hidden>
                            ›
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

      {error && <p className="error">{error}</p>}

      <div className="detail-actions">
        <button type="button" className="btn btn-primary" onClick={onEdit} disabled={busy}>
          Edit habit
        </button>
        {shrink && onShrink && (
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => onShrink(shrink.value)}
          >
            Shrink to {shrink.value} {shrink.unit}
          </button>
        )}

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
              This permanently deletes <strong>{activity.name}</strong> and all its history.
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

function formatSeriesValue(value: number, unit: string): string {
  const n = Number.isInteger(value) ? value : Math.round(value * 10) / 10
  if (unit === 'min') return `${n} min`
  if (unit === '×') return `${n}×`
  if (unit === 'done') return String(n)
  return String(n)
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
