import { useEffect, useState } from 'react'
import {
  fetchOnboardingEvents,
  fetchPageViewsForAnalytics,
  fetchProductAnalytics,
  fetchSignedInEmails,
  formatRetentionRate,
  formatSignInTime,
  summarizePageViews,
  type AnalyticsSummary,
  type AnalyticsWindow,
  type NamedCount,
  type ProductAnalyticsSummary,
  type SignedInAccount,
} from '../lib/analytics'
import { summarizeOnboardingFunnel } from '../lib/onboardingFunnel'
import { cohortRetention, fetchLoopEvents, summarizeComebackLoop } from '../lib/loopAnalytics'

export function AnalyticsScreen() {
  const [window, setWindow] = useState<AnalyticsWindow>('7d')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [product, setProduct] = useState<ProductAnalyticsSummary | null>(null)
  const [accounts, setAccounts] = useState<SignedInAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [productLoading, setProductLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [productError, setProductError] = useState<string | null>(null)
  const [funnel, setFunnel] = useState<ReturnType<typeof summarizeOnboardingFunnel> | null>(null)
  const [funnelError, setFunnelError] = useState<string | null>(null)
  const [loop, setLoop] = useState<ReturnType<typeof summarizeComebackLoop> | null>(null)
  const [cohorts, setCohorts] = useState<ReturnType<typeof cohortRetention>>([])
  const [loopError, setLoopError] = useState<string | null>(null)

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

  useEffect(() => {
    let mounted = true
    setProductLoading(true)
    setProductError(null)
    fetchProductAnalytics(window)
      .then((rows) => {
        if (!mounted) return
        setProduct(rows)
      })
      .catch((err) => {
        if (!mounted) return
        setProduct(null)
        setProductError(
          err instanceof Error ? err.message : 'Could not load product analytics',
        )
      })
      .finally(() => {
        if (mounted) setProductLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setFunnelError(null)
    fetchOnboardingEvents(window)
      .then((rows) => {
        if (!mounted) return
        setFunnel(summarizeOnboardingFunnel(rows))
      })
      .catch((err) => {
        if (!mounted) return
        setFunnel(null)
        setFunnelError(err instanceof Error ? err.message : 'Could not load the funnel')
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setLoopError(null)
    fetchLoopEvents(90)
      .then((rows) => {
        if (!mounted) return
        const active = new Set(rows.map((row) => row.userId).filter((id): id is string => Boolean(id))).size
        setLoop(summarizeComebackLoop(rows, active))
        setCohorts(
          cohortRetention({
            signups: rows
              .filter((row) => row.name === 'signup_completed' && row.userId)
              .map((row) => ({ userId: row.userId as string, at: row.createdAt })),
            showedUp: rows
              .filter((row) => (row.name === 'log_created' || row.name === 'app_opened') && row.userId)
              .map((row) => ({ userId: row.userId as string, at: row.createdAt })),
            asOf: new Date().toISOString().slice(0, 10),
          }),
        )
      })
      .catch((err) => {
        if (!mounted) return
        setLoop(null)
        setCohorts([])
        setLoopError(err instanceof Error ? err.message : 'Could not load the comeback loop')
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setAccountsError(null)
    fetchSignedInEmails()
      .then((rows) => {
        if (!mounted) return
        setAccounts(rows)
      })
      .catch((err) => {
        if (!mounted) return
        setAccounts([])
        setAccountsError(
          err instanceof Error ? err.message : 'Could not load signed-in emails',
        )
      })
    return () => {
      mounted = false
    }
  }, [])

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

      <section className="today-section">
        <h3 className="section-label">Product</h3>
        <p className="screen-sub insights-hint">
          Sign-ups, retention, logs, and comebacks from first-party events.
        </p>
        {productError && <p className="error">{productError}</p>}
        {productLoading || !product ? (
          <p className="muted-center">
            {productLoading ? 'Loading product metrics…' : 'No product data yet.'}
          </p>
        ) : (
          <section className="analytics-overview">
            <StatCard
              label="Sign-ups"
              value={formatInt(product.signups)}
              hint="signup_completed"
            />
            <StatCard
              label="D1 retention"
              value={formatRetentionRate(product.d1Retention)}
              hint="Returned next day"
            />
            <StatCard
              label="D7 retention"
              value={formatRetentionRate(product.d7Retention)}
              hint="Returned on day 7"
            />
            <StatCard
              label="Logs / active user"
              value={
                product.logsPerActiveUser == null
                  ? '—'
                  : formatDecimal(product.logsPerActiveUser)
              }
              hint={`${formatInt(product.logEvents)} logs · ${formatInt(product.activeUsers)} users`}
            />
            <StatCard
              label="Comebacks"
              value={formatInt(product.comebackCount)}
              hint="After 3+ day gap"
            />
          </section>
        )}
      </section>

      <section className="today-section">
        <h3 className="section-label">Comeback loop</h3>
        <p className="screen-sub insights-hint">Last 90 days. Not a controlled test.</p>
        {loopError && <p className="error">{loopError}</p>}
        {loop && (
          <ul className="analytics-rank-list">
            <li className="analytics-rank-row">
              Comebacks per active user ·{' '}
              {loop.comebacksPerActiveUser == null ? '—' : loop.comebacksPerActiveUser.toFixed(1)}
            </li>
            <li className="analytics-rank-row">
              Returned after a gap, card shown · {loop.returnedWithCard}
            </li>
            <li className="analytics-rank-row">
              Returned after a gap, card not shown · {loop.returnedWithoutCard}
            </li>
            <li className="analytics-rank-row">
              Review open rate · {loop.reviewOpenRate == null ? '—' : `${Math.round(loop.reviewOpenRate * 100)}%`}
            </li>
            <li className="analytics-rank-row">
              Review to action · {loop.reviewActionRate == null ? '—' : `${Math.round(loop.reviewActionRate * 100)}%`}
            </li>
            <li className="analytics-rank-row">{loop.caveat}</li>
          </ul>
        )}
        {cohorts.length > 0 && (
          <ul className="analytics-rank-list">
            {cohorts.slice(0, 6).map((row) => (
              <li key={row.weekStart} className="analytics-rank-row">
                Joined {row.weekStart} · {row.size} · week 2 {formatRetentionRate(row.week2)} · week 4{' '}
                {formatRetentionRate(row.week4)} · week 8 {formatRetentionRate(row.week8)}
              </li>
            ))}
          </ul>
        )}
      </section>

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

      <section className="today-section">
        <h3 className="section-label">Onboarding</h3>
        <p className="screen-sub insights-hint">
          Funnel, first-week logs, and median time to the first resume.
        </p>
        {funnelError && <p className="error">{funnelError}</p>}
        {funnel && (
          <ul className="analytics-rank-list">
            <li className="analytics-rank-row">Started · {funnel.started}</li>
            {funnel.steps.map((step) => (
              <li key={step.step} className="analytics-rank-row">
                Step {step.step} · {step.people}
              </li>
            ))}
            <li className="analytics-rank-row">Timer started · {funnel.timerStarted}</li>
            <li className="analytics-rank-row">Timer finished · {funnel.timerCompleted}</li>
            <li className="analytics-rank-row">Timer skipped · {funnel.timerSkipped}</li>
            <li className="analytics-rank-row">
              Reminder yes / no · {funnel.reminderSet} / {funnel.reminderNone}
            </li>
            <li className="analytics-rank-row">Sign-in shown · {funnel.signinShown}</li>
            <li className="analytics-rank-row">Sign-ups · {funnel.signups}</li>
            <li className="analytics-rank-row">
              Median seconds to first resume · {funnel.medianSecondsToFirstResume ?? '—'}
            </li>
            <li className="analytics-rank-row">
              Logged on day 2 / 3 / 7 · {funnel.loggedDay2} / {funnel.loggedDay3} / {funnel.loggedDay7}
            </li>
          </ul>
        )}
      </section>

      <section className="today-section">
        <h3 className="section-label">Signed-in Google accounts</h3>
        <p className="screen-sub insights-hint">
          {accounts.length === 0
            ? 'Emails from Google sign-in.'
            : `${accounts.length} account${accounts.length === 1 ? '' : 's'}`}
        </p>
        {accountsError ? (
          <p className="error">{accountsError}</p>
        ) : accounts.length === 0 ? (
          <p className="muted-center">No Google sign-ins yet.</p>
        ) : (
          <ul className="analytics-rank-list">
            {accounts.map((account) => (
              <li key={account.email} className="analytics-rank-row">
                <div className="analytics-rank-meta">
                  <span className="activity-name analytics-email">{account.email}</span>
                  <span className="insights-rate">
                    {formatSignInTime(account.lastSignInAt)}
                  </span>
                </div>
                <p className="analytics-account-counts">
                  {formatCount(account.activityCount, 'activity', 'activities')}
                  {' · '}
                  {formatCount(account.metricCount, 'number', 'numbers')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
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

function formatDecimal(n: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    minimumFractionDigits: 0,
  }).format(n)
}

function formatCount(n: number, one: string, many: string): string {
  return `${formatInt(n)} ${n === 1 ? one : many}`
}
