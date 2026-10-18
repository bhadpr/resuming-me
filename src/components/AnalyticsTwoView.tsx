import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { formatInt, heatStrength, heatStyle, percentText } from '../lib/analyticsViz'
import {
  EVENT_BREAKDOWNS,
  EVENT_GROUPS,
  FEATURED_EVENTS,
  eventInfo,
  languageName,
  periodLabel,
  propLabel,
  retentionPercent,
  sourceName,
  type AlertStatus,
  type AppErrors,
  type AppInstalls,
  type CountRow,
  type EventPeriod,
  type EventPeriods,
  type EventSeries,
  type GuestRetention,
  type PropBreakdown,
  type RetentionGroup,
  type RetentionPlatform,
  type RetentionRate,
} from '../lib/eventAnalytics'
import type { ChartRow, Tone } from '../lib/analyticsViz'
import {
  AnalyticsPage,
  BarList,
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
  PageIntro,
  Panel,
  Pill,
  RangeToggle,
  StickyBar,
} from './analytics/ui'

export type WindowDays = 7 | 30 | 90
type Measure = 'events' | 'devices'

export interface AnalyticsTwoViewProps {
  days: WindowDays
  onDays: (days: WindowDays) => void
  installs: AppInstalls | null
  installsError: string | null
  retentionPlatform: RetentionPlatform
  onRetentionPlatform: (platform: RetentionPlatform) => void
  retention: GuestRetention | null
  retentionError: string | null
  alerts: AlertStatus | null
  alertsError: string | null
  errors: AppErrors | null
  errorsError: string | null
  period: EventPeriod
  onPeriod: (period: EventPeriod) => void
  periods: EventPeriods | null
  periodsLoading: boolean
  periodsError: string | null
  loadBreakdown: (name: string, prop: string, days: number) => Promise<PropBreakdown>
}

const NAV = [
  { id: 'installs', label: 'Installs' },
  { id: 'retention', label: 'Who comes back' },
  { id: 'alerts', label: 'Reminders ringing' },
  { id: 'errors', label: 'Problems' },
  { id: 'events', label: 'Everything people do' },
]

const DAY_OPTIONS = [
  { value: 7 as WindowDays, label: '7 days' },
  { value: 30 as WindowDays, label: '30 days' },
  { value: 90 as WindowDays, label: '90 days' },
]

const GROUP_TONES: Record<string, Tone> = {
  Reminders: 'rose',
  Habits: 'teal',
  Vitals: 'green',
  Sharing: 'violet',
  'Sign-up and setup': 'blue',
  'Reviews and insights': 'amber',
  'Features and permissions': 'orange',
  App: 'blue',
  Errors: 'rose',
  Other: 'slate',
}

function chart(list: CountRow[], label?: (key: string) => string): ChartRow[] {
  return list.map((row) => ({ key: row.key, label: label ? label(row.key) : row.key, count: row.count }))
}

