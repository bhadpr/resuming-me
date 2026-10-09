# Resuming — Phase 10: iPhone app

Goal: Resuming on the App Store, built from the same code with Capacitor. Someone on an iPhone gets what an Android user gets: Today, reminders that ring on time, steps from the phone, and a sign-in that keeps their data across phone and website.

The app is already a Capacitor app. Android lives in `android/`. This phase adds `ios/` next to it and fills in the places where the app only knows Android: sign-in, alerts, steps, back navigation, and store wording.

Prerequisite: Phase 7 Milestones 1 and 2 (reminders and phone alerts). Phases 8 and 9 are not needed. Their iPhone parts are in Milestone 6, which waits for them.

## How to use this file

Milestone 0, then six milestones, in order. Milestone 0 is accounts, tools, and one decision, with no app code. Start it first, because Apple's enrollment can take days. Each later milestone is usable on its own. Inside a milestone, one task per step. Milestone 6 is optional and comes after Phase 8 Milestone 2.

## Rules

- One codebase. iPhone-only code sits behind `Capacitor.getPlatform() === 'ios'`, the same way Android-only code does today.
- The Android app behaves exactly as it does now. Every task ends with a quick check on Android.
- Guest mode works on iPhone. Nobody needs an account to try the app.
- Medicines stay off in the iPhone app, the same as on Android. The website keeps them.
- Every alert that rings on Android rings on iPhone, inside iPhone's limit of 64 waiting alerts per app.
- Steps are read only. Resuming never writes to Apple Health, and Health data is never used for anything but the person's own Today and Insights.
- The iPhone app never mentions Android or Google Play. Apple rejects apps that do.
- iPhone only. No iPad layout in this phase (P10-03).
- Bottom nav stays four tabs.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M0 Before the code | P10-01 Apple Developer Program | S |
| | P10-02 A Mac with current Xcode | S |
| | P10-03 iPhone only, first release | S |
| M1 Runs on iPhone | P10-04 Add the iPhone project | S |
| | P10-05 Notch, keyboard, and back | M |
| | P10-06 Icon, launch screen, and name | S |
| M2 Sign in | P10-07 Google and email on iPhone | S |
| | P10-08 Sign in with Apple | M |
| M3 Alerts | P10-09 Share the 64 alerts | M |
| | P10-10 Alerts and their buttons | S |
| | P10-11 Words that say "Android" | S |
| M4 Steps | P10-12 Steps from Apple Health | M |
| M5 App Store | P10-13 Privacy forms | S |
| | P10-14 TestFlight | S |
| | P10-15 Listing and review | M |
| | P10-16 Website points iPhones to the App Store | S |
| M6 Links (optional) | P10-17 Event links open the app | M |
| | P10-18 iPhone installs in the counts | S |

## Milestone 0 — Before the code

At the end of M0, Xcode on the Mac can build and run a signed app on a real iPhone under the publisher's Apple team, and the App Store name is reserved.

### P10-01 — Apple Developer Program

- Join the Apple Developer Program as the publisher. It costs US$99 a year.
- Join as the organization Cheerful Games, a registered US company. The App Store then shows Cheerful Games as the seller, not a person's name, and medicines on iPhone stay possible later.
- Organization enrollment needs a D-U-N-S number. Look it up with Apple's D-U-N-S tool, since the company may already have one. If not, request it there for free. It usually takes about 5 business days and can take two weeks. Start this first.
- The legal name and address on the enrollment must match the state registration exactly, including "LLC" or "Inc." Have a company website ready, and someone who can sign for the company and answer Apple's confirmation call.
- Register the app id `com.cheerfulgames.resuming` with Sign in with Apple and HealthKit turned on. Add Associated Domains later, for Milestone 6.
- Make the app record in App Store Connect now, to reserve the name Resuming. If the name is taken, choose the App Store name before any screenshots or listing text are made.
- Make the Sign in with Apple key and Services ID now. P10-08 needs them for Supabase.

### P10-02 — A Mac with current Xcode

