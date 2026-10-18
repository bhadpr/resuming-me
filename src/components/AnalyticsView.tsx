import type { ReactNode } from 'react'
import {
  formatRetentionRate,
  formatSignInTime,
  type AnalyticsSummary,
  type AnalyticsWindow,
  type NamedCount,
  type ProductAnalyticsSummary,
  type SignedInAccount,
} from '../lib/analytics'
import { formatInt, heatStrength, heatStyle, percentText } from '../lib/analyticsViz'
import { templateLabel } from '../lib/catalogName'
import type { CreateCounts, GuestJourney } from '../lib/guestJourney'
import type { CohortRow, ComebackLoopSummary } from '../lib/loopAnalytics'
import type { OnboardingFunnel } from '../lib/onboardingFunnel'
import { oneTimeDoneRate, type ReminderSummary } from '../lib/reminderAnalytics'
import type { SiteSummary } from '../lib/siteAnalytics'
import { Link } from 'react-router-dom'
import {
  AnalyticsPage,
  BarList,
  Block,
  Columns,
  Donut,
  Empty,
  ErrorNote,
  Funnel,
  Grid,
  Kpi,
  KpiGrid,
  Loading,
  Note,
  PageIntro,
  Panel,
  RangeToggle,
  StickyBar,
} from './analytics/ui'

export interface AnalyticsViewProps {
  window: AnalyticsWindow
  onWindow: (window: AnalyticsWindow) => void
  summary: AnalyticsSummary | null
  loading: boolean
  error: string | null
  product: ProductAnalyticsSummary | null
  productLoading: boolean
  productError: string | null
  site: SiteSummary | null
  siteLoading: boolean
  siteError: string | null
  journey: GuestJourney | null
  creates: CreateCounts | null
  journeyError: string | null
  funnel: OnboardingFunnel | null
  funnelError: string | null
  reminders: ReminderSummary | null
  remindersError: string | null
  loop: ComebackLoopSummary | null
  cohorts: CohortRow[]
  loopError: string | null
  accounts: SignedInAccount[]
  accountsError: string | null
  /** The growth panel, which loads its own numbers. */
  growth: ReactNode
}

const NAV = [
  { id: 'summary', label: 'At a glance' },
  { id: 'website', label: 'Website' },
  { id: 'journey', label: 'Sign-up journey' },
  { id: 'reminders', label: 'Reminders' },
  { id: 'growth', label: 'Growth' },
  { id: 'comeback', label: 'Comebacks' },
  { id: 'people', label: 'Accounts' },
]