/** Admin analytics, page 2: installs, who comes back, problems, and every event over time. */
export function AnalyticsTwoView(props: AnalyticsTwoViewProps) {
  const scope = `Last ${props.days} days`
  return (
    <AnalyticsPage>
      <PageIntro
        title="The app, in detail"
        also={
          <>
            This page is about the app after someone has it.{' '}
            <Link to="/admin/analytics">Visitors & growth</Link> covers the website, sign-up and whether people stay.
          </>
        }
      >
        Pick a period at the top. It applies to New installs, Reminders ringing and Problems. Open “What does this mean?”
        on any section if a number is unclear.
      </PageIntro>

      <StickyBar
        items={NAV}
        range={<RangeToggle label="Period" value={props.days} onChange={props.onDays} options={DAY_OPTIONS} />}
      />

      <Panel
        id="installs"
        title="New installs"
        tone="blue"
        scope={scope}
        lead="Phones that opened the app for the first time, and what they use."
        help={
          <>
            <p>A <strong>first open</strong> is an Android phone opening the app for the very first time. Google Play Console counts installs, so any difference is people who installed but never opened it.</p>
            <p>Clearing the app’s data or reinstalling looks like a new phone, so this can run a little high.</p>
            <p>“Where from” comes from the link used to install. Buttons on resuming.me are tagged; “Direct or search in Play” means Play sent no tag.</p>
          </>
        }
      >
        {props.installsError && <ErrorNote>{props.installsError}</ErrorNote>}
        {!props.installs && !props.installsError ? <Loading>Loading installs…</Loading> : props.installs && <InstallsView installs={props.installs} days={props.days} />}
      </Panel>

      <Panel
        id="retention"
        title="Who comes back"
        tone="violet"
        scope="Last 12 weeks"
        lead="Of the phones and browsers that started using Resuming, how many returned, with and without an account."
        help={
          <>
            <p>Each phone or browser is counted from the first day it was active, in weekly groups. A <strong>guest</strong> never signed in on that device; an <strong>account</strong> signed in at least once.</p>
            <p>“Next day” means active exactly one day later. “Within a week” means active on any of the next 7 days.</p>
          </>
        }
      >
        <RangeToggle
          label="Where"
          value={props.retentionPlatform}
          onChange={props.onRetentionPlatform}
          options={[
            { value: 'android' as RetentionPlatform, label: 'Android app' },
            { value: 'web' as RetentionPlatform, label: 'Website' },
            { value: 'all' as RetentionPlatform, label: 'Both' },
          ]}
        />
        {props.retentionError && <ErrorNote>{props.retentionError}</ErrorNote>}
        {!props.retention && !props.retentionError ? <Loading>Loading…</Loading> : props.retention && <RetentionView retention={props.retention} />}
      </Panel>

      <Panel
        id="alerts"
        title="Can reminders ring?"
        tone="green"
        scope={scope}
        lead="Android phones with a reminder alert planned, and whether the phone will actually let it sound."
        help={
          <>
            <p>Each phone reports once a day. We use its latest report.</p>
            <p><strong>Notifications off</strong>: the alert will not show at all. <strong>Alarms &amp; reminders off</strong>: Android may hold the alert back, so it arrives late.</p>
          </>
        }
      >
        {props.alertsError && <ErrorNote>{props.alertsError}</ErrorNote>}
        {!props.alerts && !props.alertsError ? <Loading>Loading…</Loading> : props.alerts && <AlertsView alerts={props.alerts} days={props.days} />}
      </Panel>

      <Panel
        id="errors"
        title="Problems"
        tone="rose"
        scope={scope}
        lead="Things that went wrong inside the app, so you can fix them before people write in."
        help={
          <>
            <p>The app quietly reports a short message when something breaks. There is nothing personal in it: web addresses, emails and long numbers are removed.</p>
            <p><strong>Script error</strong>: the app’s code hit a bug. <strong>Background task failed</strong>: something like a save or load failed. <strong>Server request failed</strong>: the database or storage answered with an error.</p>
            <p>Each phone sends at most a few of each kind per session, so read counts as “how many phones hit this”.</p>
          </>
        }
      >
        {props.errorsError && <ErrorNote>{props.errorsError}</ErrorNote>}
        {!props.errors && !props.errorsError ? <Loading>Loading…</Loading> : props.errors && <ErrorsView errors={props.errors} days={props.days} />}
      </Panel>

      <EventsPanel {...props} />
    </AnalyticsPage>
  )
}

