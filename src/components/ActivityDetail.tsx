import { useEffect, useMemo, useState } from 'react'
import { describeActivity, type Activity } from '../lib/activities'
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
import { isDeadlineOverdue } from '../lib/rollover'
import { todayLocalDate } from '../lib/dates'
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
}: ActivityDetailProps) {
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [windowDays, setWindowDays] = useState<ActivityChartWindowDays>(30)
  const [pauseOpen, setPauseOpen] = useState(false)

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
    () => buildActivityHistory(entries, today),
    [entries, today],
  )

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
        <span className="detail-emoji" aria-hidden>
          {activity.emoji}
        </span>
        <h2>{activity.name}</h2>
        <p className="screen-sub">{describeActivity(activity)}</p>
        {activity.archived && <span className="badge">Archived</span>}
        {activePause && <span className="badge">Paused</span>}
      </div>

      {(canPause || canResume) && (
        <div className="detail-pause">
          {canResume ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void onResume?.()}
            >
              Resume activity
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
          {activePause && (
            <p className="activity-desc">
              Hidden from Today
              {activePause.paused_until
                ? ` until ${activePause.paused_until}`
                : ' until you resume'}
              .
            </p>
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
              <ActivityInsightChart points={series} windowLabel={`${windowDays}-day`} />

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
        <div>
          <dt>Put off (30d)</dt>
          <dd>{stats.postponementsLast30}</dd>
        </div>
        <div>
          <dt>Put off (all)</dt>
          <dd>{stats.postponementsAllTime}</dd>
        </div>
        {activity.type !== 'deadline' && (
          <div>
            <dt>Comebacks (30d)</dt>
            <dd>{stats.comebacksLast30}</dd>
          </div>
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
          Edit activity
        </button>

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
