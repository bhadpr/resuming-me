# Resuming.me — Build Spec

Personal-use web app (mobile-first, works on desktop) for tracking multiple recurring/deadline activities you tend to postpone, with a cross-activity pattern view as the core differentiator. Name: **Resuming** (resuming.me) — you paused, you're picking it back up; matches the Start/Stop/resume-later mechanic in §6 and the no-hype, no-shame tone the app is going for. No monetization, single user — backed by Supabase (Postgres + scheduled server jobs) rather than local-only storage, so data survives browser/device resets and rollover logic runs reliably.

## 1. Positioning (why this and not another habit app)

Existing apps (Habitica, Streaks, Finch) optimize one habit's streak. AI coaching apps (Macaron, Task Shell AI, Splitti) optimize one task's breakdown-and-chat. Neither shows the *shape of avoidance across everything a person is putting off at once*. That cross-activity pattern view is the thing to build well. Everything else (timers, checkboxes, streaks) is necessary plumbing, not the differentiator — keep it simple and cheap.

Explicitly out of scope for v1: voice/chat AI companion, gamification/points, social/accountability features, multi-user sync. These are where funded competitors spend their money; skip them.

**No separate marketing site.** One site only — the app itself. A landing/marketing page earns its keep when you need to explain a product to strangers and convert them into signups; nothing here has that shape, since this is personal-use and even the sharing features (§12, §15) work through direct links to specific people, not public discovery. Revisit only if this ever pivots toward public/open signup, which none of the current phases call for.

## 2. Activity Model

Every tracked thing is an **Activity** with one of three cadence types:

| Type | Example | Target | Reset |
|---|---|---|---|
| `daily` | Walk 1 mile, Read 10 min, Watch learning video 15 min | duration or count per day | resets every day |
| `weekly_n` | Gym 2x/week, 2-mile walk 2x/week | N completions per week | resets every week (Mon–Sun) |
| `deadline` | File taxes by Apr 15 | one-time completion by date | stays open past the deadline until completed or rescheduled |

### Activity fields
```json
{
  "id": "uuid",
  "name": "Read book",
  "emoji": "📚",                   // v1: single emoji icon, picked from an emoji picker
  "type": "daily | weekly_n",
  "trackingMode": "timer | count | checkbox",
  "target": { "value": 10, "unit": "minutes" },
  "targetEffectiveFrom": "2026-08-11",  // date the current target started applying
  "weeklyTarget": 2,               // only for weekly_n
  "deadline": "2026-04-15",        // only for type: deadline
  "microSteps": [],                // only for type: deadline, AI-generated on demand
  "createdAt": "iso-timestamp",
  "archived": false
}
```

`trackingMode` determines the UI:
- **timer** — Start/Stop button; accumulates seconds toward the target for that period (reading, walking, video, gym session length).
- **count** — tap "+1" (e.g., "did the gym visit," no duration needed).
- **checkbox** — single tap "done" (e.g., simple daily habit with no duration).

**Target changes are forward-only.** Editing an activity's target (e.g., Reading 10 min → 15 min) never rewrites history — it just updates `target` and stamps `targetEffectiveFrom` with today's date. Streaks, postponement counts, and Insights for past days keep evaluating against whatever target was active on that day; only today onward uses the new value.

