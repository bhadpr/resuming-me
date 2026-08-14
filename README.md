# Resuming.me

Personal activity tracker — track what you postpone, see the pattern across everything at once.

See [multi_activity_tracker_spec.md](./multi_activity_tracker_spec.md) for the full build spec.

## Sprint status

### Sprint 1 — Foundation
- [x] Vite + React + TypeScript app
- [x] PWA shell (manifest + service worker via `vite-plugin-pwa`)
- [x] Supabase schema migrations (profiles, activities, target history, metrics, log entries)
- [x] Row Level Security on all tables
- [x] Google sign-in UI (requires Supabase + Google OAuth setup)
- [x] Mobile-first authenticated shell
- [x] Cloudflare Pages SPA redirect config (`public/_redirects`) — deploy deferred
- [x] RLS integration test stub (`tests/rls.test.ts`)

### Sprint 3 — Metric CRUD
- [x] Metric list (active + optional archived)
- [x] Add / Edit form (name, emoji, unit)
- [x] Archive / unarchive
- [x] Permanent delete with confirmation
- [x] Metrics tab in app nav

### Sprint 4 — Today screen
- [x] Today home tab with due activities
- [x] Checkbox Done/Undo → `log_entries` (completed)
- [x] Count +1 toward daily/weekly targets
- [x] Deadline Complete + days remaining
- [x] Metric quick log / update for today
- [x] Most-overdue-feeling sort (fallback until rollover)

### Sprint 5 — Timer mechanics
- [x] Start / Pause / Resume / Stop
- [x] Multi-session daily summing toward target
- [x] Recover running timer after tab close (localStorage)
- [x] Manual minutes entry (`source: manual`)
- [x] Offline queue + sync on reconnect

### Sprint 6 — Detail screens + entry editing
- [x] Activity Detail: streak, postponement counts, avg session
- [x] Activity history list with edit/delete log entries
- [x] Metric Detail: 7/30/90-day trend chart + min/max/avg/delta

### Sprint 7 — Rollover + deadlines
- [x] Timezone-aware rollover planning (`src/lib/rollover.ts`) + unit tests
- [x] Client catch-up on app open (idempotent postponed writes)
- [x] Edge Function `supabase/functions/rollover` + cron setup SQL
- [x] Overdue deadline prompt (Today + Activity Detail): complete or reschedule

### Sprint 8 — Insights
- [x] Postponement rate per activity (week / month)
- [x] Day-of-week skip correlation + session time-of-day buckets
- [x] Week / month toggle + text summary from real log data
- [x] Insights tab wired in app nav (co-postponement deferred)

### Sprint 9 — Micro-step breakdown (partial)
- [x] “Break this down” on deadline Activity Detail
- [x] JSON parse + validation with graceful fallback (malformed/empty/wrong count)
- [x] Safe handling when API URL is not configured (v2 AI deferred)
- [ ] Wire Haiku / gpt-4o-mini Edge Function (v2)

### Sprint 10 — Onboarding + hardening
- [x] Landing explainer + pattern diagram (§16)
- [x] First-run starter templates (Reading, Gym, File taxes, Weight)
- [x] Skip / complete onboarding (persisted dismiss)
- [x] iOS Add to Home Screen tip (dismissible)
- [x] PWA manifest theme aligned to Resuming default
- [x] Unit coverage for templates + install tip gating


## Quick start (local dev)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Supabase (`resuming-me-prod`)