function InstallsView({ installs, days }: { installs: AppInstalls; days: WindowDays }) {
  const days14 = installs.firstOpensPerDay.length > 14
  return (
    <>
      <KpiGrid>
        <Kpi label="New installs opened" value={formatInt(installs.firstOpens)} hint={`First opens, last ${days} days`} tone="blue" spark={installs.firstOpensPerDay.map((d) => d.count)} />
        <Kpi label="Active on Android" value={formatInt(installs.activeDevices)} hint="Phones that opened the app" tone="green" />
        <Kpi label="Active on the website" value={formatInt(installs.webDevices)} hint="Browsers on resuming.me" tone="violet" />
      </KpiGrid>
      <Block title="New installs each day" note="Lighter column is today, still counting.">
        <Columns
          points={installs.firstOpensPerDay.map((day, index) => ({
            label: day.day.slice(5),
            title: `${day.day}: ${day.count} first opens`,
            values: [day.count],
            partial: index === installs.firstOpensPerDay.length - 1,
          }))}
          series={[{ name: 'First opens', tone: 'blue' }]}
          labelEvery={days14 ? Math.ceil(installs.firstOpensPerDay.length / 8) : 1}
          empty="No first opens in this period."
        />
      </Block>
      <Grid columns={3}>
        <Block title="Where new installs came from">
          <Donut rows={chart(installs.firstOpensBySource, sourceName)} centerLabel="installs" label="Install sources" empty="No new installs yet." />
        </Block>
        <Block title="Their language">
          <Donut rows={chart(installs.firstOpensByLanguage, languageName)} centerLabel="installs" label="Install languages" empty="No new installs yet." />
        </Block>
        <Block title="App version they started on">
          <Donut rows={chart(installs.firstOpensByVersion)} centerLabel="installs" label="Install versions" empty="No new installs yet." />
        </Block>
      </Grid>
      <Note title="Where installs come from">
        {installs.sourceKnownSince
          ? `Known from ${installs.sourceKnownSince}, when the app began sending it; earlier installs show as “Not recorded”.`
          : 'Shows once people install a build that sends it.'}{' '}
        {installs.languageKnownSince
          ? `Language is known from ${installs.languageKnownSince}; phones that haven’t opened a newer build show “Not known yet”.`
          : 'Language shows once people open a build that sends it.'}
      </Note>
      <Block section title="Everyone using it" note="All phones and browsers that opened the app in this period, by their latest open.">
        <Grid columns={3}>
          <Block title="Android: version">
            <Donut rows={chart(installs.activeByVersion)} centerLabel="phones" label="Active versions" empty="No Android phones." />
          </Block>
          <Block title="Android: language">
            <Donut rows={chart(installs.activeByLanguage, languageName)} centerLabel="phones" label="Active languages" empty="No Android phones." />
          </Block>
          <Block title="Website: language">
            <Donut rows={chart(installs.webByLanguage, languageName)} centerLabel="browsers" label="Web languages" empty="No browsers." />
          </Block>
        </Grid>
      </Block>
    </>
  )
}

function RateCell({ rate, full = 0.5 }: { rate: RetentionRate; full?: number }) {
  const percent = retentionPercent(rate)
  if (percent == null) return <td className="an-dash" title="Too early to tell">—</td>
  const strength = heatStrength(rate.back / rate.eligible, full)
  return (
    <td style={heatStyle(strength)} title={`${rate.back} of ${rate.eligible} devices`}>
      {percent} <small>({rate.back}/{rate.eligible})</small>
    </td>
  )
}

