import { useCallback, useEffect, useMemo, useState } from 'react'
import { formatRetentionRate } from '../lib/analytics'
import { heatStrength, heatStyle, percentText } from '../lib/analyticsViz'
import {
  fetchGrowthMetrics,
  fetchGrowthSnapshots,
  growthWeeksToCsv,
  saveGrowthSnapshot,
  type GrowthMetrics,
  type GrowthSnapshot,
} from '../lib/growthMetrics'
import {
  Block,
  Columns,
  Donut,
  Empty,
  ErrorNote,
  Grid,
  Kpi,
  KpiGrid,
  Loading,
  Note,
  Panel,
} from './analytics/ui'

function pct(rate: number | null): string {
  return formatRetentionRate(rate)
}

function num(value: number | null, digits = 1): string {
  return value == null ? '—' : value.toFixed(digits)
}

function RateCell({ rate }: { rate: number | null }) {
  if (rate == null) return <td className="an-dash">—</td>
  return <td style={heatStyle(heatStrength(rate, 0.6))}>{pct(rate)}</td>
}

export interface GrowthViewProps {
  metrics: GrowthMetrics | null
  snapshots: GrowthSnapshot[]
  error: string | null
  snapshotError: string | null
  saving: boolean
  note: string | null
  onSave: () => void
  onCopy: () => void
}