1. Create project at [supabase.com](https://supabase.com) named **resuming-me-prod**
2. Run migrations in **SQL Editor**:
   - `supabase/migrations/20260811180000_initial_schema.sql`
   - `supabase/migrations/20260812000000_rollover_cron.sql` (Sprint 7 — enables pg_cron/pg_net; schedule optional)
3. Copy project URL + anon key from **Settings → API**
4. Enable **Google** provider under **Authentication → Providers**
5. Add redirect URLs under **Authentication → URL Configuration**:
   - `http://localhost:5173`
   - `https://YOUR_CLOUDFLARE_PAGES_URL.pages.dev`
   - `https://resuming.me` (when ready)
   - `com.cheerfulgames.resuming://auth/callback` (Android Capacitor)

**Sprint 7 rollover (optional server schedule):** deploy `supabase/functions/rollover`, then follow the comments in `20260812000000_rollover_cron.sql`. Until cron is wired, the app still writes postponed entries on open via client catch-up.

### 3. Google OAuth

1. [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID (Web application)
3. Authorized redirect URI: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
4. Paste Client ID + Secret into Supabase Google provider settings

### 4. Environment

```bash
cp .env.example .env
# Edit .env with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
```

### 5. Run

```bash
npm run dev
```

Open http://localhost:5173 → sign in with Google → land on empty authenticated app.

## Tests

```bash
npm test
```

RLS cross-account test (optional, requires two test users with email/password auth enabled):

```bash
SUPABASE_URL=... SUPABASE_ANON_KEY=... \
SUPABASE_USER_A_EMAIL=... SUPABASE_USER_A_PASSWORD=... \
SUPABASE_USER_B_EMAIL=... SUPABASE_USER_B_PASSWORD=... \
npm test -- tests/rls.test.ts
```

## Deploy (Cloudflare Pages)

### A. Create the Pages project

1. Open [Cloudflare Dashboard → Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages) → **Create** → **Pages** → **Connect to Git**
2. Select GitHub repo **`bhadpr/resuming-me`**, branch **`main`**
3. Build settings:
   - **Framework preset:** Vite (or None)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (default)
4. **Environment variables** (Production + Preview):
   - `VITE_SUPABASE_URL` = your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = your Supabase anon/public key  
     (same values as local `.env` — never commit them)
5. Deploy. Note the URL: `https://<project>.pages.dev`

SPA routing uses `wrangler.toml` (`assets.not_found_handling = "single-page-application"`). Security headers ship via `public/_headers`.

### B. Attach custom domain (e.g. `resuming.me`)

1. In the Pages project → **Custom domains** → **Set up a custom domain** → enter `resuming.me` (and optionally `www.resuming.me`)
2. If the domain is **not** on Cloudflare yet:
   - Cloudflare → **Add a site** → enter `resuming.me`
   - Choose a plan (Free is fine)
   - At your registrar, replace nameservers with the two Cloudflare NS hosts shown
   - Wait until Cloudflare marks the zone **Active**
3. Pages will create the required DNS records (`CNAME`/`AAAA` to Pages). Keep the orange cloud **Proxied**.
4. SSL/TLS (zone) recommended settings:
   - **SSL/TLS → Overview:** Full (strict) — Pages manages certs
   - **Edge Certificates:** Always Use HTTPS = On
   - **Minimum TLS Version:** 1.2
   - **Automatic HTTPS Rewrites:** On
   - Optional: enable **HSTS** after the first successful HTTPS load (start with a short max-age)

### C. Wire auth to the production URL

In **Supabase → Authentication → URL Configuration** add:

- Site URL: `https://resuming.me` (or your Pages URL until the domain is live)
- Redirect URLs:
  - `http://localhost:5173/**`
  - `https://<project>.pages.dev/**`
  - `https://resuming.me/**`
  - `https://www.resuming.me/**` (if you use www)
  - `com.cheerfulgames.resuming://auth/callback`

Google OAuth Client stays pointed at Supabase only:  
`https://toeemvcvizpfcyknogph.supabase.co/auth/v1/callback`

### D. Smoke-check after deploy

- [ ] `https://<project>.pages.dev` loads landing
- [ ] Google sign-in returns to the app (not localhost)
- [ ] Feedback submit works (feedback migration applied)
- [ ] Custom domain serves HTTPS with no certificate warning
- [ ] Response headers include `X-Frame-Options` / `X-Content-Type-Options`

## Project structure

```
src/
  components/     # LandingPage, AppShell
  hooks/          # useAuth, profile sync
  lib/            # Supabase client
  types/          # Database types
supabase/
  migrations/     # Postgres schema + RLS
tests/
  rls.test.ts     # Cross-account isolation test
```

## Android (Capacitor)

Package name / app ID (do not change after the first Play upload): `com.cheerfulgames.resuming`

```bash
npm run build:android   # web build + copy into android/
npm run open:android    # opens Android Studio
```

In Android Studio, pick the `Pixel_8_API_36` emulator and Run. After web changes, run `npm run build:android` again (or `npx cap sync android`) before rebuilding the app.

Google sign-in on Android uses the deep link `com.cheerfulgames.resuming://auth/callback`. Add that exact URL under **Supabase → Authentication → URL Configuration → Additional Redirect URLs** before testing **Continue with Google** on the emulator.
