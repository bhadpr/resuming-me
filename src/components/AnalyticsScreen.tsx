import { useEffect, useState } from 'react'
import {
  fetchPageViewsForAnalytics,
  summarizePageViews,
  type AnalyticsSummary,
  type AnalyticsWindow,
  type NamedCount,
} from '../lib/analytics'

export function AnalyticsScreen() {
  const [window, setWindow] = useState<AnalyticsWindow>('7d')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchPageViewsForAnalytics(window)
      .then((rows) => {
        if (!mounted) return
        setSummary(summarizePageViews(rows, window))
      })
      .catch((err) => {
        if (!mounted) return
        setSummary(null)
        setError(err instanceof Error ? err.message : 'Could not load analytics')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [window])

  return (
    <div className="analytics-screen">
      <p className="screen-sub settings-lead">First-party website traffic for Resuming.</p>

      <div className="segmented window-toggle">
        <button
          type="button"
          className={`segmented-btn ${window === '7d' ? 'segmented-btn-active' : ''}`}
          onClick={() => setWindow('7d')}
        >
          7 days
        </button>
        <button
          type="button"
          className={`segmented-btn ${window === '30d' ? 'segmented-btn-active' : ''}`}
          onClick={() => setWindow('30d')}
        >
          30 days
        </button>
      </div>

      {error && <p className="error">{error}</p>}

      {loading || !summary ? (
        <p className="muted-center">{loading ? 'Loading analytics…' : 'No data yet.'}</p>
      ) : (
        <>
          <section className="analytics-overview">
            <StatCard label="Page views" value={formatInt(summary.totalViews)} hint={`${summary.from} → ${summary.to}`} />
            <StatCard label="Unique visitors" value={formatInt(summary.uniqueVisitors)} hint="By visitor id" />
            <StatCard label="Signed-in visitors" value={formatInt(summary.signedInVisitors)} hint="Distinct accounts" />
            <StatCard label="Views today" value={formatInt(summary.viewsToday)} hint="UTC day" />
          </section>

          <section className="today-section">
            <h3 className="section-label">Page views over time</h3>
            <div className="insights-pattern-chart analytics-chart">
              <div className="bar-grid analytics-daily-grid">
                {summary.daily.map((d) => (
                  <div key={d.date} className="bar-grid-item" title={`${d.date}: ${d.views} views`}>
                    <div className="bar-grid-track">
                      <div
                        className="bar-grid-fill bar-grid-fill-primary"
                        style={{ height: `${barHeight(d.views, summary.daily.map((x) => x.views))}%` }}
                      />
                    </div>
                    <span className="bar-grid-label">{d.date.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="today-section">
            <h3 className="section-label">Top pages</h3>
            <RankList rows={summary.topPages} empty="No page views in this window." />
          </section>

          <section className="today-section">
            <h3 className="section-label">Top referrers</h3>
            <RankList rows={summary.topReferrers} empty="No referrer data yet." />
          </section>

          <section className="analytics-split">
            <div className="today-section">
              <h3 className="section-label">Devices</h3>
              <RankList rows={summary.devices} empty="No device data." />
            </div>
            <div className="today-section">
              <h3 className="section-label">Browsers</h3>
              <RankList rows={summary.browsers} empty="No browser data." />
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint: string
}) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-label">{label}</span>
      <span className="analytics-stat-value">{value}</span>
      <span className="analytics-stat-hint">{hint}</span>
    </div>
  )
}

function RankList({ rows, empty }: { rows: NamedCount[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="muted-center">{empty}</p>
  }
  const max = Math.max(...rows.map((r) => r.count), 1)
  return (
    <ul className="analytics-rank-list">
      {rows.map((row) => (
        <li key={row.key} className="analytics-rank-row">
          <div className="analytics-rank-meta">
            <span className="activity-name">{row.label}</span>
            <span className="insights-rate">{formatInt(row.count)}</span>
          </div>
          <div className="progress-bar" aria-hidden>
            <div
              className="progress-bar-fill"
              style={{ width: `${Math.round((row.count / max) * 100)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function barHeight(count: number, all: number[]): number {
  const max = Math.max(...all, 1)
  return Math.round((count / max) * 100)
}

function formatInt(n: number): string {
  return new Intl.NumberFormat().format(n)
}
