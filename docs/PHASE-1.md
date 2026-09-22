# Resuming — Phase 1 Implementation Spec: Fix & Build Trust

Goal: every number is correct, every screen has a URL, the site loads fast, and the basics (SEO, icons, account controls) are in place. No new product features in this phase.

## How to use this file with Cursor

Save this file in the repo as `docs/PHASE-1.md`.
Open Cursor chat (Agent mode) and paste:

> Read docs/PHASE-1.md and the "Context" section carefully. First, confirm the stack and point out anything in the spec that doesn't match the actual code. Then implement task P1-01 only. Keep changes minimal and focused, don't refactor unrelated code, and list how I can test it when you're done.

Test, commit, then repeat with P1-02, P1-03, and so on in the order below.
One task = one commit (or PR). If a task feels too big, ask Cursor to split it.

## Context (observed from the live site, Sep 22 2026 — Cursor must verify against the repo)

Frontend: React + Vite, PWA via vite-plugin-pwa / Workbox, Capacitor for the Android build. No React Router — navigation is custom state plus `history.pushState` for a few paths (`/settings`, `/about`, `/privacy`, `/terms`, `/feedback`, `/admin/feedback`).
Backend: Supabase (Google auth, Postgres, RLS). Tables seen: `profiles`, `activities`, `activity_target_history`, `log_entries`, `metrics`, `metric_entries`, `feedback`, `page_views`.
`log_entries.type` values: `completed`, `session` (timer/manual minutes, `source` = `timer` | `manual`), `postponed` (unique per activity per day — insert returns 23505 on duplicate).
Day status is computed client-side as `met` / `postponed` / `open`, displayed as `done` / `skipped` / `open`.
"Easy win" constants: `iv` = 5, `sv` = 2 (minutes), localStorage key `resuming-easy-wins`.
Themes: six themes, and `index.html` loads 11 Google Font families up front.
Privacy/Terms: `/privacy` is a real static HTML page; `/terms`, `/about`, `/feedback` are rendered by the SPA.

## Global rules for every task

- Keep the calm, no-shame tone in all copy. Never show a failure count as a headline.
- No new dependencies unless the task says so or you explain why.
- Every data-changing action must be reversible for at least a few seconds (see P1-02).
- Must work on mobile web (375 px wide), desktop, and the Capacitor Android build.
- Don't break the offline sync queue: any new write goes through the same queue path as existing writes.
- Add or update tests where a test setup exists; otherwise include manual test steps in the commit message.

## Recommended order

| Order | Task | Size |
|-------|------|------|
| 1 | P1-01 "Make it even smaller" must never log by itself | S |
| 2 | P1-02 Undo for every log action | M |
| 3 | P1-03 One shared day-status rule | M |
| 4 | P1-04 Stop auto-logging "Put off"; add Pause and Rest day | L |
| 5 | P1-05 Real URL for every screen + scroll reset | M |
| 6 | P1-06 UI fixes: emoji grid, truncated labels, streak stat | S |
| 7 | P1-07 Performance: fonts, code-splitting, instant Today | M |
| 8 | P1-08 SEO basics and real 404 | M |
| 9 | P1-09 App icons and manifest | S |
| 10 | P1-10 Export my data + Delete my account | M |
| 11 | P1-11 Admin lockdown | S |
| 12 | P1-12 Product analytics events | M |

---

## P1-01 — "Make it even smaller today" must never log by itself

**Problem (reproduced):** On Today, the welcome-back card shows "Try Meditate · 5 min" with Start and Make it even smaller today. One tap on "Make it even smaller today" immediately created a session log entry of 2 min (`source: manual`) for Meditate, marked it "Done today", and replaced the card with "Resume now: Walk · 20 min" — which is bigger, not smaller. No confirmation, no undo. The handler is roughly `onClick: () => I(item, sv)` with `sv = 2`.

**Required behavior:**

- Tapping "Make it even smaller today" does **not** write anything. It expands the card in place to show choices:
  - "2 minutes" (default highlighted)
  - "1 minute"
  - "Just get started" (opens the timer with no target)
- Picking a choice starts the timer at that target (for timer activities) or shows a single "Done" button (checkbox/count activities). The card copy changes to e.g. "Just 2 minutes of Meditate. That counts."
- A log is written only when the user stops the timer or taps Done — through the normal session/completed path.
- A 2-minute session on a 5-minute target counts as **partial**, not done (see P1-03), but the card celebrates it: "You resumed Meditate."
- After logging, the next suggestion must be an activity whose target is ≤ the one just done, or no suggestion ("That's enough for today. Nice.").
- "Make it even smaller" is also available on the timer screen while it's running.

