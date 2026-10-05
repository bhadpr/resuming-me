# Resuming — Phase 4: Language, Steps, Medicines

Goal: the version after the current Play review. Language is chosen first. Today always shows steps. Blood pressure is a reading. Medicines is its own section with a bottle photo and its own reminders. Privacy and the store listing match that.

Prerequisite: the version already in Play review ships first. That bundle is version code 3, version name 1.0. This phase does not upload a new app bundle until P4-06.

## How to use this file

One task per branch, in the order below. P4-02 is a written spec, finished before P4-03. P4-07 lands before the store screenshots. P4-05 waits until P4-03 and P4-04 are settled. P4-06 waits until the new screens exist and the privacy policy URL is already live.

## Rules

- Do not upload a new Android App Bundle until this phase is ready to ship. The bundle in review stays version code 3.
- Current Android permissions in `android/app/src/main/AndroidManifest.xml` stay `INTERNET`, `POST_NOTIFICATIONS`, and `SCHEDULE_EXACT_ALARM`.
- Steps use Health Connect, the current Android path. The old Google Fit API is not the integration. This version is Android only. Reading steps adds `android.permission.health.READ_STEPS`. Camera and gallery permissions stay off.
- Medicines are not rows in `metrics` or `metric_entries`.
- Medicine reminders stay separate from the shared daily digest in `src/lib/dailyDigest.ts` and `src/lib/localNotifications.ts`.
- A missed dose stays on Today until it is taken or the day ends. Insights stay about activities.
- The bottle photo comes from the system photo picker. No camera permission. No reading of the label. No dose advice.
- Keep the calm voice of the rest of the app. A dose reminder says the time. It does not talk about drifting or postponing.

## Recommended order

| Order | Task | Size |
|-------|------|------|
| 1 | P4-01 Language is the first screen | S |
| 2 | P4-02 Vitals workflow | S |
| 3 | P4-03 Steps from Health Connect | M |
| 4 | P4-04 Medicines | L |
| 5 | P4-07 Marathi and Tamil | M |
| 6 | P4-05 Privacy | S |
| 7 | P4-06 Play listing | S |

## P4-01 — Language is the first screen

Someone who just installed the app chooses a language before anything else. Locales already live in `src/lib/i18n.ts` (`en`, `hi`, `te`, `gu`). `src/hooks/useLocale.tsx` loads and saves the choice. `src/components/LanguagePicker.tsx` is the control Settings already uses.

- The first screen offers English, Hindi, Telugu, and Gujarati. Each name is written in its own script.
- The only prompt is one English line: “Choose your preferred Language.” The type is large, and so are the buttons.
- The choice is saved on the device. Later opens go straight into the app.
- Settings can still change the language.
- P4-07 adds Marathi and Tamil to this same screen.

## P4-02 — Vitals follow a fitness-app workflow

Steps and blood pressure stay different jobs. This is the behavior for P4-03 and for the blood pressure change in this version. Do not build the steps card or change blood pressure until this section is the spec. It is.

Apple Health, Samsung Health, and Google Fit all put steps on the home screen every day, as a count toward a daily goal. Blood pressure is a reading you save when you measure it: upper, lower, and the time, then the latest number and a simple history. None of them treat a missing blood pressure log as a failed day. Copy that split. Leave out their rings, heart points, coaching, risk labels, and device-measurement flows.

### Steps

Today gets one permanent steps card. The person does not add a Steps vital to see it. P4-03 fills the number from Health Connect and allows a typed count when that is unavailable. This section decides what the card means.

- The card sits at the top of Today, above activities and other vitals.
- It shows today’s count and the daily goal, as `4,280 / 10,000`.
- The goal starts at 10,000. That is already the usual-day line in the app. The person can change it. There is one goal, not a second vital.
- If a Daily Steps vital was added earlier, Today still shows this one card. It does not also show a Steps row in the vitals list.
- A day under the goal is not missed, postponed, or an Insight. The card is a count, not a habit to resume.
- No ring, no weekly challenge, no “you should walk now.”

### Blood pressure

Blood pressure stays a vital the person adds. The starter and `isBloodPressure` in `src/lib/metrics.ts` stay the way a reading is recognized. Today already asks for upper and lower in `src/components/TodayScreen.tsx`. `metric_entries` stores one row per metric per day and has no time. That is the part that changes.

- A log is upper, lower, and the time. The time defaults to now. The pair is shown as `120/80`.
- More than one reading can be kept on the same day. Logging again adds a reading. It does not replace the earlier one.
- Today shows the latest reading, with its time. An empty day shows the two fields and does not look finished or missed.
- The vital detail keeps the short trend already on `src/components/MetricDetail.tsx`. The chart uses the latest reading of each day. The screen also shows that latest pair and its time.
- No normal, elevated, or high label. No target range. No reminder to measure. A quiet day is not a postponement and does not enter Insights.

Weight, water, sleep, and the other number vitals stay as they are: one value for the day.

## P4-03 — Steps come from Health Connect

Today shows steps from the phone.

- The app reads today’s steps through Health Connect.
- The steps card is on Today even when the Daily Steps vital was never added.
- The card shows the count against the daily goal.
- If Health Connect is missing or permission is denied, the same card accepts a typed number.
- iPhone apps stay a workflow reference from P4-02. This version does not ship an iPhone steps build.

## P4-04 — Medicines is its own section

A person can keep a bottle and be reminded on the days they take it. Medicines sit beside Vitals, in their own section. They do not use the vital form in `src/components/MetricForm.tsx`.

- Each medicine has a name, one bottle photo from the system photo picker, the days of the week, and one or more times.
- A medicine can be three days a week at one time, or every day at two times.
- Alarms use their own notification channel, separate from the shared daily nudge. Refreshing the digest does not wipe dose alarms.
- Today shows each dose that is due, with the photo. Marking it taken silences that alarm.
- A missed dose stays on Today until it is taken or the day ends. It does not become a postponement, a streak, or an Insight.
- The photo is stored for a signed-in account. Guest setup does not keep photos.
- The form says this is a reminder.

## P4-05 — Privacy matches the new data

Update the privacy policy in `src/components/LegalPage.tsx`, and the Play Data safety form, only after P4-03 and P4-04 are settled. Describe only what this version stores.

- Medicine name, days, times, and the bottle photo.
- Step counts read from Health Connect.
- A line that the photo and the reminders are not medical advice.
- The privacy policy URL is updated before the new bundle is uploaded.

## P4-06 — The Play listing matches the new app

Rewrite the store text and replace the images after the new screens exist. The icon and feature graphic live in `play-listing/`.

- The description mentions reminders and steps, and stays clear of treatment claims.
- The feature graphic and icon are reviewed against that description.
- Screenshots show Today with steps, a medicine with its bottle, and a blood pressure reading.
- The upload uses a new version code, after the privacy policy URL is already live.

## P4-07 — Marathi and Tamil

Add two languages to the same screen as P4-01, before the Play listing screenshots. Locales today are `en`, `hi`, `te`, and `gu` in `src/lib/i18n.ts`, with catalogs in `src/lib/messages/`. The profile check allows those four (`supabase/migrations/20260926200000_locale_te_gu.sql`).

- Marathi (`mr`) and Tamil (`ta`). The buttons read मराठी and தமிழ்.
- The first-screen prompt stays the one English line. Settings can still change the language.
- New catalogs cover the same keys as English. A missing key falls back to English, and the new catalogs should not rely on that for the main screens.
- The profile locale check accepts `mr` and `ta`, including the guest-merge path that writes `locale`.
- The choice still saves on the device and follows the account, the same way Hindi, Telugu, and Gujarati do.