function rows(list: NamedCount[]) {
  return list.map((row) => ({ key: row.key, label: row.label, count: row.count }))
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const minutes = Math.floor(seconds / 60)
  const rest = Math.round(seconds % 60)
  return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`
}

function decimal(n: number | null): string {
  return n == null ? '—' : new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(n)
}

/** Admin analytics, page 1: how people find, join and use the app. Every block says what it counts. */
export function AnalyticsView(props: AnalyticsViewProps) {
  const { window: range, summary, product, site, reminders } = props
  const scope = range === '7d' ? 'Last 7 days' : 'Last 30 days'

  return (
    <AnalyticsPage>
      <PageIntro
        title="How Resuming is doing"
        also={
          <>
            This page is about visitors, sign-up and growth.{' '}
            <Link to="/admin/analytics-2">App health</Link> covers installs, who comes back, problems, and every action
            inside the app.
          </>
        }
      >
        Start with the six colored numbers. Each section below answers one question. Open “What does this mean?” on any
        section if a number is unclear.
      </PageIntro>

      <StickyBar
        items={NAV}
        range={
          <RangeToggle
            label="Period"
            value={range}
            onChange={props.onWindow}
            options={[
              { value: '7d', label: '7 days' },
              { value: '30d', label: '30 days' },
            ]}
          />
        }
      />

      <Panel
        id="summary"
        title="At a glance"
        tone="blue"
        scope={scope}
        lead="The six numbers worth checking first. Small bars show the trend over the period."
      >
        {props.productError && <ErrorNote>{props.productError}</ErrorNote>}
        {props.productLoading && !product ? (
          <Loading>Loading the main numbers…</Loading>
        ) : (
          <KpiGrid>
            <Kpi
              label="Website visitors"
              value={site ? formatInt(site.visitors) : '—'}
              hint={site ? `${formatInt(site.tappedPlay)} tapped Google Play (${percentText(site.tappedPlay, site.visitors)})` : 'resuming.app'}
              tone="blue"
            />
            <Kpi
              label="New accounts"
              value={product ? formatInt(product.signups) : '—'}
              hint="People who finished sign-up"
              tone="violet"
            />
            <Kpi
              label="Back the next day"
              value={product ? formatRetentionRate(product.d1Retention) : '—'}
              hint="Of new accounts, came back the day after"
              tone="amber"
            />
            <Kpi
              label="Check-ins per person"
              value={product?.logsPerActiveUser == null ? '—' : decimal(product.logsPerActiveUser)}
              hint={product ? `${formatInt(product.logEvents)} check-ins by ${formatInt(product.activeUsers)} people` : undefined}
              tone="teal"
            />
            <Kpi
              label="Reminders added"
              value={reminders ? formatInt(reminders.added) : '—'}
              hint={reminders ? `by ${formatInt(reminders.people)} ${reminders.people === 1 ? 'person' : 'people'}` : undefined}
              tone="rose"
              spark={reminders?.perDay.map((day) => day.added)}
            />
            <Kpi
              label="Comebacks"
              value={product ? formatInt(product.comebackCount) : '—'}
              hint="Returned after 3 or more days away"
              tone="orange"
            />
          </KpiGrid>
        )}
      </Panel>

      <Panel
        id="website"
        title="Website and web app"
        tone="teal"
        scope={scope}
        lead="Who visits resuming.app (our public site) and resuming.me (the web app), and what they tap."
        help={
          <>
            <p>
              <strong>Marketing site (resuming.app)</strong> is the page people land on from Google or a shared link. Visitors are
              counted by a random id kept in their browser, so one person on two devices counts twice.
            </p>
            <p>
              <strong>Web app (resuming.me)</strong> is the app opened in a browser. Page views are every screen opened.
            </p>
            <p>Add <code>?utm_source=name</code> to any link you share to see that channel in “Where visitors came from”.</p>
          </>
        }
      >
        <Block section title="Marketing site (resuming.app)">
          {props.siteError && <ErrorNote>{props.siteError}</ErrorNote>}
          {props.siteLoading && !site ? (
            <Loading>Loading website numbers…</Loading>
          ) : !site || site.pageViews === 0 ? (
            <Empty>No website visits in this period.</Empty>
          ) : (
            <>
              <KpiGrid>
                <Kpi label="Visitors" value={formatInt(site.visitors)} hint={`${formatInt(site.pageViews)} page views`} tone="teal" />
                <Kpi
                  label="Went to Google Play"
                  value={formatInt(site.tappedPlay)}
                  hint={`${percentText(site.tappedPlay, site.visitors)} of visitors`}
                  tone="green"
                />
                <Kpi
                  label="Tried it in a browser"
                  value={formatInt(site.tappedBrowser)}
                  hint={`${percentText(site.tappedBrowser, site.visitors)} of visitors`}
                  tone="blue"
                />
              </KpiGrid>
              <Grid>
                <Block title="Where visitors came from" note="Share of visitors by source.">
                  <Donut
                    rows={site.sources.map((row) => ({ key: row.source, label: row.source, count: row.visitors }))}
                    centerLabel="visitors"
                    label="Visitor sources"
                  />
                </Block>
                <Block title="Which sources bring Play taps" note="Visitors, and how many of them tapped Google Play.">
                  <BarList
                    tone="green"
                    rows={site.sources.map((row) => ({
                      key: row.source,
                      label: row.source,
                      count: row.visitors,
                      note: `${formatInt(row.tappedPlay)} tapped Play (${percentText(row.tappedPlay, row.visitors)})`,
                    }))}
                  />
                </Block>
              </Grid>
              <Grid>
                <Block title="What visitors tapped" note="Button and where on the page.">
                  <BarList tone="teal" rows={rows(site.taps)} empty="No taps yet." />
                </Block>
                <Block title="Phone or computer">
                  <Donut rows={rows(site.devices)} centerLabel="visitors" label="Devices" empty="No device data." />
                </Block>
              </Grid>
            </>
          )}
        </Block>

        <Block section title="Web app (resuming.me)">
          {props.error && <ErrorNote>{props.error}</ErrorNote>}
          {props.loading && !summary ? (
            <Loading>Loading web app visits…</Loading>
          ) : !summary ? (
            <Empty>No data yet.</Empty>
          ) : (
            <>
              <KpiGrid>
                <Kpi label="Page views" value={formatInt(summary.totalViews)} hint={`${summary.from} → ${summary.to}`} tone="blue" spark={summary.daily.map((d) => d.views)} />
                <Kpi label="Different visitors" value={formatInt(summary.uniqueVisitors)} hint="Counted by browser" tone="violet" />
                <Kpi label="Signed in" value={formatInt(summary.signedInVisitors)} hint="Different accounts" tone="green" />
                <Kpi label="Views today" value={formatInt(summary.viewsToday)} hint="UTC day" tone="amber" />
              </KpiGrid>
              <Block title="Page views each day" note="Lighter column is today, still counting.">
                <Columns
                  points={summary.daily.map((day, index) => ({
                    label: day.date.slice(5),
                    title: `${day.date}: ${day.views} views, ${day.visitors} visitors`,
                    values: [day.views],
                    partial: index === summary.daily.length - 1,
                  }))}
                  series={[{ name: 'Page views', tone: 'blue' }]}
                  labelEvery={summary.daily.length > 14 ? 4 : 1}
                />
              </Block>
              <Grid>
                <Block title="Most visited screens">
                  <BarList tone="blue" rows={rows(summary.topPages)} empty="No page views in this period." />
                </Block>
                <Block title="Where they came from">
                  <BarList tone="violet" rows={rows(summary.topReferrers)} empty="No referrer data yet." />
                </Block>
              </Grid>
              <Grid>
                <Block title="Phone or computer">
                  <Donut rows={rows(summary.devices)} centerLabel="views" label="Devices" empty="No device data." />
                </Block>
                <Block title="Browsers">
                  <Donut rows={rows(summary.browsers)} centerLabel="views" label="Browsers" empty="No browser data." />
                </Block>
              </Grid>
            </>
          )}
        </Block>
      </Panel>

      <Panel
        id="journey"
        title="Sign-up journey"
        tone="violet"
        scope={scope}
        lead="Where people drop off between seeing the app and creating an account."
        help={
          <>
            <p>
              Each bar is a step. The first bar is everyone who started; each next bar shows how many reached that step.
              The red note marks the biggest drop, which is usually the best place to improve.
            </p>
            <p>People are counted by an anonymous id before they have an account. When they sign up, they stay on the same id.</p>
          </>
        }
      >
        {props.journeyError && <ErrorNote>{props.journeyError}</ErrorNote>}
        {props.journey ? (
          <Block title="From first visit to account" note="Everyone who started on the left-most step.">
            <Funnel
              tone="violet"
              steps={[
                { label: 'Saw the landing page', value: props.journey.landing },
                { label: 'Started the questions', value: props.journey.intentStarted },
                { label: 'Started setup', value: props.journey.setupStarted },
                { label: 'Picked habits', value: props.journey.habitsPicked },
                { label: 'Logged a first check-in', value: props.journey.firstLog },
                { label: 'Was shown sign-in', value: props.journey.signInShown },
                { label: 'Created an account', value: props.journey.signups },
              ]}
            />
          </Block>
        ) : (
          !props.journeyError && <Loading>Loading the journey…</Loading>
        )}

        {props.funnelError && <ErrorNote>{props.funnelError}</ErrorNote>}
        {props.funnel && <SetupView funnel={props.funnel} />}

        {props.creates && <PicksView creates={props.creates} />}
      </Panel>

      <Panel
        id="reminders"
        title="Reminders"
        tone="rose"
        scope={scope}
        lead="How many reminders people add, finish and share. Counts only: reminder text is never collected."
      >
        {props.remindersError && <ErrorNote>{props.remindersError}</ErrorNote>}
        {reminders ? <RemindersView reminders={reminders} /> : !props.remindersError && <Loading>Loading reminders…</Loading>}
      </Panel>

      {props.growth}

      <Panel
        id="comeback"
        title="Comebacks"
        tone="orange"
        scope="Last 90 days"
        lead="What happens when someone drifts away and returns."
        help={
          <>
            <p>A <strong>comeback</strong> is opening the app after 3 or more days away. We show a welcome card when that happens.</p>
            <p>This compares people who saw the card with people who didn’t. It is not a controlled test, so treat it as a hint.</p>
          </>
        }
      >
        {props.loopError && <ErrorNote>{props.loopError}</ErrorNote>}
        {props.loop ? (
          <>
            <KpiGrid>
              <Kpi label="Comebacks per person" value={decimal(props.loop.comebacksPerActiveUser)} hint="Per active person" tone="orange" />
              <Kpi label="Opened the weekly review" value={formatRate(props.loop.reviewOpenRate)} hint="Of weekly reviews made" tone="blue" />
              <Kpi label="Acted on the review" value={formatRate(props.loop.reviewActionRate)} hint="Of reviews opened" tone="green" />
            </KpiGrid>
            <Block title="Who saw the welcome card?" note="People who came back after a gap. This is not a test of whether the card works.">
              <Donut
                rows={[
                  { key: 'card', label: 'Saw the welcome card', count: props.loop.returnedWithCard },
                  { key: 'nocard', label: 'Did not see the card', count: props.loop.returnedWithoutCard },
                ]}
                centerLabel="returned"
                label="Returned after a gap"
                empty="Nobody has returned after a gap yet."
              />
            </Block>
            <Note>{props.loop.caveat}</Note>
          </>
        ) : (
          !props.loopError && <Loading>Loading comebacks…</Loading>
        )}
        {props.cohorts.length > 0 && (
          <Block title="Do new people keep coming back?" note="Share of each sign-up week that was active in week 2, 4 and 8. Greener is better.">
            <div className="an-table-wrap">
              <table className="an-table">
                <thead>
                  <tr>
                    <th scope="col">Joined</th>
                    <th scope="col">People</th>
                    <th scope="col">Week 2</th>
                    <th scope="col">Week 4</th>
                    <th scope="col">Week 8</th>
                  </tr>
                </thead>
                <tbody>
                  {props.cohorts.slice(0, 8).map((row) => (
                    <tr key={row.weekStart}>
                      <th scope="row">Week of {row.weekStart.slice(5)}</th>
                      <td>{row.size}</td>
                      {[row.week2, row.week4, row.week8].map((rate, index) =>
                        rate == null ? (
                          <td key={index} className="an-dash">—</td>
                        ) : (
                          <td key={index} style={heatStyle(heatStrength(rate, 0.5))}>
                            {formatRetentionRate(rate)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Block>
        )}
      </Panel>

      <Panel
        id="people"
        title="Signed-in Google accounts"
        tone="teal"
        lead={
          props.accounts.length === 0
            ? 'Emails from Google sign-in.'
            : `${props.accounts.length} ${props.accounts.length === 1 ? 'account' : 'accounts'}, most recent sign-in first.`
        }
      >
        {props.accountsError ? (
          <ErrorNote>{props.accountsError}</ErrorNote>
        ) : props.accounts.length === 0 ? (
          <Empty>No Google sign-ins yet.</Empty>
        ) : (
          <ul className="an-cards">
            {props.accounts.map((account) => (
              <li key={account.email} className="an-card" style={{ ['--tone' as string]: 'var(--an-teal)' }}>
                <div className="an-card-top">
                  <span className="an-card-title">{account.email}</span>
                </div>
                <p className="an-card-meta">
                  <span>Last signed in {formatSignInTime(account.lastSignInAt)}</span>
                  <span>
                    {formatInt(account.activityCount)} {account.activityCount === 1 ? 'habit' : 'habits'}
                  </span>
                  <span>
                    {formatInt(account.metricCount)} {account.metricCount === 1 ? 'vital' : 'vitals'}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </AnalyticsPage>
  )
}

function formatRate(rate: number | null): string {
  return rate == null ? '—' : `${Math.round(rate * 100)}%`
}

/** Setup screens, in the order people walk through them. Step 4 (daily reminder) comes after the first try. */
const SETUP_STEPS: Record<number, { label: string; order: number }> = {
  1: { label: 'Picked what to track', order: 1 },
  2: { label: 'Chose how often', order: 2 },
  3: { label: 'Chose how much', order: 3 },
  5: { label: 'Tried the first habit', order: 4 },
  6: { label: 'Saw “you’re ready”', order: 5 },
  4: { label: 'Set a daily reminder', order: 6 },
  8: { label: 'Asked to save an account', order: 7 },
}

function SetupView({ funnel }: { funnel: OnboardingFunnel }) {
  const timerOther = Math.max(0, funnel.timerStarted - funnel.timerCompleted - funnel.timerSkipped)
  return (
    <>
      <Block title="Setup, screen by screen" note="Each step of the first-time setup, in the order people walk through it. A big drop means that screen loses people.">
        <Funnel
          tone="blue"
          steps={[
            { label: 'Started setup', value: funnel.started },
            ...[...funnel.steps]
              .sort((a, b) => (SETUP_STEPS[a.step]?.order ?? a.step) - (SETUP_STEPS[b.step]?.order ?? b.step))
              .map((step) => ({
                label: SETUP_STEPS[step.step]?.label ?? `Finished step ${step.step}`,
                value: step.people,
              })),
            { label: 'Was shown sign-in', value: funnel.signinShown },
            { label: 'Created an account', value: funnel.signups },
          ]}
        />
      </Block>
      <Grid>
        <Block title="The first timer" note="Setup offers a short timer for the first habit.">
          <Donut
            rows={[
              { key: 'done', label: 'Finished it', count: funnel.timerCompleted },
              { key: 'skip', label: 'Skipped it', count: funnel.timerSkipped },
              { key: 'other', label: 'Started, did not finish', count: timerOther },
            ]}
            centerLabel="started"
            centerValue={formatInt(funnel.timerStarted)}
            label="First timer"
            empty="Nobody started the timer yet."
          />
        </Block>
        <Block title="Wanted a reminder?" note="Asked once during setup.">
          <Donut
            rows={[
              { key: 'yes', label: 'Yes, set one', count: funnel.reminderSet },
              { key: 'no', label: 'No thanks', count: funnel.reminderNone },
            ]}
            centerLabel="answered"
            label="Reminder choice"
            empty="Nobody answered yet."
          />
        </Block>
      </Grid>
      <Block title="Do new accounts come back to log?" note="People who signed up and also checked in on that day after signing up.">
        <KpiGrid>
          <Kpi label="Fast to first check-in" value={formatDuration(funnel.medianSecondsToFirstResume)} hint="Typical time from start to the first resume" tone="teal" />
          <Kpi label="Logged on day 2" value={formatInt(funnel.loggedDay2)} hint={`of ${formatInt(funnel.signupCohort)} sign-ups`} tone="amber" />
          <Kpi label="Logged on day 3" value={formatInt(funnel.loggedDay3)} hint={`of ${formatInt(funnel.signupCohort)} sign-ups`} tone="orange" />
          <Kpi label="Logged on day 7" value={formatInt(funnel.loggedDay7)} hint={`of ${formatInt(funnel.signupCohort)} sign-ups`} tone="rose" />
        </KpiGrid>
      </Block>
    </>
  )
}

function PicksView({ creates }: { creates: CreateCounts }) {
  const named = (list: { id: string; count: number }[]) =>
    list.map((row) => ({ key: row.id, label: templateLabel(row.id) ?? row.id, count: row.count }))
  return (
    <>
      <Grid>
        <Block title="Habits: from our list or their own" note="Guests and accounts together.">
          <Donut
            rows={[
              { key: 'list', label: 'Picked from the list', count: creates.habitsCatalog },
              { key: 'own', label: 'Named their own', count: creates.habitsCustom },
            ]}
            centerLabel="habits"
            label="Habits"
            empty="No habits created yet."
          />
        </Block>
        <Block title="Vitals: from our list or their own">
          <Donut
            rows={[
              { key: 'list', label: 'Picked from the list', count: creates.vitalsCatalog },
              { key: 'own', label: 'Named their own', count: creates.vitalsCustom },
            ]}
            centerLabel="vitals"
            label="Vitals"
            empty="No vitals created yet."
          />
        </Block>
      </Grid>
      <Grid>
        <Block title="Most popular habits">
          <BarList tone="violet" rows={named(creates.topHabits)} empty="No habits yet." />
        </Block>
        <Block title="Most popular vitals">
          <BarList tone="teal" rows={named(creates.topVitals)} empty="No vitals yet." />
        </Block>
      </Grid>
    </>
  )
}

function RemindersView({ reminders }: { reminders: ReminderSummary }) {
  const guests = Math.max(0, reminders.added - reminders.signedIn)
  const oneTime = oneTimeDoneRate(reminders)
  const of = (n: number) => `${percentText(n, reminders.added)} of added`
  const shared = reminders.shared
  return (
    <>
      <KpiGrid>
        <Kpi label="Added" value={formatInt(reminders.added)} hint={`by ${formatInt(reminders.people)} ${reminders.people === 1 ? 'person' : 'people'}`} tone="rose" spark={reminders.perDay.map((d) => d.added)} />
        <Kpi label="Marked done" value={formatInt(reminders.done)} hint={`${formatInt(reminders.doneFromNotification)} from a notification`} tone="green" spark={reminders.perDay.map((d) => d.done)} />
        <Kpi label="One-time reminders finished" value={oneTime == null ? '—' : `${oneTime}%`} hint="Done per added, for one-off reminders" tone="teal" />
      </KpiGrid>
      <Block title="Added and done each day" note="Rose is added, green is done.">
        <Columns
          points={reminders.perDay.map((day, index) => ({
            label: day.day.slice(5),
            title: `${day.day}: ${day.added} added, ${day.done} done`,
            values: [day.added, day.done],
            partial: index === reminders.perDay.length - 1,
          }))}
          series={[
            { name: 'Added', tone: 'rose' },
            { name: 'Done', tone: 'green' },
          ]}
          labelEvery={reminders.perDay.length > 14 ? 4 : 1}
        />
      </Block>
      <Grid>
        <Block title="What the reminders are for">
          <Donut
            rows={reminders.kinds.map((row) => ({ key: row.kind, label: row.kind, count: row.count }))}
            centerLabel="added"
            label="Reminder kinds"
            empty="No reminders added yet."
          />
        </Block>
        <Block title="Who adds them" note="Signed-in people compared with guests.">
          <Donut
            rows={[
              { key: 'in', label: 'Signed in', count: reminders.signedIn },
              { key: 'guest', label: 'Guests', count: guests },
            ]}
            centerLabel="added"
            label="Signed in or guest"
            empty="No reminders added yet."
          />
        </Block>
      </Grid>
      <Block title="How they are set up" note="Share of all reminders added.">
        <BarList
          tone="rose"
          rows={[
            { key: 'time', label: 'At a set time', count: reminders.withTime, note: of(reminders.withTime) },
            { key: 'before', label: 'With a day-before alert', count: reminders.dayBefore, note: of(reminders.dayBefore) },
            { key: 'year', label: 'Every year', count: reminders.everyYear, note: of(reminders.everyYear) },
            { key: 'daily', label: 'Repeats every day', count: reminders.repeatAdded.day, note: of(reminders.repeatAdded.day) },
            { key: 'weekly', label: 'Repeats every week', count: reminders.repeatAdded.week, note: of(reminders.repeatAdded.week) },
          ]}
        />
      </Block>
      <Block title="Shared events" note="Reminders sent to other people as a link. Each bar is a step along the way.">
        <Funnel
          tone="rose"
          steps={[
            { label: 'Shared events made', value: shared.created },
            { label: 'Link opened', value: shared.opened },
            { label: 'Added to someone’s reminders', value: shared.added },
            { label: 'App installed from a link', value: shared.installs },
          ]}
        />
        {(shared.cancelled > 0 || shared.reported > 0) && (
          <Note tone="amber" title="Also">
            {formatInt(shared.cancelled)} cancelled · {formatInt(shared.reported)} reported
          </Note>
        )}
      </Block>
    </>
  )
}
