# Resuming — Phase 2 Implementation Spec: Onboarding & First Week

Goal: a first-time visitor completes their first resume within 60 seconds, before creating an account, and has a reason to come back on day 2, 3 and 7.

Prerequisite: Phase 1 is merged and deployed (`docs/PHASE-1.md`). Phase 2 depends on P1-03 (`getDayStatus`), P1-05 (routes), P1-02 (undo) and P1-12 (`track()` events).

## How to use this file with Cursor

Save as `docs/PHASE-2.md` in the repo. One task per branch/PR, tested on a Cloudflare preview, in the order below.

## Context after Phase 1

React + Vite + React Router, Supabase (Google auth, RLS), Capacitor Android, PWA with offline queue. `getDayStatus()` is the single source of truth. Routes exist for every screen; `track(name, props)` writes to the `events` table. Landing is pre-rendered. All themes are free. Contact email stays `resuming.me@gmail.com`.

## The flow

Landing → 1 pick → 2 gap → 3 tiny → 4 when it slips → 5 two-minute timer → 6 celebration + Insights preview → 7 daily nudge → 8 save / sign in → `/today`.

Rules: guest first (local until step 8); one question per screen; back arrow; Skip on steps 2, 4 and 7; 8 progress dots; chips before typing; warm short copy; route `/start?step=1..8`.

## Recommended order

| Order | Task | Size |
|-------|------|------|
| 1 | P2-01 Guest mode: local draft + merge on sign-up | L |
| 2 | P2-02 Onboarding screens 1–4 | L |
| 3 | P2-03 Screens 5–6: first resume + celebration | M |
| 4 | P2-04 Screens 7–8: reminder + sign-in choices | M |
| 5 | P2-05 Email sign-in (Apple deferred) | M |
| 6 | P2-06 Add activity templates + tiny version | M |
| 7 | P2-07 Day 2 / 3 / 7 check-ins | M |
| 8 | P2-08 Insights copy rewrite | S |
| 9 | P2-09 Onboarding funnel analytics | S |

## P2-01 — Guest mode

- Draft in `localStorage` key `resuming-guest-draft`: `{ guestId, createdAt, timezone, activities, gapAnswer, slipAnswer, reminderTime, logs }`.
- No Supabase until step 8.
- `mergeGuestDraft()` in one RPC: activities (tiny targets), session logs with original timestamps, timezone + reminder + slipAnswer on `profiles`, set `onboarding_completed_at`, clear draft.
- Failed merge keeps the draft and shows "We couldn't save that just yet — tap to retry."
- Signed-in `/start` redirects to `/today` unless `?force=1`.
- Return within 7 days restores last `?step=`.
- Cap 3 activities. Names capped at 40 characters.

## P2-02 — Screens 1–4

Chips (up to 3): Reading, Walk, Exercise, Meditate, Pranayam, Writing, Guitar, Stretching, Water, Sleep earlier, Journaling, Taxes, Call family, Study, Tidy up, Side project, plus "Something else…" (40 chars). Gap chips with reassurance lines. Tiny target stepper. Slip multi-select max 2. Events: `onboarding_started`, `onboarding_step_completed`.

## P2-03 — Screens 5–6

Start 2 minutes full-screen timer, wake lock, Pause/Done. Under 30s logs nothing. Otherwise guest session log with real `started_at`. Celebration or "Ready when you are." Insights preview card. Events: `onboarding_timer_started`, `onboarding_timer_completed`, `onboarding_timer_skipped`.

## P2-04 — Screens 7–8

Nudge time from slipAnswer. No OS permission during onboarding. Google + email buttons (Apple deferred). "Not now" stays guest on `/today` with "Save your progress" (expires 7 days, warn at day 5).

## P2-05 — Email magic link

`signInWithOtp` beside Google. Same user if email already linked to Google. Deep link on Android. Update Privacy/Terms.

## P2-06 — Templates

Single catalog `src/data/activityTemplates.ts` shared with onboarding. Suggested tiny version. Optional "Why this matters" (80) and "Usually when?".

## P2-07 — Check-ins

Day 2 / 3 / 7 via web push, Capacitor, or Resend email behind `sendEmail()`. pg_cron Edge Function. Max one a day, quiet hours 22:00–07:00, stop after 3 unopened. Opt-out in email and Settings.

## P2-08 — Insights copy

Never lead with "0 of" or a failure percentage. Suggest the most resumable activity. Use slipAnswer until ≥ 5 logged days.

## P2-09 — Funnel

Admin cards: onboarding funnel and first-week logging (day 2, 3, 7) plus median time to first resume.

## Template catalog (P2-06, shared with onboarding)

| Template | Emoji | Type | Tracking | Default | Tiny |
|----------|-------|------|----------|---------|------|
| Reading | 📖 | daily | timer | 10 min | 2 min |
| Walk | 🚶 | daily | timer | 20 min | 5 min |
| Exercise | 🏋️ | weekly 3× | checkbox | 3 / week | 1 / week |
| Meditate | 🧘 | daily | timer | 5 min | 2 min |
| Pranayam | 🌬️ | daily | timer | 10 min | 3 min |
| Writing | ✍️ | daily | timer | 15 min | 5 min |
| Guitar | 🎸 | daily | timer | 15 min | 5 min |
| Stretching | 🤸 | daily | timer | 5 min | 2 min |
| Water | 💧 | daily | count | 6× | 2× |
| Journaling | 📝 | daily | timer | 5 min | 2 min |
| Study | 🧠 | daily | timer | 25 min | 5 min |
| Tidy up | 🧹 | daily | timer | 10 min | 2 min |
| Call family | 🗣️ | weekly 1× | checkbox | 1 / week | 1 / week |
| Side project | 🎯 | weekly 2× | timer | 30 min | 10 min |
| Taxes / admin | 🧾 | deadline | checkbox | due date | 10 min block |

## Decisions

- Guest mode confirmed.
- Apple sign-in deferred.
- Pranayam chip included.
- Email provider defaults to Resend; sending domain required (not Gmail).