**Acceptance criteria:**

- [ ] Tapping "Make it even smaller today" creates zero rows in `log_entries` (verify in Supabase).
- [ ] Choosing "2 minutes" and stopping the timer at 2:00 creates exactly one `session` row with `source: timer`, `duration_seconds` ≈ 120.
- [ ] Closing or cancelling the choice sheet writes nothing.
- [ ] The follow-up suggestion is never a larger target than what was just done.

---

## P1-02 — Undo for every log action

**Problem:** Done, +1, "enter minutes manually", Log (numbers), and stopping a timer all write immediately with no way to reverse except finding the entry in the activity's history.

**Required behavior:**

- After any write, show a toast at the bottom (above the tab bar) for 6 seconds: "Logged 2 min of Meditate · Undo".
- Undo deletes that exact row by id (or removes it from the offline queue if not yet synced) and restores the UI state.
- Only one toast at a time; a new action replaces the old toast (the old action stays committed).
- Toast is accessible: `role="status"`, focusable Undo button, and doesn't cover the tab bar.
- Build it as a reusable `useUndoToast()` hook plus a `<Toast/>` component.

**Acceptance criteria:**

- [ ] Every write action listed above shows the toast.
- [ ] Undo within 6 s leaves no row in `log_entries` / `metric_entries`.
- [ ] Undo works offline (the queued item is removed).
- [ ] Today, the activity detail and Insights all update immediately after undo.

---

## P1-03 — One shared day-status rule used everywhere

**Problem (reproduced):** After one 2-min log, Today showed "Done today · 1", the Meditate detail said "0 done · 29 skipped", and Insights said "0 of 185 done this month" yet also "Most completions/sessions land in the night (2)". The same data gives different answers on different screens.

**Required behavior:**

Create one pure function (e.g. `src/lib/dayStatus.ts`) that is the only place a day's status is computed:

```ts
type DayStatus = 'done' | 'partial' | 'skipped' | 'rest' | 'paused' | 'missed' | 'open';

getDayStatus({ activity, entriesForDay, date, today, timezone }): {
  status: DayStatus;
  value: number;       // minutes, count, or 1/0 for checkbox
  target: number;
}
```

**Rules:**

- `done`: target met — timer minutes ≥ target, count ≥ target, a completed entry for checkbox, or the weekly/monthly quota met for that period.
- `partial`: some progress logged, target not met.
- `skipped`: the user explicitly chose "Skip today" (a postponed row created by a user action, see P1-04).
- `rest`: the user marked a rest day (P1-04).
- `paused`: the activity is paused for that date (P1-04).
- `missed`: past day, nothing logged, not skipped/rest/paused. Neutral, not a failure.
- `open`: today, nothing logged yet.
- Deadline activities: done once completed, open until the due date, missed after it.

Today, activity detail (chart, counts, history), Insights (week/month headlines, per-activity bars, patterns), and Numbers must all call this function. Delete any duplicate status logic.

Insights counts: "done" = done; "showed up" = done + partial. Patterns ("When you show up") count done + partial sessions.

Timezone: use the user's saved timezone for "what day is it", consistently.

Add unit tests for every status × activity type (daily timer, daily checkbox, daily count, weekly N, monthly, deadline).

**Acceptance criteria:**

- [ ] With a single 2-min session on a 5-min daily target: Today shows it as partial ("2 / 5 min"), detail shows 1 partial, Insights shows 1 "showed up" and 0 done, and "When you show up" shows 1.
- [ ] No screen computes status on its own (search for old helpers and remove them).
- [ ] Tests pass.

---

## P1-04 — Stop auto-logging "Put off"; add Pause and Rest day

**Problem:** A postponed row is written for each past day with no activity (e.g. Meditate has "Put off" on almost every day from Aug 23 to Sep 21 — and Sep 12 has both a "Put off" and two timer sessions). A user who simply didn't open the app looks like they skipped 29 of 30 days. This contradicts the no-shame promise and makes Insights meaningless.

**Required behavior:**

