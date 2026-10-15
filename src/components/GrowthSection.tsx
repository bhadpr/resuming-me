import { useCallback, useEffect, useState } from 'react'
import { formatRetentionRate } from '../lib/analytics'
import {
  fetchGrowthMetrics,
  fetchGrowthSnapshots,
  growthWeeksToCsv,
  saveGrowthSnapshot,
  type GrowthMetrics,
  type GrowthSnapshot,
} from '../lib/growthMetrics'

function pct(rate: number | null): string {
  return formatRetentionRate(rate)
}

function num(value: number | null, digits = 1): string {
  return value == null ? '—' : value.toFixed(digits)
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="analytics-stat">
      <span className="analytics-stat-label">{label}</span>
      <span className="analytics-stat-value">{value}</span>
      <span className="analytics-stat-hint">{hint}</span>
    </div>
  )
}

/** The "track record" view: the few numbers an investor asks for, week by week and month by month. */
export function GrowthSection() {
  const [metrics, setMetrics] = useState<GrowthMetrics | null>(null)
  const [snapshots, setSnapshots] = useState<GrowthSnapshot[]>([])
  const [error, setError] = useState<string | null>(null)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  const loadSnapshots = useCallback(() => {
    return fetchGrowthSnapshots()
      .then((rows) => {
        setSnapshots(rows)
        setSnapshotError(null)
      })
      .catch((err) => {
        setSnapshots([])
        setSnapshotError(err instanceof Error ? err.message : 'Could not load the monthly history')
      })
  }, [])

  useEffect(() => {
    let mounted = true
    fetchGrowthMetrics(12)
      .then((result) => {
        if (mounted) setMetrics(result)
      })
      .catch((err) => {
        if (!mounted) return
        setMetrics(null)
        setError(err instanceof Error ? err.message : 'Could not load growth numbers')
      })
    void loadSnapshots()
    return () => {
      mounted = false
    }
  }, [loadSnapshots])

  async function saveNow() {
    setSaving(true)
    setNote(null)
    try {
      const day = await saveGrowthSnapshot()
      setNote(`Saved for ${day}. A day that already has a snapshot is kept as it was.`)
      await loadSnapshots()
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Could not save the snapshot')
    } finally {
      setSaving(false)
    }
  }

  async function copyCsv() {
    if (!metrics) return
    try {
      await navigator.clipboard.writeText(growthWeeksToCsv(metrics))
      setNote('Weekly numbers copied. Paste them into a spreadsheet.')
    } catch {
      setNote('Could not copy. Allow clipboard access and try again.')
    }
  }

  const h = metrics?.headline
  const weeks = metrics ? [...metrics.weeks].reverse() : []
  const cohorts = metrics ? [...metrics.cohorts].reverse() : []

  return (
    <section className="today-section">
      <h3 className="section-label">Growth</h3>
      <p className="screen-sub insights-hint">
        Signed-in people only, UTC days, last 12 weeks. Rates stay blank until enough days have passed.
      </p>
      {error && <p className="error">{error}</p>}
      {!error && !metrics && <p className="muted-center">Loading growth numbers…</p>}
      {metrics && h && (
        <>
          <section className="analytics-overview">
            <Stat label="Sign-ups" value={String(h.signups)} hint="12 weeks" />
            <Stat
              label="Onboarding done"
              value={pct(h.onboardingCompletion)}
              hint={`${h.onboardingFinished} of ${h.onboardingStarted} signed up`}
            />
            <Stat label="D1 / D7 / D30" value={`${pct(h.d1)} / ${pct(h.d7)} / ${pct(h.d30)}`} hint="Active on that day" />
            <Stat label="MAU" value={String(h.mau)} hint="Last 30 days" />
            <Stat
              label="DAU / MAU"
              value={pct(h.stickiness)}
              hint={`${num(h.avgDau, 1)} average daily · ${h.dauYesterday} yesterday`}
            />
            <Stat
              label="Check-ins / active user"
              value={num(h.checkInsPerActiveUserPerWeek, 1)}
              hint="Per week, last 4 weeks"
            />
            <Stat
              label="Resume rate"
              value={pct(h.resumeRate)}
              hint={`${h.resumed} of ${h.slips} slips back within 7 days`}
            />
          </section>

          <h4 className="section-label">By week</h4>
          <ul className="analytics-rank-list">
            {weeks.map((week) => (
              <li key={week.weekStart} className="analytics-rank-row">
                {week.weekStart} · {week.signups} new
                {week.sources.length > 0 &&
                  ` (${week.sources
                    .slice(0, 3)
                    .map((s) => `${s.source} ${s.count}`)
                    .join(', ')})`}{' '}
                · {week.activeUsers} active · {week.checkIns} check-ins · resumed {week.resumed}/{week.slips}
              </li>
            ))}
          </ul>

          {cohorts.length > 0 && (
            <>
              <h4 className="section-label">Retention by signup week</h4>
              <ul className="analytics-rank-list">
                {cohorts.map((row) => (
                  <li key={row.weekStart} className="analytics-rank-row">
                    Joined {row.weekStart} · {row.size} · D1 {pct(row.d1)} · D7 {pct(row.d7)} · D30 {pct(row.d30)}
                  </li>
                ))}
              </ul>
            </>
          )}

          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => void copyCsv()}>
              Copy weekly numbers (CSV)
            </button>
          </div>
        </>
      )}

      <h4 className="section-label">Monthly history</h4>
      <p className="screen-sub insights-hint">
        Saved automatically on the 1st of each month and kept for good. Usage events are deleted after 13
        months; these numbers are not.
      </p>
      {snapshotError && <p className="error">{snapshotError}</p>}
      {snapshots.length === 0 && !snapshotError && <p className="muted-center">No snapshots yet.</p>}
      {snapshots.length > 0 && (
        <ul className="analytics-rank-list">
          {snapshots.map((s) => (
            <li key={s.date} className="analytics-rank-row">
              {s.date} · {s.headline.signups} sign-ups · MAU {s.headline.mau} · DAU/MAU {pct(s.headline.stickiness)} ·
              D7 {pct(s.headline.d7)} · D30 {pct(s.headline.d30)} · resume {pct(s.headline.resumeRate)}
            </li>
          ))}
        </ul>
      )}
      <div>
        <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={() => void saveNow()}>
          {saving ? 'Saving…' : 'Save snapshot now'}
        </button>
      </div>
      {note && <p className="screen-sub insights-hint">{note}</p>}
    </section>
  )
}