function RetentionView({ retention }: { retention: GuestRetention }) {
  const { guest, account } = retention.headline
  const total = guest.size + account.size
  if (total === 0) return <Empty>No devices started in the last 12 weeks.</Empty>
  const weeks = retention.weeks.filter((week) => week.guest.size + week.account.size > 0)
  const rows: Array<[string, RetentionGroup]> = [
    ['Guests', guest],
    ['Accounts', account],
  ]
  return (
    <>
      <Grid>
        <Block title="Guests or accounts?" note="Devices that started in the last 12 weeks.">
          <Donut
            rows={[
              { key: 'guest', label: 'Guests (never signed in)', count: guest.size, tone: 'amber' },
              { key: 'account', label: 'Accounts', count: account.size, tone: 'violet' },
            ]}
            centerLabel="devices"
            label="Guests and accounts"
          />
        </Block>
        <KpiGrid>
          <Kpi label="Guests back next day" value={retentionPercent(guest.d1) ?? '—'} hint={`${guest.d1.back} of ${guest.d1.eligible} measured`} tone="amber" />
          <Kpi label="Accounts back next day" value={retentionPercent(account.d1) ?? '—'} hint={`${account.d1.back} of ${account.d1.eligible} measured`} tone="violet" />
          <Kpi label="Guests back within a week" value={retentionPercent(guest.w1) ?? '—'} hint={`${guest.w1.back} of ${guest.w1.eligible} measured`} tone="amber" />
          <Kpi label="Accounts back within a week" value={retentionPercent(account.w1) ?? '—'} hint={`${account.w1.back} of ${account.w1.eligible} measured`} tone="violet" />
        </KpiGrid>
      </Grid>
      <Block title="All 12 weeks" note="Percent of devices old enough to be measured. Greener is better.">
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th scope="col">Who</th>
                <th scope="col">Devices</th>
                <th scope="col" title="Active exactly 1 day after the first day">Next day</th>
                <th scope="col" title="Active on any of the 7 days after the first day">Within a week</th>
                <th scope="col" title="Active exactly 7 days after the first day">Day 7</th>
                <th scope="col" title="Active exactly 30 days after the first day">Day 30</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(([label, group]) => (
                <tr key={label}>
                  <th scope="row">{label}</th>
                  <td>{formatInt(group.size)}</td>
                  <RateCell rate={group.d1} />
                  <RateCell rate={group.w1} />
                  <RateCell rate={group.d7} />
                  <RateCell rate={group.d30} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
      <Block title="Week by week" note="Grouped by the week each device first appeared.">
        <div className="an-table-wrap">
          <table className="an-table">
            <thead>
              <tr>
                <th scope="col">Week of</th>
                <th scope="col">Guests</th>
                <th scope="col">Next day</th>
                <th scope="col">In a week</th>
                <th scope="col">Accounts</th>
                <th scope="col">Next day</th>
                <th scope="col">In a week</th>
              </tr>
            </thead>
            <tbody>
              {weeks.map((week) => (
                <tr key={week.weekStart}>
                  <th scope="row">{periodLabel(week.weekStart, 'week')}</th>
                  <td>{formatInt(week.guest.size)}</td>
                  <RateCell rate={week.guest.d1} />
                  <RateCell rate={week.guest.w1} />
                  <td>{formatInt(week.account.size)}</td>
                  <RateCell rate={week.account.d1} />
                  <RateCell rate={week.account.w1} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Block>
      <Note>
        A dash means the devices are too new to measure. Clearing the app’s data or reinstalling makes a new device. Someone who signs up
        later moves from guests to accounts, so guest numbers run a little low. On the website, people who only read the landing page
        count as devices, so Android is the fairer view. This counts devices, not people.
      </Note>
    </>
  )
}

function AlertsView({ alerts, days }: { alerts: AlertStatus; days: WindowDays }) {
  if (alerts.devices === 0) {
    return (
      <Empty>
        {alerts.knownSince
          ? `No phone with an alert planned reported in the last ${days} days.`
          : 'Nothing yet. Phones report once they run a build that sends alerts_status.'}
      </Empty>
    )
  }
  const other = Math.max(0, alerts.devices - alerts.ready - alerts.notificationsOff - alerts.exactAlarmsOff)
  const share = (n: number) => `${percentText(n, alerts.devices)} of ${formatInt(alerts.devices)} phones`
  return (
    <>
      <Grid>
        <Block title="Will the alerts ring?" note="Latest report from each phone.">
          <Donut
            rows={[
              { key: 'ready', label: 'Yes, ready to ring', count: alerts.ready, tone: 'green' },
              { key: 'exact', label: 'May be late (Alarms & reminders off)', count: alerts.exactAlarmsOff, tone: 'amber' },
              { key: 'off', label: 'No (notifications off)', count: alerts.notificationsOff, tone: 'rose' },
              { key: 'other', label: 'Not sure yet', count: other, tone: 'slate' },
            ]}
            centerLabel="phones"
            label="Alert readiness"
          />
        </Block>
        <KpiGrid>
          <Kpi label="Ready to ring" value={formatInt(alerts.ready)} hint={share(alerts.ready)} tone="green" />
          <Kpi label="Notifications off" value={formatInt(alerts.notificationsOff)} hint={share(alerts.notificationsOff)} tone="rose" />
          <Kpi label="Alarms & reminders off" value={formatInt(alerts.exactAlarmsOff)} hint={share(alerts.exactAlarmsOff)} tone="amber" />
        </KpiGrid>
      </Grid>
      {(alerts.notificationsOff > 0 || alerts.exactAlarmsOff > 0) && (
        <Note tone="amber" title="What to do about it">
          Phones with notifications off will never show a reminder. A short in-app nudge that explains how to switch them on would help
          most here.
        </Note>
      )}
    </>
  )
}

const ERROR_KINDS: Record<string, { label: string; tone: Tone }> = {
  error: { label: 'Script error', tone: 'rose' },
  promise: { label: 'Background task failed', tone: 'orange' },
  api: { label: 'Server request failed', tone: 'violet' },
}

function kindInfo(kind: string): { label: string; tone: Tone } {
  return ERROR_KINDS[kind] ?? { label: kind, tone: 'slate' }
}

function ErrorsView({ errors, days }: { errors: AppErrors; days: WindowDays }) {
  if (errors.total === 0) {
    return (
      <>
        <Empty>No problems reported in the last {days} days. 🎉</Empty>
        <Note title="Not covered here">
          If the Android app crashes and closes, it can’t report it. Those crashes are in Play Console → Android vitals.
        </Note>
      </>
    )
  }
  const share = errors.activeDevices > 0 ? `${percentText(errors.devices, errors.activeDevices)} of ${formatInt(errors.activeDevices)} active phones` : 'no active phones'
  const byKind = new Map<string, number>()
  for (const row of errors.top) byKind.set(row.kind, (byKind.get(row.kind) ?? 0) + row.count)
  return (
    <>
      <KpiGrid>
        <Kpi label="Problems reported" value={formatInt(errors.total)} hint={`Last ${days} days`} tone="rose" spark={errors.perDay.map((d) => d.count)} />
        <Kpi label="Phones affected" value={formatInt(errors.devices)} hint={share} tone="orange" />
      </KpiGrid>
      <Block title="Problems each day" note="A spike usually points to a new version or a server change.">
        <Columns
          points={errors.perDay.map((day, index) => ({
            label: day.day.slice(5),
            title: `${day.day}: ${day.count} problems`,
            values: [day.count],
            partial: index === errors.perDay.length - 1,
          }))}
          series={[{ name: 'Problems', tone: 'rose' }]}
          labelEvery={errors.perDay.length > 14 ? Math.ceil(errors.perDay.length / 8) : 1}
        />
      </Block>
      <Grid>
        <Block title="What kind of problems" note="From the most common ones listed below.">
          <Donut
            rows={[...byKind].map(([kind, count]) => ({ key: kind, label: kindInfo(kind).label, count, tone: kindInfo(kind).tone }))}
            centerLabel="problems"
            label="Problem kinds"
          />
        </Block>
        <Block title="Which app version" note="Problems and the phones that hit them.">
          <BarList
            tone="rose"
            rows={errors.byVersion.map((row) => ({
              key: `${row.platform}-${row.version}`,
              label: `${row.platform} · ${row.version}`,
              count: row.count,
              note: `${formatInt(row.devices)} ${row.devices === 1 ? 'phone' : 'phones'}`,
            }))}
          />
        </Block>
      </Grid>
      <Block title="Most common problems" note="Biggest first. “Phones” is how many different phones hit it.">
        <ul className="an-cards">
          {errors.top.map((row, index) => {
            const info = kindInfo(row.kind)
            return (
              <li key={`${row.message}-${index}`} className="an-card" style={{ ['--tone' as string]: `var(--an-${info.tone})` }}>
                <div className="an-card-top">
                  <span className="an-card-title">{row.message}</span>
                  <span className="an-card-count">×{formatInt(row.count)}</span>
                </div>
                <p className="an-card-meta">
                  <Pill tone={info.tone}>{info.label}</Pill>
                  <span>
                    {formatInt(row.devices)} {row.devices === 1 ? 'phone' : 'phones'}
                  </span>
                  {row.file && (
                    <span>
                      {row.file}
                      {row.line ? `:${row.line}` : ''}
                    </span>
                  )}
                  {row.version && <span>{row.version}</span>}
                  {row.lastSeen && (
                    <span>
                      last{' '}
                      {new Date(row.lastSeen).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  )}
                </p>
              </li>
            )
          })}
        </ul>
      </Block>
      <Note title="Not covered here">If the Android app crashes and closes, it can’t report it. Those crashes are in Play Console → Android vitals.</Note>
    </>
  )
}

function seriesValues(series: EventSeries, measure: Measure): number[] {
  return measure === 'devices' ? series.devices : series.counts
}

function EventsPanel(props: AnalyticsTwoViewProps) {
  const { period, periods } = props
  const [measure, setMeasure] = useState<Measure>('events')
  const [selected, setSelected] = useState<string>('reminder_added')
  const [filter, setFilter] = useState('')
  const [showAllPeriods, setShowAllPeriods] = useState(false)
  const [showQuiet, setShowQuiet] = useState(false)

  const events = useMemo(() => periods?.events ?? [], [periods])
  const current: EventSeries | null =
    events.find((event) => event.name === selected) ??
    events.find((event) => (FEATURED_EVENTS as readonly string[]).includes(event.name)) ??
    events[0] ??
    null
  const featured = FEATURED_EVENTS.filter((name) => events.some((event) => event.name === name))

  const tablePeriods = useMemo(() => {
    if (!periods) return null
    if (showAllPeriods || periods.starts.length <= 6) return periods
    return { ...periods, starts: periods.starts.slice(-6) }
  }, [periods, showAllPeriods])

  const grouped = useMemo(() => {
    const needle = filter.trim().toLowerCase()
    const shown = events.filter((event) => {
      if (needle && !event.name.includes(needle) && !eventInfo(event.name).label.toLowerCase().includes(needle)) return false
      if (!showQuiet && !needle && event.total === 0) return false
      return true
    })
    return EVENT_GROUPS.map((group) => ({
      group,
      rows: shown.filter((event) => eventInfo(event.name).group === group),
    })).filter((entry) => entry.rows.length > 0)
  }, [events, filter, showQuiet])

  return (
    <Panel
      id="events"
      title="Everything people do"
      tone="amber"
      scope={period === 'week' ? 'Last 12 weeks' : 'Last 12 months'}
      lead="Pick any action and see how often it happens, week by week or month by month."
      help={
        <>
          <p><strong>Events</strong> counts every time something happened. <strong>Devices</strong> counts each phone or browser once per period, which tells you how many different people did it.</p>
          <p>Days and weeks are UTC and a week starts on Monday. The last column is still running, so it is lower than a finished one.</p>
        </>
      }
    >
      <div className="an-toolbar">
        <RangeToggle
          label="Group by"
          value={period}
          onChange={props.onPeriod}
          options={[
            { value: 'week' as EventPeriod, label: 'Per week' },
            { value: 'month' as EventPeriod, label: 'Per month' },
          ]}
        />
        <RangeToggle
          label="Count"
          value={measure}
          onChange={setMeasure}
          options={[
            { value: 'events' as Measure, label: 'Every time' },
            { value: 'devices' as Measure, label: 'Different devices' },
          ]}
        />
      </div>
      {props.periodsError && <ErrorNote>{props.periodsError}</ErrorNote>}
      {props.periodsLoading && !periods && <Loading>Loading events…</Loading>}
      {periods && events.length === 0 && <Empty>No events in this range.</Empty>}
      {periods && current && (
        <>
          <div className="an-chips" role="group" aria-label="Popular actions">
            {featured.map((name) => (
              <button
                key={name}
                type="button"
                className={`an-chip ${current.name === name ? 'an-chip-active' : ''}`}
                onClick={() => setSelected(name)}
              >
                {eventInfo(name).label}
              </button>
            ))}
          </div>
          <EventChart series={current} periods={periods} measure={measure} />
          <BreakdownPanel key={current.name} name={current.name} load={props.loadBreakdown} />
          <input
            className="an-input"
            type="search"
            value={filter}
            placeholder="Find an action, for example “reminder”"
            aria-label="Find an action"
            onChange={(event) => setFilter(event.target.value)}
          />
          <div className="an-toolbar">
            {periods.starts.length > 6 && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowAllPeriods((value) => !value)}>
                {showAllPeriods ? 'Show recent 6' : `Show all ${periods.starts.length} ${period === 'week' ? 'weeks' : 'months'}`}
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setShowQuiet((value) => !value)}>
              {showQuiet ? 'Hide unused actions' : 'Show unused actions'}
            </button>
          </div>
          {grouped.length === 0 && <Empty>No action matches.</Empty>}
          {tablePeriods &&
            grouped.map(({ group, rows }) => (
              <div key={group} style={{ ['--tone' as string]: `var(--an-${GROUP_TONES[group] ?? 'slate'})` }}>
                <h4 className="an-group-title">{group}</h4>
                <EventTable rows={rows} periods={tablePeriods} measure={measure} selected={current.name} onSelect={setSelected} />
              </div>
            ))}
        </>
      )}
    </Panel>
  )
}

function EventChart({ series, periods, measure }: { series: EventSeries; periods: EventPeriods; measure: Measure }) {
  const values = seriesValues(series, measure)
  const info = eventInfo(series.name)
  const total = values.reduce((sum, value) => sum + value, 0)
  return (
    <Block
      title={info.label}
      note={`${measure === 'events' ? `${formatInt(total)} in this range` : 'Different devices in each period'}${info.label !== series.name ? ` · ${series.name}` : ''}`}
    >
      <Columns
        points={values.map((value, index) => {
          const start = periods.starts[index]
          const running = start === periods.currentStart
          return {
            label: periodLabel(start, periods.period),
            title: `${periodLabel(start, periods.period)}${running ? ' (so far)' : ''}: ${formatInt(value)}`,
            values: [value],
            partial: running,
          }
        })}
        series={[{ name: info.label, tone: 'amber' }]}
        labelEvery={values.length > 8 ? 2 : 1}
        empty="Nothing in this range."
      />
    </Block>
  )
}

function EventTable({
  rows,
  periods,
  measure,
  selected,
  onSelect,
}: {
  rows: EventSeries[]
  periods: EventPeriods
  measure: Measure
  selected: string
  onSelect: (name: string) => void
}) {
  return (
    <div className="an-table-wrap">
      <table className="an-table an-table-sticky">
        <thead>
          <tr>
            <th scope="col">Action</th>
            {periods.starts.map((start) => (
              <th key={start} scope="col" title={start === periods.currentStart ? 'Still running' : undefined}>
                {periodLabel(start, periods.period)}
                {start === periods.currentStart ? '*' : ''}
              </th>
            ))}
            {measure === 'events' && <th scope="col">Total</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((series) => {
            const info = eventInfo(series.name)
            const values = seriesValues(series, measure).slice(-periods.starts.length)
            const peak = Math.max(...values, 1)
            return (
              <tr key={series.name} className={series.name === selected ? 'an-row-active' : undefined}>
                <th scope="row">
                  <button type="button" className="an-event-btn" onClick={() => onSelect(series.name)}>
                    <span>{info.label}</span>
                    {info.label !== series.name && <small>{series.name}</small>}
                  </button>
                </th>
                {values.map((value, index) => (
                  <td
                    key={periods.starts[index]}
                    className={value === 0 ? 'an-dash' : undefined}
                    style={value === 0 ? undefined : heatStyle((value / peak) * 100, 'amber')}
                  >
                    {formatInt(value)}
                  </td>
                ))}
                {measure === 'events' && <td><strong>{formatInt(series.total)}</strong></td>}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** One action's count split by one of its details, over the last 30 or 90 days. */
function BreakdownPanel({
  name,
  load,
}: {
  name: string
  load: (name: string, prop: string, days: number) => Promise<PropBreakdown>
}) {
  const props = EVENT_BREAKDOWNS[name] ?? []
  const [prop, setProp] = useState<string>(props[0] ?? '')
  const [range, setRange] = useState<30 | 90>(30)
  const [result, setResult] = useState<PropBreakdown | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!prop) return
    let mounted = true
    setError(null)
    setResult(null)
    load(name, prop, range)
      .then((next) => mounted && setResult(next))
      .catch((err) => mounted && setError(err instanceof Error ? err.message : 'Could not load the breakdown'))
    return () => {
      mounted = false
    }
  }, [name, prop, range, load])

  if (props.length === 0) return null
  const label = prop === 'locale' || prop === 'to' || prop === 'from' ? languageName : prop === 'source' ? sourceName : undefined
  return (
    <div className="an-subtle-panel">
      <div className="an-toolbar">
        <strong>What made up this number?</strong>
        <RangeToggle
          label="Range"
          value={range}
          onChange={setRange}
          options={[
            { value: 30 as 30 | 90, label: '30 days' },
            { value: 90 as 30 | 90, label: '90 days' },
          ]}
        />
      </div>
      <div className="an-chips" role="group" aria-label="Split by">
        {props.map((value) => (
          <button
            key={value}
            type="button"
            className={`an-chip ${prop === value ? 'an-chip-active' : ''}`}
            onClick={() => setProp(value)}
          >
            {propLabel(value)}
          </button>
        ))}
      </div>
      {error && <ErrorNote>{error}</ErrorNote>}
      {!result && !error && <Loading />}
      {result && (
        <Donut
          rows={result.rows.map((row) => ({ key: row.key, label: label ? label(row.key) : row.key, count: row.count }))}
          centerLabel={`in ${range} days`}
          label={`${eventInfo(name).label} by ${prop}`}
          empty="Nothing in this range."
        />
      )}
    </div>
  )
}
