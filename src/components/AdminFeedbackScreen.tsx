import { useEffect, useMemo, useState } from 'react'
import {
  fetchFeedbackForAdmin,
  formatFeedbackTime,
  summarizeFeedback,
  type FeedbackRow,
} from '../lib/feedback'

export function AdminFeedbackScreen() {
  const [rows, setRows] = useState<FeedbackRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchFeedbackForAdmin()
      .then((data) => {
        if (!mounted) return
        setRows(data)
      })
      .catch((err) => {
        if (!mounted) return
        setRows([])
        setError(err instanceof Error ? err.message : 'Could not load feedback')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const summary = useMemo(() => summarizeFeedback(rows), [rows])

  return (
    <div className="analytics-screen">
      <p className="screen-sub settings-lead">What people wrote in Feedback.</p>

      {error && <p className="error">{error}</p>}

      {loading ? (
        <p className="muted-center">Loading feedback…</p>
      ) : (
        <>
          <section className="analytics-overview">
            <div className="analytics-stat">
              <span className="analytics-stat-label">Responses</span>
              <span className="analytics-stat-value">{summary.count}</span>
              <span className="analytics-stat-hint">Newest first</span>
            </div>
            <div className="analytics-stat">
              <span className="analytics-stat-label">Average</span>
              <span className="analytics-stat-value">
                {summary.averageRating == null ? '—' : summary.averageRating.toFixed(1)}
              </span>
              <span className="analytics-stat-hint">Out of 5</span>
            </div>
          </section>

          {rows.length === 0 ? (
            <p className="muted-center">No feedback yet.</p>
          ) : (
            <ul className="admin-feedback-list">
              {rows.map((row) => (
                <li key={row.id} className="admin-feedback-card">
                  <div className="admin-feedback-head">
                    <span className="admin-feedback-stars" aria-label={`${row.rating} of 5`}>
                      {'★'.repeat(row.rating)}
                      {'☆'.repeat(5 - row.rating)}
                    </span>
                    <span className="analytics-stat-hint">{formatFeedbackTime(row.created_at)}</span>
                  </div>
                  <p className="admin-feedback-who">
                    {row.name || row.email || 'Anonymous'}
                    {row.name && row.email ? ` · ${row.email}` : ''}
                  </p>
                  {row.liked && (
                    <FeedbackField label="Liked" text={row.liked} />
                  )}
                  {row.improve && (
                    <FeedbackField label="Could be better" text={row.improve} />
                  )}
                  {row.wish && (
                    <FeedbackField label="Wish" text={row.wish} />
                  )}
                  {!row.liked && !row.improve && !row.wish && (
                    <p className="muted-center">Rating only.</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

function FeedbackField({ label, text }: { label: string; text: string }) {
  return (
    <div className="admin-feedback-field">
      <span className="admin-feedback-label">{label}</span>
      <p>{text}</p>
    </div>
  )
}
