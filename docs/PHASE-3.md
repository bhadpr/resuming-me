# Resuming — Phase 3 Implementation Spec: Insights & the Comeback Loop

Goal: make Resuming the best place to come back to after a gap, and make Insights good enough that people would pay for it.

Prerequisites: Phase 1 (`docs/PHASE-1.md`) and Phase 2 (`docs/PHASE-2.md`) are deployed, and at least 2–3 weeks of real event data exist.

## How to use this file

One task per branch, in the order below. P3-08 is parked. P3-07 waits until after a walkthrough. Build P3-01 through P3-06 and P3-09 first.

## Conflicts with the code after Phases 1–2

- Comeback counting already lives in `src/lib/comebacks.ts` (plural). Shared Phase 3 definitions go in `src/lib/comeback.ts` and the older helper stays until P3-02 replaces streak-style wording.
- The Today welcome line is still “It’s been a few days — that’s okay,” triggered at 5 quiet days by `isQuietReentry`. P3-01 replaces that card at 3 quiet days and keeps the post-session follow-up.
- The onboarding slip screen was removed. `slip_answer` can still exist on a profile and is only a weak preferred-time hint until real patterns exist (P3-05).
- Water is a glass count, so the suggestion says “2 glasses,” not “2 minutes.”
- “Start” must keep opening the timer without writing a log (P1-01).

## Shared definitions

In `src/lib/comeback.ts`:

- Showed up: `getDayStatus()` is done or partial.
- Quiet day: status is missed. Skipped, rest, and paused never count against anyone.
- Gap: 2+ consecutive quiet days. For the account, days with no showing up at all.
- Comeback: showing up after a gap of at least 2 quiet days.
- Resumability, 0–1: `0.4 × smallest target + 0.3 × recency of last success + 0.2 × historical success rate + 0.1 × preferred time`. Paused activities and deadlines past their date are excluded. Ties break toward the smaller target.
- Never state a pattern as fact with fewer than 5 observations.

## P3-01 — Welcome-back flow after a gap

Trigger: the account has a gap of at least 3 quiet days. Show once per gap, not once per day.

Card at the top of Today:

- 3–6 days: “It's been a few days. Welcome back.”
- 7–20 days: “It's been a couple of weeks. Good to see you.”
- 21+ days: “It's been a while. That's completely normal.”
- No totals, percentages, or a list of what was missed.
- One suggestion at its tiny target, chosen by resumability score.
- Start · Something else (next 3) · Just looking today (hides for 24 hours).
- Optional quote of “why this matters.”
- For a gap of at least 7 days: “Want to start fresh from today?”

Fresh start writes `fresh_starts` and hides that range from Insights. History keeps the days behind one collapsed row. Settings → Show everything reveals them. Undo deletes the row. At most one fresh start per 14 days. Totals that overlap a fresh start say “Since your fresh start on Sep 23.”

Events: `welcome_back_shown`, `welcome_back_started`, `welcome_back_dismissed`, `fresh_start_used`.

## Later tasks

P3-02 Comebacks as the hero metric. P3-03 Weekly Resume Review (Sunday 18:00 local). P3-04 Fresh-start banners. P3-05 Pattern engine. P3-06 Activity detail redesign. P3-09 Comeback loop dashboard.

P3-07 AI summary is pending. P3-08 Resume buddy is parked until after monetization. Do not build it in this phase.
