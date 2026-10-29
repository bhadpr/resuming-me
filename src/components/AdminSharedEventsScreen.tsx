import { useEffect, useState } from 'react'
import { eventPhotoUrl } from '../lib/eventPhotoUrl'
import { formatFeedbackTime } from '../lib/feedback'
import {
  listSharedEventsForAdmin,
  setSharedEventSwitchedOff,
  sharedEventUrl,
  type AdminSharedEvent,
} from '../lib/sharedEvents'
import { EventPhoto } from './ReminderKindIcon'
import { SectionFold } from './MonthFold'

const STATUS_LABEL: Record<AdminSharedEvent['status'], string> = {
  active: 'Active',
  cancelled: 'Cancelled by the organizer',
  switched_off: 'Switched off',
}

export function AdminSharedEventsScreen() {
  const [rows, setRows] = useState<AdminSharedEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listSharedEventsForAdmin()
      .then((data) => {
        if (mounted) setRows(data)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Could not load shared events')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function toggle(row: AdminSharedEvent) {
    const off = row.status !== 'switched_off'
    setBusyId(row.id)
    setError(null)
    try {
      await setSharedEventSwitchedOff(row.id, off, row.photoPath)
      setRows((current) =>
        current.map((item) =>
          item.id === row.id
            ? { ...item, status: off ? 'switched_off' : 'active', photoPath: off ? null : item.photoPath }
            : item,
        ),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that event')
    } finally {
      setBusyId(null)
    }
  }

  const reported = rows.filter((row) => row.reports.total > 0).length

  return (
    <div className="analytics-screen">
      <p className="screen-sub settings-lead">
        Reported events first. Switching one off hides its page, stops alerts on every copy, and deletes its photo.
      </p>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">Loading shared events…</p>
      ) : (
        <>
          <section className="analytics-overview">
            <div className="analytics-stat">
              <span className="analytics-stat-label">Events</span>
              <span className="analytics-stat-value">{rows.length}</span>
              <span className="analytics-stat-hint">Latest 200</span>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat-label">Reported</span>
              <span className="analytics-stat-value">{reported}</span>
              <span className="analytics-stat-hint">At least one report</span>
            </div>
          </section>

          {rows.length === 0 ? (
            <p className="muted-center">No shared events yet.</p>
          ) : (
            <div className="month-folds">
              {rows.map((row) => (
                <SectionFold key={row.id} title={row.text} defaultOpen={false}>
                  <span className="analytics-stat-hint">{formatFeedbackTime(row.createdAt)}</span>
                  <EventPhoto src={eventPhotoUrl(row.photoPath)} alt="Event photo" />
                  {row.description && <p className="reminder-description">{row.description}</p>}
                  <p className="admin-feedback-who">
                    From {row.from} · {row.day} ·{' '}
                    <a href={sharedEventUrl(row.code)} target="_blank" rel="noreferrer">
                      /e/{row.code}
                    </a>
                  </p>
                  <p className="admin-feedback-who">
                    {STATUS_LABEL[row.status]}
                    {row.status === 'active' && !row.takingAdds ? ' · not taking new adds' : ''} · added by{' '}
                    {row.followers}
                  </p>
                  {row.reports.total > 0 && (
                    <p className="error">
                      {row.reports.total} {row.reports.total === 1 ? 'report' : 'reports'} · spam {row.reports.spam} ·
                      wrong or harmful {row.reports.harmful} · other {row.reports.other}
                    </p>
                  )}
                  {row.status !== 'cancelled' && (
                    <button
                      type="button"
                      className={`btn btn-sm ${row.status === 'switched_off' ? 'btn-secondary' : 'btn-ghost'}`}
                      disabled={busyId === row.id}
                      onClick={() => void toggle(row)}
                    >
                      {row.status === 'switched_off' ? 'Switch back on' : 'Switch off'}
                    </button>
                  )}
                </SectionFold>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