**Deadline handling.** When a `deadline` activity's date passes without a `completed` entry, it doesn't silently close or archive. Instead it surfaces a prompt — on the Today screen and in Activity Detail — asking you to either mark it complete (if it actually got done and wasn't logged) or set a new deadline. It stays in this "overdue, needs a decision" state until you act; it never quietly disappears.

## 3. Metrics (day-by-day value tracking)

Separate from Activities. A **Metric** isn't something you complete or postpone — it's a number you log once a day and watch trend over time (weight, resting heart rate, hours slept, mood score, etc.). No target, no streak, no postponement logic.

```json
{
  "id": "uuid",
  "name": "Weight",
  "emoji": "⚖️",                   // v1: single emoji icon, picked from an emoji picker
  "unit": "lbs",
  "createdAt": "iso-timestamp",
  "archived": false
}
```

Entries are logged separately, one per day (overwrite if logged twice same day):
```json
{
  "id": "uuid",
  "metricId": "uuid",
  "date": "2026-08-11",
  "value": 178.4
}
```

- **Today screen**: metrics with no entry for today show a small "log value" input alongside the activity list, so it's one place to check in each day.
- **Metric Detail screen**: simple line chart of values over time (7/30/90-day toggle), plus min/max/avg and delta over the period.
- **Insights**: optionally overlay a metric trend against an activity's completion rate (e.g., "Weight trend vs. Gym completion this month") — this is a nice-to-have correlation, not MVP-critical, since it needs enough data points to mean anything.

## 4. Log Entries (the event stream)

Every action writes a log entry. This stream is what the pattern view is computed from.

```json
{
  "id": "uuid",
  "activityId": "uuid",
  "type": "session | postponed | completed",
  "startedAt": "iso-timestamp",
  "durationSeconds": 620,     // for timer sessions
  "date": "2026-08-11",       // the calendar day this entry counts toward
  "note": "optional reason for postponing",
  "createdAt": "iso-timestamp",
  "updatedAt": "iso-timestamp | null"
}
```

**Editing/correcting entries.** Log entries are editable and deletable, not strictly immutable — mistakes happen (wrong duration, accidental timer start, forgot to stop it for 3 hours). Any edit sets `updatedAt` and Insights always recompute from current values, so a correction made today fixes historical stats too. This trades strict immutability for accuracy, which matters more for a personal tool you're trying to trust.

**Postponement logging:** any `daily`/`weekly_n` activity that didn't hit its target for a closed day/week gets an automatic `postponed` entry, written by a server-side job (see §8) rather than something the client has to compute on open. User can also manually log "skip today" with an optional reason mid-day (better data than silence). Deadline activities surface the overdue prompt described in §2 rather than a silent `postponed` entry.

## 5. Screens

**Today** (home screen, mobile-first)
List of activities due today/this week, each showing: name, progress ring or checkbox, quick action (Start timer / +1 / Check off). Deadline tasks show days remaining. Metrics with no entry today show a quick value input. Sort activities by most-overdue-feeling first (longest current postponement streak on top) — this is the nudge.

**Activity Detail**
History list of log entries, current streak, postponement count (all-time and last 30 days), average session length for timer activities. Includes both **Archive** (hide from active lists, keep all history — the default, reversible) and **Delete** (permanent, only reachable from here, behind a confirmation: "This permanently deletes [activity name] and all its history. This can't be undone.") — delete cascades to remove that activity's log entries too, since orphaned entries serve no purpose once the activity itself is gone.

**Add/Edit Activity**
Form: name, type (daily/weekly_n/deadline), tracking mode, target value+unit, weekly count, deadline date.

**Insights** (the differentiator screen)
Computed purely from the log stream, no AI needed. Toggle between **week / month** views (7-day vs. 30-day windows) for everything below:
- Postponement rate per activity, for the selected window
- Time-of-day / day-of-week correlation ("You skip Gym on weekday evenings 80% of the time")
- Co-postponement ("When you skip Reading, you also skip Walk 63% of the time")
- Text summary, scaled to the selected window: "You completed 11/18 scheduled activities this week. Gym and Taxes are your two most-postponed items." becomes a monthly version ("42/72 this month...") when Month is selected.

**Deadline Task Detail**
Shows the AI-generated micro-steps (see §7) with checkboxes, days-to-deadline countdown.

## 6. Timer Mechanics (for reading/walking/video)

**Multiple independent sessions per day, summed toward the target.** Start/Stop is not one continuous session for the day — each Start...Stop pair is its own session entry. Read 5 min, tap Stop, close the app, come back an hour later and tap Start again for another 6 min: that's two separate `session` log entries (5 min + 6 min), and the day's progress toward the 10-min target is the sum, 11 min, done. There's no requirement to finish the target in one sitting.

- Tap Start → records `startedAt`, shows running duration.
- Tap Stop → writes a `session` log entry with `durationSeconds`. Recompute the day's total by summing all sessions for that activity+date; if the sum now meets `target`, mark the period complete.
- Support pause/resume *within* a single session (phone gets locked mid-walk) without that counting as a new session — store as one session with elapsed time tracked in local state, only write the log entry on Stop.
- If the app is closed mid-timer (mobile browser tab killed), persist `startedAt` to localStorage on Start so elapsed time can be recovered on reopen.

**Manual fallback entry.** Every timer-mode activity also gets a lightweight "or enter minutes manually" option next to Start, for cases where running the timer isn't practical (e.g., logging a walk after the fact). A manual entry writes the same `session` log entry shape, just with `source: "manual"` instead of `source: "timer"` so Insights can still tell the two apart if useful later, but both count identically toward the daily/weekly total.

```json
{
  "id": "uuid",
  "activityId": "uuid",
  "type": "session",
  "source": "timer | manual",
  "startedAt": "iso-timestamp",   // omitted or null for manual entries
  "durationSeconds": 300,
  "date": "2026-08-11"
}
```

## 7. AI Feature (on-demand only, cheap)

Only used for **deadline-type activities**, only when the user taps "Break this down":
- Call Claude Haiku (or gpt-4o-mini) with the task name, return exactly 3 micro-steps, <10 min each.
- Store result in `activity.microSteps`. No proactive/background AI calls, no chat, no voice — keeps cost near zero and avoids building the expensive part of the product.

## 8. Tech Recommendation (for Cursor implementation)

- **Stack:** Vanilla HTML/CSS/JS or lightweight framework (Alpine.js or plain React) for the frontend, talking directly to Supabase.
- **Storage / backend:** Supabase (hosted Postgres) instead of local-only storage. Tables: `activities`, `metrics`, `metric_entries`, `log_entries` — mirroring the JSON shapes above, one row per record, `updated_at` timestamps for the edit/correction flow in §4. Solves the data-loss risk of local-only storage (iOS Safari can evict `localStorage` after ~7 days of no interaction if the app isn't installed to the home screen) and gives a real backup that survives a device switch.
- **Auth:** Google sign-in (Supabase OAuth provider) as the primary method, rather than email magic-link. This is a single-user personal tool, but the app's whole premise is removing friction at the exact moment you're about to avoid something — waiting on an email round-trip to log 5 minutes of reading works against that. Google sign-in is one tap and keeps the session alive, so you're not re-authenticating to log something quick. Enable Row Level Security on every table (`activities`, `metrics`, `metric_entries`, `log_entries`), scoped to `auth.uid()` — cheap to set up now, painful to retrofit later, and it's the only thing keeping the data private even with just one user.
- **Local cache + offline support:** keep a thin local cache (localStorage or a small in-memory store) of today's activities for instant load and a responsive Start/Stop timer without round-tripping to Supabase on every tick. This also needs to work with no network connection — you're logging a walk or a reading session with the phone offline or on spotty signal. Queue timer sessions and manual entries locally when offline, and sync to Supabase as soon as connectivity returns; the UI shouldn't block or lose data just because the network dropped mid-session.
- **Server jobs for rollover, timezone-aware:** this is the piece that needed a real backend. Use a Supabase Edge Function scheduled via `pg_cron` (Supabase supports Postgres-native cron scheduling) running once daily (and once weekly, Monday) to scan for `daily`/`weekly_n` activities that missed their target for the closed period and write the `postponed` log entries server-side. The cron trigger itself runs on UTC, but "did today's target get missed" has to be evaluated in *your* local day boundary, not the server's — otherwise rollover fires a few hours early or late around midnight. Store the user's timezone (capture from the browser on first sign-in) and have the job compute each user's "day just closed" in their own timezone before checking targets. This is more reliable than computing rollover client-side on app open, since it doesn't depend on you actually opening the app that day to catch up.
- **Mobile-first PWA:** add a `manifest.json` (`name`/`short_name`: "Resuming") + service worker so it can be "Added to Home Screen" on the phone and opens full-screen like a native app, showing "Resuming" under the icon. Design layout mobile-first (single column, big tap targets), desktop is just a wider viewport of the same layout.
- **Notifications:** browser push notifications on mobile require a service worker + permission grant and have platform quirks (iOS Safari support is limited). For v1, skip push reminders — rely on opening the app. Revisit push as a v2 item, and note it pairs naturally with the rollover Edge Function once it exists (same job could trigger a push, not just log a postponement).

## 9. Suggested File Structure

```
/tracker
  index.html
  /js
    app.js          // routing/state
    supabase.js       // Supabase client init + auth
    activities.js    // activity CRUD (Supabase-backed)
    metrics.js        // metric CRUD + daily value entries (Supabase-backed)
    timer.js         // start/stop/session logic, local cache + sync on Stop
    log.js            // log entry read/write/edit/delete
    insights.js       // pattern computation
    ai.js              // on-demand micro-step breakdown call
    sharing.js          // create/revoke shares, share management UI
  /css
    style.css         // mobile-first
  /share
    [token].html        // public, unauthenticated view — live or weekly_report
  manifest.json
  sw.js
/supabase
  /migrations         // table definitions: activities, metrics, metric_entries, log_entries, shares, share_items
  /functions
    rollover.ts        // Edge Function: scans for missed targets, writes postponed entries
                        // scheduled via pg_cron, daily + weekly
    get-shared-data.ts  // Edge Function (or RPC): token -> scoped read-only data, checks revoked/expired
```

## 10. v1 Sprint Plan (build this first, step by step)

Broken into 10 small sprints, each with a clear "done" state, ordered so nothing depends on a sprint that hasn't happened yet. Hand these to Cursor one at a time rather than the whole spec at once — each sprint is small enough to review before moving on.

**Sprint 1 — Foundation.** Supabase project: `activities`, `metrics`, `metric_entries`, `log_entries` tables (§2-§4), RLS policies scoped to `auth.uid()` (§8), Google sign-in (§8), bare-bones PWA shell (`manifest.json`, service worker stub, mobile-first layout skeleton). *Done when:* you can sign in with Google and land on an empty authenticated app. *Test:* the RLS cross-account check from §11 — a second test account can't read the first's (empty) rows.

**Sprint 2 — Activity CRUD.** Add/Edit Activity screen (§5), all 3 cadence types (daily/weekly_n/deadline), archive + delete with confirmation (§5), emoji picker (§16 MVP note), forward-only target edits (§2). No tracking/logging yet — just managing the list. *Done when:* you can create, edit, archive, and permanently delete an activity of each type.

**Sprint 3 — Metric CRUD.** Same pattern as Sprint 2, for Metrics (§3): create/edit/archive, emoji, unit field. Small sprint, reuses most of Sprint 2's form patterns. *Done when:* you can create a metric like Weight and it exists, unattached to any tracking yet.

**Sprint 4 — Today screen (checkbox/count + metrics).** The home screen (§5): lists due activities, checkbox/count tracking modes wired to `log_entries`, quick metric value entry, most-overdue-first sorting. Timer mode still deferred. *Done when:* a Gym (count) or Walk (checkbox) activity can be marked done from Today, and today's weight can be logged.

**Sprint 5 — Timer mechanics.** Start/Stop for timer-mode activities (§6): multi-session-per-day summing, pause/resume within a session, recovery after app close, manual fallback entry, offline queuing + sync-on-reconnect (§8). *Done when:* Reading can be tracked in two separate sessions the same day and the total is correct, with or without a network connection.

**Sprint 6 — Detail screens + entry editing.** Activity Detail and Metric Detail screens (§5, §3): history list, streak, postponement count, average session length, trend chart. Log entry edit/delete (§4). *Done when:* you can review an activity's full history, correct a mistaken entry, and see the trend chart for a metric.

**Sprint 7 — Rollover + deadlines.** The `pg_cron`-scheduled Edge Function (§8) that closes out each day/week per-user in their own timezone and writes `postponed` entries; the deadline-passed prompt (§2) to mark complete or reschedule. *Done when:* leaving a daily activity untouched actually produces a postponed entry the next day, correctly timed to your timezone, and an overdue deadline surfaces the prompt instead of vanishing. *Test:* the rollover/timezone unit tests from §11 — write these test-first, per the note there.

**Sprint 8 — Insights.** The differentiator screen (§5): postponement rate, day/time correlation, week/month toggle, summary text (co-postponement can wait). *Done when:* Insights renders real numbers computed from whatever you've logged in Sprints 4-7, not sample data.

**Sprint 9 — AI micro-step breakdown.** On-demand "break this down" for deadline activities (§7): Haiku/gpt-4o-mini call, JSON parse with fallback on failure. *Done when:* tapping the button on a deadline activity produces 3 micro-steps, and a broken/empty API response doesn't crash the screen.

**Sprint 10 — Onboarding + hardening.** Landing/sign-in explainer (§16), first-run activity templates (§16), PWA install polish (confirm iOS "Add to Home Screen" survives idle time per §8's storage-eviction fix), and a pass through the remaining scenario and performance tests from §11 that weren't already covered sprint-by-sprint above. *Done when:* a brand-new sign-in gets a real first-run experience instead of a blank list, and the test suite from §11 is in a reasonable state.

**Defer to v2:** custom avatar/image upload per activity (photo picker, crop, Supabase storage bucket — real infra for a cosmetic feature, unlike the free-form emoji field which ships in v1), push notifications, co-postponement pattern analysis, multi-device conflict handling (Supabase gives you sync, but two devices editing the same session simultaneously is an edge case not worth solving for v1).

## 11. Testing Strategy

Worth being deliberate here because the highest-risk parts of this app are exactly the ones a quick manual click-through won't catch: date-boundary math, timezone handling, and data-scoping security. A silent bug in any of those quietly corrupts the thing the whole app is built around — trustworthy Insights.

**Unit tests — pure logic, no UI, run fast, run often:**
- Rollover/postponement calculation: given an activity's target, its logged sessions, and a "day just closed" boundary, does it correctly decide postponed vs. not — including a user's local timezone, not UTC (§8).
- Timer session summing: multiple sessions on the same day (e.g., 5 min + 6 min an hour apart, per §6) sum correctly and correctly trigger "target met."
- Forward-only target changes: a target edited today doesn't retroactively change whether a past day counts as postponed (§2).
- Insights math: postponement rate, streak calculation, day/time correlation, and the week/month toggle (§5) — feed known log data in, assert exact expected numbers out.
- Metric trend stats: min/max/avg/delta over 7/30/90-day windows (§3).
- AI micro-step response handling: valid JSON parses into 3 steps; malformed/empty response falls back gracefully instead of crashing (§7).

**Scenario / integration tests — multi-step flows against a real (test) Supabase project:**
- Add a daily timer activity → start → stop twice across separate sessions → total reflects the sum → marks complete once target is met.
- Let a daily activity's window close unmet → rollover job runs → exactly one `postponed` entry appears, dated correctly for the user's timezone.
- Edit a past log entry's duration → Insights for that period recompute to reflect the correction (§4).
- Archive an activity → disappears from Today, historical Insights/streaks still reference it correctly. Delete an activity → it and its log entries are gone everywhere, including Insights (§5).
- A deadline passes uncompleted → overdue prompt appears → "set new deadline" updates the date and clears the prompt; "mark complete" closes it out (§2).
- Go offline mid-timer, log a session, reconnect → session syncs exactly once, no duplicate and no loss (§8).
- Create a share link scoped to 2 of 5 activities → open the link unauthenticated → only those 2 appear, nothing else is reachable even by guessing IDs. Revoke the link → immediate 404/no-access on next load (§12).

**Security-specific tests — don't skip these even for a single-user app:**
- RLS check: a second test account cannot read the first account's rows via the Supabase client, even with a valid session of its own.
- Share token check: an invalid, expired, or revoked token returns nothing — never a partial/error response that leaks structure.

**Manual QA checklist (mobile-first specifics that don't unit-test well):**
- "Add to Home Screen" on iOS Safari, then confirm the app still opens/functions after 7+ days idle (validates the storage-eviction fix from moving to Supabase, §8).
- Timer survives phone lock/unlock and an accidental tab close mid-session.
- Offline → airplane mode → log a manual entry and a timer session → reconnect → both appear once, correctly.

**Performance testing:** lighter weight for a single-user app, but worth a few concrete checks so the app stays snappy on the phone where it's mostly used:
- Today screen load time on a throttled mobile connection (simulate 3G in Chrome DevTools/Lighthouse) — this is the screen opened most often, it should feel instant.
- Timer Start/Stop should never wait on a network round-trip (§8's local-cache design exists specifically for this) — verify the UI updates immediately and the Supabase write happens in the background.
- Insights computation time as log history grows — run it against a seeded year of daily data (roughly a few thousand log entries across 10-ish activities) and confirm it still renders in well under a second; if it creeps up, that's a signal to move from computing Insights live on every load to a cached/materialized rollup.
- Rollover Edge Function execution time — should complete quickly for one user's data; not a real concern at personal-use scale, but see the scale note below for why this one doesn't stay simple forever.
- Public share page load time — it's unauthenticated and meant to be a quick glance for someone else, so it should load fast even on their connection, not just yours.

None of this needs to be exhaustive before writing code — but the rollover/timezone logic and the RLS/sharing security tests are worth writing test-first, since bugs there are silent and would quietly undermine the data you're trusting for Insights.

**Schema at scale (hypothetical — not a v1 requirement).** You asked how this schema would hold up at 1M users, worth answering honestly even though nothing in the current phases (§1: no marketing site, no public signup) points there. The encouraging part: the schema's shape wouldn't need to change. Every table is already scoped by an owner id with RLS (§8) — that's the correct multi-tenant pattern regardless of whether there are 1 or 1,000,000 owners, so there's no redesign lurking later from today's choices. What would actually need attention at that scale, roughly in order of when it'd bite:
- `log_entries` becomes the dominant table by far — 1M users × a handful of activities × daily use lands in the hundreds of millions to low billions of rows per year. It'd need a composite index on `(user_id, date)` (cheap to add now, worth doing regardless of scale) and eventually time-based partitioning (e.g., monthly) once row counts get into the billions, so queries and vacuum stay fast and old partitions can be archived cheaply.
- The rollover Edge Function (§8) is conceptually "for each user whose day just closed, check targets" — fine as one function run for a handful of users, but at 1M users a single sequential loop would time out. It'd need to become a fan-out: a lightweight dispatcher enqueues one job per user (or per timezone bucket, since many users share a timezone) into a queue table, processed by a worker pool instead of one long-running function.
- RLS policies need to stay simple equality checks (`auth.uid() = user_id`) rather than subqueries, so Postgres can use the index directly — this is already the right pattern, just worth not drifting from it as more tables/joins get added.
- Connection pooling (Supabase's PgBouncer transaction-mode pooled connection string) matters once there's real concurrent traffic — irrelevant at 1 user, standard practice past a few thousand.
- The real constraint before any of this is engineering: at 1M users, Postgres row storage plus email/push sending costs (§13) become a genuine line item, not an afterthought.

None of this is worth building now — partitioning `log_entries` on day one for a personal tracker would be premature optimization. It's here so the v1 schema choices don't paint you into a corner if this ever did grow, and they don't.

## 12. v1.2 — Sharing

Its own phase, built as a fast-follow once the core MVP (§10, v1) is solid, not bundled into it and not the same phase as v1.5 email (§13) — it's a distinct chunk of work (public routes, new tables, a report renderer) and the core tracking loop should be trustworthy first.

**Model:** link-based, like sharing a Google Doc. No account needed for whoever you share with — they open a URL, no sign-in. You choose per-share which activities/metrics are included (default: nothing is shared until you explicitly pick items), and you can revoke a link at any time, which immediately kills access.

```json
// shares table
{
  "id": "uuid",
  "ownerUserId": "uuid",
  "token": "long-random-url-safe-string",
  "label": "Mom | Accountability partner | etc.",
  "type": "live | weekly_report",
  "createdAt": "iso-timestamp",
  "revokedAt": "iso-timestamp | null",
  "expiresAt": "iso-timestamp | null"
}

// share_items table (join)
{
  "shareId": "uuid",
  "itemType": "activity | metric",
  "itemId": "uuid"
}
```

**Two share types, same underlying mechanism:**
- **Live** — shows today's/this-week's current progress for the selected items (e.g., "Reading: 6/10 min today," "Gym: 1/2 this week"). Refresh-to-update: the viewer sees current state when they open or reload the link — no push/real-time updates, keeps this simple to build. Doesn't show the timer ticking live, just the cumulative total as of last refresh.
- **Weekly report** — same link, reuses the Insights computation from §5 but scoped only to the shared items (never cross-activity correlations with things you didn't share, to avoid leaking unshared activity names through pattern language): last-7-days completion rate, current streak, postponement count, for each shared item only.

**Access path (important for security):** the public `/share/:token` page uses the anon key, but must never query the underlying tables directly — RLS is scoped to `auth.uid()` for your own data, and a token holder has no `auth.uid()`. Instead, expose a single Postgres RPC function (`security definer`) or Edge Function that takes the token, checks it's not revoked/expired, and returns only the scoped, pre-shaped data for the items in `share_items`. This keeps the token as the only thing gating access, and guarantees a leaked/guessed token can't be used to query anything beyond what was explicitly shared. Tokens should be long, random, and unguessable (e.g., 32 bytes, URL-safe).

**Housekeeping:** if a shared activity is later archived or deleted, the share should degrade gracefully ("this item is no longer tracked") rather than error. Share Management screen: list of active shares with label, type, items included, and a Revoke button.

## 13. v1.5 — Email Notifications (parked between v1 and v2)

Push notifications (§8) are deferred to v2 due to Service Worker + iOS home-screen-install complexity. Email is a cheaper stopgap that reuses infrastructure already in the spec, worth doing as its own small phase after Sharing (§12) rather than bundled into the MVP.

- **Weekly and monthly report email** — reuses the same Insights computation (now with the week/month toggle from §5) and weekly-report logic from §12, rendered as an email instead of (or alongside) the shareable link. Weekly sent every week; monthly sent on the same cadence as the 30-day Insights window, first-of-month. Sent to yourself (and optionally to anyone you've shared the report with, if they opted in — out of scope for v1.5, worth a separate look at consent/opt-out if it ever extends beyond just you).
- **Daily reminder email** — rides the same daily rollover Edge Function (§8) that already runs on a schedule; it just also sends an email at a chosen time in addition to writing `postponed` entries. Explicitly a stopgap, not a replacement for push: email lacks the "tap now" immediacy and can easily pile up unread, which works against the app's whole purpose. Fine as a bridge until push ships in v2.
- **Infra needed:** an email-sending provider (Resend or Postmark are the common lightweight choices) wired into the existing Supabase Edge Functions via API key — no new scheduling system required, just an added send step in jobs that already exist.

## 14. Future / v2 — Beyond Tracking

v1 is deliberately just logging + analytics: capture what you do and don't do, and show the pattern back to you. It does not yet try to actively help you close the gap.

Once there's enough real log data to make this accurate (not guesswork), consider:
- Predictive nudges — notification before your usual skip time, based on your own historical pattern ("you skip Gym at 6pm on Wednesdays — want a reminder at 5:45?")
- Smarter micro-step suggestions informed by which past breakdowns actually led to completion vs. still got postponed
- Adaptive targets — if an activity gets postponed repeatedly, suggest lowering the bar temporarily (2 min instead of 10) rather than letting it silently fail
- Weekly review prompt that surfaces the Insights summary and asks you to adjust targets/deadlines

None of this is needed until the core log + Insights loop is working and there's a few weeks of real data to act on.

## 15. Future / v3 — Compete / Duels (parked idea)

A mutual, two-way version of sharing: instead of a one-way link, two account-holders pair up and see each other's progress side by side — e.g., you have a 10-min reading goal, a friend has a 15-min goal, and you both watch each other's daily progress as friendly competition.

This is architecturally distinct from §12's link-based sharing (which is deliberately account-free for the viewer): Compete requires both people to be signed-in users with their own tracked activities, a mutual invite/accept flow, and manual pairing of "my activity" to "their activity" (auto-matching by name is fragile — goals rarely match exactly). Comparison view should stay a mirror (side-by-side progress) rather than a scored leaderboard, to avoid drifting into the gamification territory intentionally left out of v1.

Revisit after Sharing (§12) ships and there's a sense of how much v1/v2 usage actually happens solo — no design work needed until then.

## 16. Onboarding

**Landing screen — "what this is and how it helps you."** Before sign-in, the home screen isn't just a bare login button — a short block (2-3 lines of text plus a simple screenshot or diagram, no recorded video for v1.2) explains what the app does and the actual benefit: it tracks the things you keep postponing and shows you the pattern across all of them, so you can see and act on avoidance instead of it staying invisible. This matters even for a single-user personal tool — it's a reminder of *why* every time you land here, and it's what a friend sees if they ever open the site directly (e.g., before you send them a Compete invite in §15). Reuse the same short explainer block on the public share page (§12) so a friend opening a live/weekly-report link immediately understands what they're looking at, not just raw numbers with no context.

**First-run activity setup.** After sign-in, the experience shouldn't be a blank activity list. Offer a quick setup flow with a handful of pre-filled templates matching common cases (daily timer habit like "Read 10 min," weekly count habit like "Gym 2x/week," one-off deadline like "File taxes") so there's something to interact with immediately rather than requiring a from-scratch Add Activity flow before the app feels useful.