- Stop creating postponed rows automatically. Find the code that backfills them (likely on app load / day rollover, calling the postponed insert that swallows 23505) and remove it. Missing days become `missed` at read time via P1-03.
- `postponed` rows are created only by an explicit user action: a "Skip today" option in each Today row's overflow menu, with an optional reason chip ("Too tired", "No time", "Didn't feel like it", "Other") saved in the existing `note` column.
- **Pause** an activity: in activity detail, "Pause" with options "1 week", "2 weeks", "Until I resume". Paused activities are hidden from Today and excluded from Insights totals for those dates. Needs `paused_from` / `paused_until` date null on `activities` (or a small `activity_pauses` table if multiple pauses must be kept — prefer the table).
- **Rest day:** on Today, a small "Take a rest day" link at the bottom marks all of today's activities as rest (new `log_entries.type = 'rest'` or a `rest_days(user_id, date)` table — prefer the table). Limit is not needed.
- **Existing data migration:**
  - Add `log_entries.source = 'auto'` to backfilled postponed rows. Heuristic: postponed rows whose `created_at` (in user timezone) is later than their `date`, or created in a batch on the same second. Cursor: inspect real rows first and propose the exact rule before running it.
  - Treat `source = 'auto'` postponed rows as `missed`, not `skipped`, in P1-03. Don't delete them yet (keeps a rollback path).
  - Update RLS policies for any new table (user can only read/write their own rows).

**Acceptance criteria:**

- [ ] Leaving the app closed for 3 days creates no new rows.
- [ ] Those 3 days show as `missed` (neutral styling) in detail and Insights.
- [ ] "Skip today" creates one postponed row with the chosen note; it can be undone (P1-02).
- [ ] A paused activity disappears from Today and doesn't count against Insights for the paused dates.
- [ ] Existing auto-created "Put off" history rows display as missed days.

---

## P1-05 — Real URL for every screen + scroll reset

**Problem:** Today, Activities, Numbers, Insights, Add activity and activity detail all live at `/`. Browser Back, refresh, sharing a link, and deep links from reminders don't work. Opening an activity from a scrolled list also lands mid-page.

**Required behavior:**

Add React Router (v6+/v7 data router) and replace the custom navigation state. Routes:

| Path | Screen |
|------|--------|
| `/` | Landing (signed out) or redirect to `/today` (signed in) |
| `/today` | Today |
| `/activities` | Activities list |
| `/activities/new` | Add activity |
| `/activities/:id` | Activity detail |
| `/activities/:id/edit` | Edit activity |
| `/numbers` | Numbers list |
| `/numbers/new`, `/numbers/:id` | Add / detail number |
| `/insights?range=week\|month` | Insights (range in the query string) |
| `/settings` | Settings |
| `/admin/analytics`, `/admin/feedback` | Admin (guarded, see P1-11) |
| `/about`, `/privacy`, `/terms`, `/feedback` | Public pages |
| `*` | Not found (P1-08) |

- Signed-out visitors hitting an app route are sent to `/` with `?next=/activities/123`, then returned there after sign-in.
- Bottom tab bar uses `<NavLink>`; the active tab follows the URL.
- Scroll: new navigation scrolls to top; browser Back restores the previous scroll position (React Router `<ScrollRestoration/>`).
- Capacitor Android: make sure the hardware back button follows router history and exits only from `/today`.
- Host config: SPA fallback so direct loads of these paths serve `index.html` (check the host — Vercel/Netlify/Cloudflare — and add the right rewrite rule).

**Acceptance criteria:**

- [ ] Each screen shows its own path in the address bar.
- [ ] Refreshing any screen reopens the same screen.
- [ ] Back/forward work across all screens, including from activity detail back to the scrolled list position.
- [ ] Opening an activity always starts at the top of its page.
- [ ] Pasting `/activities/<id>` in a new tab while signed in opens that activity.

---

## P1-06 — UI fixes: emoji grid, truncated labels, streak stat