/** The "track record" view: the few numbers an investor asks for, week by week and month by month. */
export function GrowthView({ metrics, snapshots, error, snapshotError, saving, note, onSave, onCopy }: GrowthViewProps) {
  const h = metrics?.headline
  const weeksOldestFirst = useMemo(() => metrics?.weeks ?? [], [metrics])
  const cohorts = metrics ? [...metrics.cohorts].reverse() : []

  const sources = useMemo(() => {
    const totals = new Map<string, number>()
    for (const week of weeksOldestFirst) {
      for (const entry of week.sources) totals.set(entry.source, (totals.get(entry.source) ?? 0) + entry.count)
    }
    return [...totals].map(([key, count]) => ({ key, label: key, count }))
  }, [weeksOldestFirst])

  return (
    <Panel
      id="growth"
      title="Growth and retention"
      tone="green"
      scope="Last 12 weeks"
      lead="Is the app growing, and do people stay? Signed-in people only."
      help={
        <>
          <p>Only people with an account are counted here. Days are UTC. A rate stays blank until enough days have passed to judge it.</p>
          <p>
            <strong>Next day / Day 7 / Day 30</strong> is the share of new sign-ups that were active exactly that many days after they signed up.
          </p>
          <p>
            <strong>Monthly active</strong> is people active in the last 30 days. <strong>Daily ÷ monthly</strong> says how
            often those people come back: higher means more of them come most days.
          </p>
          <p>
            <strong>Resume rate</strong>: after a missed day, how many people checked in again within a week.
          </p>
        </>
      }
    >
      {error && <ErrorNote>{error}</ErrorNote>}
      {!error && !metrics && <Loading>Loading growth numbers…</Loading>}
      {metrics && h && (
        <>
          <KpiGrid>
            <Kpi label="New sign-ups" value={String(h.signups)} hint="People who made an account" tone="violet" spark={weeksOldestFirst.map((w) => w.signups)} />
            <Kpi
              label="Finished setup"
              value={pct(h.onboardingCompletion)}
              hint={`${h.onboardingFinished} of ${h.onboardingStarted} who started setup signed up`}
              tone="blue"
            />
            <Kpi label="Back the next day" value={pct(h.d1)} hint="Of new sign-ups (Day 1)" tone="amber" />
            <Kpi label="Back after a week" value={pct(h.d7)} hint="Of new sign-ups (Day 7)" tone="orange" />
            <Kpi label="Still here after a month" value={pct(h.d30)} hint="Of new sign-ups (Day 30)" tone="rose" />
            <Kpi label="Monthly active people" value={String(h.mau)} hint="Active in the last 30 days" tone="teal" spark={weeksOldestFirst.map((w) => w.activeUsers)} />
            <Kpi
              label="Come back most days"
              value={pct(h.stickiness)}
              hint={`${num(h.avgDau, 1)} people a day on average · ${h.dauYesterday} yesterday`}
              tone="green"
            />
            <Kpi label="Check-ins per person" value={num(h.checkInsPerActiveUserPerWeek, 1)} hint="Per week, last 4 weeks" tone="teal" />
            <Kpi
              label="Return after a slip"
              value={pct(h.resumeRate)}
              hint={`${h.resumed} of ${h.slips} checked in again within 7 days`}
              tone="green"
            />
          </KpiGrid>

          <Grid>
            <Block title="New sign-ups each week" note="Newest week on the right; the lighter column is still running.">
              <Columns
                points={weeksOldestFirst.map((w, index) => ({
                  label: w.weekStart.slice(5),
                  title: `Week of ${w.weekStart}: ${w.signups} sign-ups`,
                  values: [w.signups],
                  partial: index === weeksOldestFirst.length - 1,
                }))}
                series={[{ name: 'Sign-ups', tone: 'violet' }]}
                labelEvery={2}
                empty="No sign-ups yet."
              />
            </Block>
            <Block title="People active each week" note="People who opened the app or checked in.">
              <Columns
                points={weeksOldestFirst.map((w, index) => ({
                  label: w.weekStart.slice(5),
                  title: `Week of ${w.weekStart}: ${w.activeUsers} active, ${w.checkIns} check-ins`,
                  values: [w.activeUsers],
                  partial: index === weeksOldestFirst.length - 1,
                }))}
                series={[{ name: 'Active people', tone: 'blue' }]}
                labelEvery={2}
                empty="No activity yet."
              />
            </Block>
          </Grid>

          <Grid>
            <Block title="Where sign-ups came from">
              <Donut rows={sources} centerLabel="sign-ups" label="Sign-up sources" empty="No sign-ups in this period." />
            </Block>
            <Block title="Do new people stay?" note="Share of each week's sign-ups that were active on that day. Greener is better.">
              {cohorts.length === 0 ? (
                <Empty>No sign-up weeks to compare yet.</Empty>
              ) : (
                <div className="an-table-wrap">
                  <table className="an-table">
                    <thead>
                      <tr>
                        <th scope="col">Signed up</th>
                        <th scope="col">People</th>
                        <th scope="col">Next day</th>
                        <th scope="col">Day 7</th>
                        <th scope="col">Day 30</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cohorts.map((row) => (
                        <tr key={row.weekStart}>
                          <th scope="row">Week of {row.weekStart.slice(5)}</th>
                          <td>{row.size}</td>
                          <RateCell rate={row.d1} />
                          <RateCell rate={row.d7} />
                          <RateCell rate={row.d30} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Block>
          </Grid>

          <details className="an-block">
            <summary className="an-block-title">Week-by-week numbers</summary>
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <th scope="col">Week of</th>
                    <th scope="col">New</th>
                    <th scope="col">Active</th>
                    <th scope="col">Check-ins</th>
                    <th scope="col">Returned after a slip</th>
                  </tr>
                </thead>
                <tbody>
                  {[...weeksOldestFirst].reverse().map((week) => (
                    <tr key={week.weekStart}>
                      <th scope="row">{week.weekStart.slice(5)}</th>
                      <td>{week.signups}</td>
                      <td>{week.activeUsers}</td>
                      <td>{week.checkIns}</td>
                      <td>
                        {week.resumed}/{week.slips} <small>{week.slips > 0 ? percentText(week.resumed, week.slips) : ''}</small>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <div className="an-toolbar">
            <button type="button" className="btn btn-secondary btn-sm" onClick={onCopy}>
              Copy weekly numbers (CSV)
            </button>
          </div>
        </>
      )}

      <Block
        title="Monthly history"
        note="Saved automatically on the 1st of each month and kept for good. Usage events are deleted after 13 months; these numbers are not."
      >
        {snapshotError && <ErrorNote>{snapshotError}</ErrorNote>}
        {snapshots.length === 0 && !snapshotError && <Empty>No snapshots yet.</Empty>}
        {snapshots.length > 0 && (
          <div className="an-table-wrap">
            <table className="an-table">
              <thead>
                <tr>
                  <th scope="col">Month</th>
                  <th scope="col">Sign-ups</th>
                  <th scope="col">Monthly active</th>
                  <th scope="col">Daily ÷ monthly</th>
                  <th scope="col">Day 7</th>
                  <th scope="col">Day 30</th>
                  <th scope="col">Return after slip</th>
                </tr>
              </thead>
              <tbody>
                {snapshots.map((s) => (
                  <tr key={s.date}>
                    <th scope="row">{s.date}</th>
                    <td>{s.headline.signups}</td>
                    <td>{s.headline.mau}</td>
                    <td>{pct(s.headline.stickiness)}</td>
                    <td>{pct(s.headline.d7)}</td>
                    <td>{pct(s.headline.d30)}</td>
                    <td>{pct(s.headline.resumeRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="an-toolbar">
          <button type="button" className="btn btn-secondary btn-sm" disabled={saving} onClick={onSave}>
            {saving ? 'Saving…' : 'Save snapshot now'}
          </button>
        </div>
        {note && <Note title="Done">{note}</Note>}
      </Block>
    </Panel>
  )
}

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

  return (
    <GrowthView
      metrics={metrics}
      snapshots={snapshots}
      error={error}
      snapshotError={snapshotError}
      saving={saving}
      note={note}
      onSave={() => void saveNow()}
      onCopy={() => void copyCsv()}
    />
  )
}