- A Mac on a macOS version that runs the current Xcode. Apple raises the lowest Xcode it accepts for uploads every spring, so an older Mac can block P10-14.
- Xcode from the Mac App Store, its command line tools, and CocoaPods (Capacitor's default for the iPhone project).
- Sign in to Xcode with the publisher's Apple account. Use automatic signing with the publisher's team.
- A real iPhone on a recent iOS, with Developer Mode on. The simulator is not enough for alerts while the app is closed, alert buttons, or Apple Health.
- Done when Xcode runs a blank app on that iPhone, signed by the team.

### P10-03 — iPhone only, first release

- The first release is for iPhone only. No iPad layout, no iPad screenshots.
- Apple still lets iPads install iPhone-only apps, and review sometimes tests on an iPad. The app must open and work there in its iPhone-sized window, even if it is not pretty.
- In App Store Connect, turn off "available on Mac" so Macs with Apple chips do not list it.
- A real iPad layout is a later phase.

## Milestone 1 — Runs on iPhone

At the end of M1, the guest flow runs from the language screen to Today on a real iPhone, with no Android-only errors.

### P10-04 — Add the iPhone project

- Add `@capacitor/ios` at the same major version as `@capacitor/android`, then `npx cap add ios`. Commit `ios/` the same way `android/` is committed.
- Same app id, `com.cheerfulgames.resuming`, and the same name, Resuming.
- Lowest iOS version: Capacitor 7's default. iPhone only, as decided in P10-03.
- Scripts `build:ios` and `open:ios`, matching `build:android` and `open:android`.
- `ITSAppUsesNonExemptEncryption` set to NO, since the app only uses HTTPS. TestFlight then skips the export question on every build.
- The Install Referrer and Health Connect plugins are Android only. Their calls are already skipped off Android. Check the Xcode console shows no "plugin not implemented" errors on first open.

### P10-05 — Notch, keyboard, and back

- On iPhone the web view always sits under the status bar. The existing safe-area padding handles it. Check the top of every screen and the bottom nav on a phone with a notch, one with a Dynamic Island, and an iPhone SE.
- Status bar text is dark on the cream background. No white edge shows when a screen bounces at the top or bottom.
- Add `@capacitor/keyboard`. The field being typed in (activity name, email, vitals numbers) stays above the keyboard. The bottom nav does not ride up with the keyboard.
- iPhone has no back button. Every screen that Android leaves with the hardware back (see `useAndroidBackButton`) has a visible Back or Close.
- Swipe from the left edge goes back where the app has history, the same as Android back. If it fights with the router, leave it off. The visible buttons are enough.
- No pinch zoom. Long-pressing a button does not select its text.

### P10-06 — Icon, launch screen, and name

- App icon at 1024 × 1024 from the same artwork as Android, with no transparency. The App Store rejects icons with transparency.
- Launch screen: the cream `#fff4e8` and the logo, the same as the Android splash. It hides when Today is ready, as it does now.
- Under the icon on the home screen: Resuming.

## Milestone 2 — Sign in

At the end of M2, someone can make an account on iPhone and open the same data on the website or on Android.

### P10-07 — Google and email on iPhone

- Google works as it does on Android: an in-app browser, then back to the app through `com.cheerfulgames.resuming://auth/callback`.
- Register that address in the iPhone project. Check it is in the Supabase redirect list.
- The in-app browser closes after sign-in. Cancelling returns to the same screen with no error.
- The email link opens Safari, then hands back to the app. Check it lands signed in, not on the website.
- The guest draft carries over after sign-in, as on Android.

### P10-08 — Sign in with Apple

Apple requires it when an app offers Google sign-in. Phase 2 kept a provider list for this.

- On iPhone, the native Apple sheet, then Supabase sign-in with the Apple token. Turn on the Apple provider in Supabase.
- On iPhone the sign-in buttons are Apple, Google, then email. Apple's button follows Apple's style and is the same size as the others.
- Apple sign-in also works on the website and the Android app, through the browser the same way as Google. An account made on an iPhone must open anywhere.
- If someone hides their email with Apple, their account has Apple's relay address. That is a separate account from their Google one. Nothing in the app needs to explain this.
- Deleting an account that used Apple also tells Apple to forget the sign-in. Apple requires this. Add it to the `delete-account` function.

## Milestone 3 — Alerts

At the end of M3, daily nudges and reminders ring on iPhone at the right time, including when the app is closed, and their buttons work.

### P10-09 — Share the 64 alerts

iPhone keeps at most 64 waiting alerts per app and quietly drops the rest. Today the app plans up to 64 reminder alerts plus up to 16 daily nudges (5 times a day for 3 days, plus the come-back nudge).

- On iPhone, one planner puts all alerts in time order and keeps the soonest 64.
- The next daily nudge and the come-back nudge always keep a place, so many reminders cannot crowd them out.
- Keep a few places free for snoozes ("Later") and the Settings test alert.
- The app already replans every time it opens or comes back to the front. With the soonest 64 kept, someone who opens the app every few days misses nothing.
- Android keeps its current limits.
- Tests: 100 reminders keep the soonest ones and still keep tomorrow's nudge. Nothing is planned twice.

### P10-10 — Alerts and their buttons

- Permission is asked at the same moments as Android: the reminder step of the welcome flow, and Settings.
- If someone says no, show the same "turn them on" line, with a button that opens Resuming's page in iPhone Settings.
- Android-only parts are hidden on iPhone: the exact alarms setting and the alert category names.
- Done, Tomorrow, and Later on a reminder alert work on iPhone (long-press the alert), including when the app was closed.
- Tapping an alert opens Today.
- An alert that comes while Resuming is open still shows as a banner.

### P10-11 — Words that say "Android"

- Strings such as "Get the Android app", "Alerts come on the Android app.", and "The switch for this is in the Android app." become "the app" or "the phone app", in every language.
- The website can still name Android and iPhone where it links to each store.
- Search the iPhone build for Android, Google Play, and Play Store before each upload.

## Milestone 4 — Steps

At the end of M4, the Steps activity shows today's count and the week from Apple Health.

### P10-12 — Steps from Apple Health

- Read Steps only, from Apple Health. The same states as Android: a count, needs permission, unavailable.
- Apple never tells an app that someone refused to share steps. A refusal looks like zero steps. On iPhone, a zero day shows one quiet line: "No steps? Allow Resuming in the Health app."
- Pick the smallest change: one plugin that covers both Apple Health and Health Connect, or an iPhone-only plugin behind the same `healthSteps` functions. Android must keep its current permission and behaviour.
- Turn on the HealthKit capability. The permission text ("Resuming reads your steps to show them on Today.") is in each of the app's languages.
- Steps are handled the same way as on Android. They are never used for ads or shared.

## Milestone 5 — App Store

At the end of M5, Resuming is live on the App Store and the website sends iPhone visitors to it.

### P10-13 — Privacy forms

- App Privacy answers in App Store Connect: email and account id for sign-in, app use for analytics, Health only as the app actually uses it. Nothing is used for tracking, so no tracking prompt.
- Privacy manifest: Capacitor and its plugins ship their own. Check Xcode's privacy report is clean and add one for the app only if it asks.
- Privacy policy and Terms mention the iPhone app, Sign in with Apple, and Apple Health.
- Category Health & Fitness. Age rating from Apple's questions.
- Account deletion in Settings works for Google, email, and Apple accounts.

### P10-14 — TestFlight

- Archive in Xcode and upload. Internal testers first, then a small outside group, which needs Apple's beta review.
- Version matches the Android version name. The build number goes up on every upload.
- Checklist on a real iPhone: language screen, guest welcome flow, sign in with Apple, Google, and email, a reminder alert with the app closed, Done from the alert, steps, delete account, and opening with no network.

### P10-15 — Listing and review

- Name, subtitle, description, and keywords from `play-listing/listing-en.md`, with no mention of Android.
- Support and privacy addresses on resuming.me.
- Screenshots for the largest iPhone size Apple asks for, in the same layout as the Play screenshots.
- Review notes: the app works without an account; steps need Health permission; medicines are on the website only.
- Before sending, check the usual reasons for rejection: Sign in with Apple, account deletion, no mention of other stores, no crash on first open, and enough that the app does on the phone (alerts and steps) that it is not "just a website".

### P10-16 — Website points iPhones to the App Store

- On iPhone Safari, "Get the app" goes to the App Store instead of the Add to Home Screen tip.
- Apple's small App Store banner on the home page.
- Android and desktop stay as they are.
- Admin analytics shows iPhone next to Android and web.

## Milestone 6 — Links (optional)

Starts after Phase 8 Milestone 2, when event links open the Android app.

### P10-17 — Event links open the app

- Universal Links for `resuming.me/e/*`. The website serves Apple's association file, and the app has the matching Associated Domains setting.
- With the app installed, the link opens the confirm screen from P8-06.
- Without the app, the event page shows an App Store button on iPhone.
- iPhone has no install referrer. After installing, the person taps the link again. The event page says: "Already have Resuming? Tap the link again."

### P10-18 — iPhone installs in the counts

- iPhone opens count in the Phase 6 five-day numbers as installs with no group.
- iPhone always uses the Default welcome flow from Phase 9.

## Out of this phase

- iPad layout, Apple Watch, widgets, Siri, and the Mac.
- Medicines in the iPhone app.
- Alerts sent from the server.
- Writing to Apple Health, or reading anything other than steps.
- Group tracks or event codes carried through an App Store install.
- Payments or in-app purchases.