1. **Emoji grid overflow (Add/Edit activity):** the 8-column emoji grid extends past the right edge of the card. Use `grid-template-columns: repeat(auto-fill, minmax(40px, 1fr))` with gap inside the card's padding, and make sure nothing overflows at 320 px width.
2. **Truncated pattern label (Insights → Patterns):** "When you show up" shows the value as "nig" — the label is being sliced to 3 characters (fine for weekdays, wrong for time buckets). Use full labels for time buckets: "Morning", "Afternoon", "Evening", "Night".
3. **Streak stat (activity detail):** remove "Days in a row" / "Weeks in a row" / "Months in a row" (`currentStreak`). Replace with "Comebacks (30d)": the number of times in the last 30 days the user did the activity (done or partial) after 2+ missed days. Compute it with the P1-03 function.
4. **Bottom padding:** make sure the last element on every page (e.g. "Create activity" button) is never hidden behind the fixed tab bar (`padding-bottom: calc(tab-bar-height + env(safe-area-inset-bottom) + 16px)`).
5. **History list (activity detail):** group entries by month with a sticky month header, and collapse runs of consecutive missed days into one row ("Aug 23 – Sep 21 · quiet").

**Acceptance criteria:**

- [ ] No horizontal overflow on Add activity at 320, 375 and 1440 px widths.
- [ ] Patterns show "Night", not "nig".
- [ ] No streak counts anywhere in the app.
- [ ] History shows month groups and collapsed quiet stretches.

---

## P1-07 — Performance: fonts, code-splitting, instant Today

**Measured:** first contentful paint ≈ 3.6 s even with the service worker cache; main JS bundle ≈ 580 KB; `index.html` loads 11 Google Font families (Cormorant Garamond, DM Sans, Fraunces, IBM Plex Sans, JetBrains Mono, Libre Franklin, Outfit, Plus Jakarta Sans, Rajdhani, Source Sans 3, Source Serif 4). Today shows "Loading…" before content.

**Required behavior:**

