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

**Screen 1.** "What have you been meaning to get back to?" Sub: "Pick up to three. You can change these later." Chips: Reading, Walk, Exercise, Meditate, Pranayam, Writing, Guitar, Stretching, Water, Sleep earlier, Journaling, Taxes, Call family, Study, Tidy up, Side project, plus "Something else…" (40 chars). Continue disabled until one chip; label "Continue with 2".

**Screen 2.** "When did you last do this?" Options: "A few days", "A couple of weeks", "A month or more", "Honestly, ages", "Never started". Reassurance, then auto-advance after 1.2s: few days → "Easy to pick back up."; couple of weeks → "That's a normal gap. Restarting is the skill."; month or more → "Long gaps are normal. We'll start small."; ages / never → "Then today is day one. Two minutes is enough."

**Screen 3.** "Let's make it small enough to actually do." Stepper 1, 2, 5, 10, 15, 20, 30 min (counts 1×–5×) and "That's still too big?". Sub: "Small is the point. You can raise it any time."

**Screen 4.** "When does it usually slip?" Multi-select max 2: Mornings, Afternoons, Evenings, Weekends, Busy workdays, Not sure. Sub: "This helps Insights spot your pattern sooner."

Events: `onboarding_started`, `onboarding_step_completed {step, choices}`. Nothing written to Supabase. No overflow at 320px.

## P2-03 — Screens 5–6

**Screen 5.** "Want to start right now?" Body: "Two minutes of <activity>. That's all this takes." Primary "Start 2 minutes". Secondary "Pick a different one" and "I'll start later". Full-screen timer, wake lock, Pause and Done. Under 30s logs nothing. Otherwise a guest session with real `started_at`. "I'll start later" → screen 6 copy "No rush. It'll be waiting on Today."

**Screen 6.** "You resumed Reading." plus "That's the hard part. The rest is just repeating it." Insights preview: "In a week, this shows where your skips pile up — and what's easiest to pick back up." If skipped: "Ready when you are." No fake data.

Events: `onboarding_timer_started`, `onboarding_timer_completed {seconds}`, `onboarding_timer_skipped`.

## P2-04 — Screens 7–8

**Screen 7.** "One quiet nudge a day?" Body: "We'll only ping if something's still open. Nothing if you're done." Default time: mornings 08:00, evenings 19:00, weekends 10:00, else 19:00. "Yes, remind me" / "No thanks". No OS permission during onboarding.

**Screen 8.** "Save what you just set up." Summary like "3 activities · 1 resumed today · nudge at 19:00". Google and email (Apple deferred, keep a provider list). Footer: "Free. No ads. Your data stays yours." "Not now" stays guest on `/today` with "Save your progress" (expires 7 days, warn at day 5).

Events: `onboarding_reminder_set {time|none}`, `signin_shown`, `signin_method_clicked {method}`, `signup_completed {activities, resumed_in_onboarding}`.

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