- **Fonts:** load only the default theme's fonts in `index.html` (max 2 families, only the weights actually used). Load other themes' fonts on demand when a theme is selected (inject a `<link>` at runtime). Consider self-hosting the default fonts as woff2 with `font-display: swap` and a preload.
- **Code-splitting** with `React.lazy` + `Suspense`: Admin, Insights (and its charts), Settings, legal/about pages, Feedback, Add/Edit activity. Landing and Today stay in the main chunk.
- **Instant Today:** cache the last Today payload (activities + today's entries) locally and render it immediately on load, then refresh from Supabase in the background. Replace "Loading…" with skeleton rows shaped like activity cards.
- Run `vite build` with `rollup-plugin-visualizer` once, find the biggest dependencies, and remove or lazy-load anything unused on first screen.
- Compress the landing image (currently 960×640 JPG) to WebP/AVIF with `srcset` and explicit width/height.

**Targets (Lighthouse mobile, simulated 4G):**

- [ ] Largest Contentful Paint < 2.0 s on landing and Today
- [ ] Initial JS < 200 KB compressed
- [ ] Performance score ≥ 90
- [ ] No "Loading…" text on Today for returning users

---

## P1-08 — SEO basics and real 404

**Problem:** Title is only "Resuming" on every page, no Open Graph/Twitter tags (shared links show no preview), no structured data, `/robots.txt` and `/sitemap.xml` return the app shell, any made-up URL returns the app with status 200, and footer links (About/Terms/Feedback) are `<button>`s so crawlers can't follow them.

**Required behavior:**

- Per-route `<title>` and meta description (e.g. React 19 native `<title>`/`<meta>` in components, or `react-helmet-async`):
  - Landing: "Resuming — Get back to your habits without the guilt"
  - About / Privacy / Terms / Feedback: "About · Resuming", etc.
  - App routes: "Today · Resuming" and add `<meta name="robots" content="noindex">` for all signed-in app routes.
- Open Graph + Twitter: `og:title`, `og:description`, `og:url`, `og:image` (new 1200×630 PNG with logo + tagline + warm illustration), `og:type=website`, `twitter:card=summary_large_image`. Add `<link rel="canonical">`.
- Static files in `/public`: `robots.txt` (allow all, disallow `/today`, `/activities`, `/numbers`, `/insights`, `/settings`, `/admin`; point to sitemap) and `sitemap.xml` listing `/`, `/about`, `/privacy`, `/terms`, `/feedback`.
- Pre-render public pages (`/`, `/about`, `/terms`, `/feedback`) to static HTML at build time (e.g. `vite-plugin-prerender` or a small script), so search engines and link previews see real content. `/privacy` is already static — keep it consistent.
- JSON-LD on the landing page: `SoftwareApplication` with name, description, `applicationCategory` LifestyleApplication, `operatingSystem` Web, Android, offers price 0, publisher Cheerful Games, Inc.
- Footer links become real `<a href="/about">` etc. (router `<Link>`).
- **404:** a friendly Not Found page ("This page took a break. Let's get you back.") with a button to `/`. Configure the host so unknown paths return HTTP 404 (not 200); at minimum add `noindex` on the Not Found page.

**Acceptance criteria:**

- [ ] Sharing https://resuming.me in WhatsApp/iMessage/Slack/LinkedIn shows the image, title and description.
- [ ] `curl -I https://resuming.me/robots.txt` returns `text/plain`; `/sitemap.xml` returns XML.
- [ ] `curl -I https://resuming.me/does-not-exist` returns 404.
- [ ] Viewing page source of `/about` shows the About text (pre-rendered).
- [ ] Lighthouse SEO score ≥ 95 on landing.

---

## P1-09 — App icons and manifest

**Problem:** `manifest.webmanifest` only has `logo.svg` (sizes: any), and `apple-touch-icon` points to an SVG. iOS ignores SVG touch icons, and Android install prompts want PNGs.

**Required behavior:**

- Generate from the logo: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` (safe zone padding, cream background `#fff4e8`), `apple-touch-icon.png` (180×180), `favicon.ico` (32×32) — keep `favicon.svg` too.
- Manifest: add these icons with correct `purpose` (any / maskable), plus `id: "/"`, `start_url: "/today"`, `categories: ["lifestyle", "productivity", "health"]`, and 2–3 screenshots (mobile, `form_factor: narrow`) for the richer Android install dialog.
- Update `<link rel="apple-touch-icon" href="/apple-touch-icon.png">`.

**Acceptance criteria:**

- [ ] Chrome DevTools → Application → Manifest shows no warnings and "Installable".
- [ ] "Add to Home Screen" on iPhone shows the real icon, not a screenshot.

---

## P1-10 — Export my data + Delete my account

**Problem:** Export and deletion are "email us" only (per the Privacy Policy). Google Play (and Apple, later) require in-app account deletion.

**Required behavior:**

- Settings → Account → "Export my data": downloads a ZIP (or one JSON file if simpler) with the user's rows from `profiles`, `activities`, `activity_target_history`, `log_entries`, `metrics`, `metric_entries`, `feedback`, plus a CSV of `log_entries` for spreadsheets. Filename: `resuming-export-YYYY-MM-DD.zip`.
- Settings → Account → "Delete my account":
  - Confirmation screen explains what is deleted, offers Export first, and requires typing `DELETE`.
  - Calls a Supabase Edge Function (`delete-account`) that verifies the user's JWT, deletes all their rows (or relies on `ON DELETE CASCADE` from `auth.users` — verify FKs), then deletes the auth user with the service role key.
  - Signs out, clears local storage/IndexedDB/offline queue, and shows "Your account has been deleted."
- Add a public page `/delete-account` explaining how to delete (needed for the Google Play listing), linking to the in-app option.
- Update the Privacy Policy "Your choices & rights" section to mention the in-app options (keep `resuming.me@gmail.com` as the fallback).

**Acceptance criteria:**

- [ ] Export contains all the user's data and nothing from other users.
- [ ] After deletion, no rows for that `user_id` remain in any table, and the Google account can sign up fresh.
- [ ] The service role key is never shipped to the client.

---

## P1-11 — Admin lockdown

Contact email: no change. Keep `resuming.me@gmail.com` as the contact address for now (decided by Bhadresh). Just make sure it's defined in one constant (e.g. `src/config.ts` → `CONTACT_EMAIL`) and used everywhere, so it's a one-line change later.

**Admin:** Settings shows an "ADMIN" section (Analytics, Feedback). Make sure:

- It renders only when `profiles.is_admin = true` (or a Supabase custom claim) — not based on a hard-coded email in the client.
- `/admin/*` routes are guarded and redirect non-admins to `/today`.
- RLS on `page_views` and `feedback` allows select only for admins (and insert for anyone). Test with a non-admin account using the Supabase client in the browser console.

**Acceptance criteria:**

- [ ] A non-admin account sees no Admin section and gets redirected from `/admin/feedback`.
- [ ] A non-admin `select` on `feedback` / `page_views` returns zero rows or a permission error.
- [ ] The contact email appears in the code only through the `CONTACT_EMAIL` constant (static `/privacy` HTML excepted).

---

## P1-12 — Product analytics events

**Why:** Phase 2 (onboarding) needs a baseline. Today only page views are tracked (`page_views` table).

**Required behavior:**

- New table `events(id, created_at, user_id null, anon_id, name text, props jsonb, path text, app_version text, platform text)` with RLS: insert for anyone, select for admins only.
- A tiny `track(name, props?)` helper that batches events (send every 10 s or on `visibilitychange`), works offline through the existing queue, and never blocks the UI.
- Events to add now:

| Event | When | Props |
|-------|------|-------|
| `landing_viewed` | Landing shown | `referrer` |
| `signin_clicked` | "Continue with Google" tapped | — |
| `signup_completed` | First sign-in creates a profile | — |
| `activity_created` | Add activity saved | `type`, `tracking`, `target` |
| `log_created` | Any log written | `activity_type`, `kind` (session/completed/count), `minutes`, `was_partial` |
| `log_undone` | Undo tapped | `kind` |
| `smaller_opened` / `smaller_chosen` | P1-01 | `choice` |
| `skip_today` | P1-04 | `reason` |
| `activity_paused` / `rest_day` | P1-04 | `duration` |
| `comeback` | A log after 3+ missed days | `gap_days` |
| `insights_viewed` | Insights opened | `range` |
| `app_opened` | App becomes visible | `days_since_last_open` |

- Add an Admin → Analytics card showing, for the last 7/30 days: sign-ups, D1/D7 retention, logs per active user, and comeback count. (Simple SQL views are fine.)
- Update the Privacy Policy "Technical & device data" paragraph to mention first-party product events (no third parties).

**Acceptance criteria:**

- [ ] Events appear in the `events` table within ~10 s of the action.
- [ ] No event contains activity names, notes or other personal text.
- [ ] Admin Analytics shows D1/D7 retention and comebacks.

---

## Definition of done for Phase 1

- [ ] All 12 tasks merged and deployed.
- [ ] Manual smoke test on iPhone Safari, Android Chrome, desktop Chrome, and the Android app: sign in, add activity, make it smaller, log, undo, skip, pause, view Insights week/month, export, back button everywhere.
- [ ] Lighthouse mobile on landing: Performance ≥ 90, SEO ≥ 95, Accessibility ≥ 95, PWA installable.
- [ ] One week of real usage data flowing into `events` before starting Phase 2.

---

## Decisions log (answers to Cursor's questions)

### P1-01

- **Partial before P1-03:** stop `applyEasyWins` forcing `done: true`. Show real progress ("2 / 5 min") plus the celebration copy "You resumed Meditate." Add a small temporary helper `isPartialToday(activity, minutes)` (minutes > 0 and < target) used only by Today to show a soft "partial" label instead of "open" or "done". Mark it `// TODO(P1-03): replace with getDayStatus`.
- **Non-timer activities:** keep "Make it even smaller" timer-only for P1-01. Checkbox/count are already the smallest step; revisit in Phase 2.
- **"Just get started":** confirmed. Timer runs with no target until Stop, then logs elapsed time through the normal `source: timer` path. If elapsed is under 30 seconds, don't log; show "No worries. Try again anytime."
- **Where the control lives:** on the welcome card and next to the running inline timer on Today. There's no separate timer screen.
- **Follow-up suggestion:** only among timer activities, comparing target minutes. If no timer activity has a target ≤ the one just done, show no suggestion ("That's enough for today. Nice.").

### Later tasks

- **Contact email:** keep `resuming.me@gmail.com` (see P1-11). No domain address for now.
- **Offline undo:** guarantee undo for all writes while online. Offline, guarantee it only for writes that already go through the queue (sessions). Expanding the queue to completions/metrics/skip is out of scope for Phase 1; leave a TODO.
- **P1-04 schema:** yes, use `activity_pauses` and `rest_days` tables, with RLS.
- **HTTP 404:** `noindex` on the Not Found page is enough for Phase 1. Keep Cloudflare's SPA fallback. Real 404s come with pre-rendering / the marketing site in Phase 4.
- **Commits:** one branch and one PR per task, so each gets a Cloudflare preview URL to test before merging. If the repo isn't connected to GitHub, commit locally per task instead.

### Decisions

- **Contact email:** keep `resuming.me@gmail.com` for now (decided).
- **Themes:** all six themes stay free for everyone (decided). Keep every theme available in Settings; P1-07 only changes when their fonts load, not who can use them.
- **Open:** rule for tagging old auto-created "Put off" rows — Cursor to propose after checking real data, Bhadresh to approve before it runs.
