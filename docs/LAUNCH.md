# Resuming — Launch

This is the go-live runbook for the first public Android release. The plan, budget, and channel rules stay in [marketing.md](../marketing.md), which replaced `PHASE-15.md`. Unscheduled ideas are in [newIdeas.md](../newIdeas.md). Tick the boxes here.

**As of 14 Oct 2026.** The closed test was on day 12 on 12 Oct, so day 14 is today. Production access can be applied for today. Google’s review can take a few days after that. Ads wait until the Play page is public.

**Build:** `1.0.4`, version code `7` (`android/app/build.gradle`). Package `com.cheerfulgames.resuming`. Release notes and the Play Console order are in `play-listing/release-1.0.4.md`.

## What this launch is

The Android app goes from the closed test to a public Google Play listing. The web app at resuming.me and the site at resuming.app are already up. An install earns nothing. Success is people who come back: day-1 return 30%, day-7 return 12%, a Play rating of 4.5 or better with at least 25 reviews in the first month.

## What can be shown

Habits (including Pranayam and Heartfulness follow-along, and a YouTube link on any habit), vitals (BP, weight, sleep, water), steps from Health Connect, reminders with a description and a photo, sharing an event on WhatsApp, and seven languages. The message is “Missed a day? Just resume.”

## Leave out

Medicines (web only), widgets, circles, and the community-reminders work still in progress. No health claims. No APK. No TikTok. No Google or Meta code inside the app. The 75-second explainer and the vertical short are not made yet, so launch posts use the hero loops and the B1–B9 recordings.

## Before you apply for production

Do these in order. The website goes out before the Play release, so a shared link works on the day the listing opens.

- [ ] Push the commits that are meant for this release. Leave the unfinished community-reminders work out of it.
- [ ] Apply the migrations that are written and not yet on production:
  - `supabase/migrations/20261019120000_data_retention.sql` (13-month cleanup, `erase_user_usage`)
  - `supabase/migrations/20261020120000_analytics_summaries.sql`
  - `supabase/migrations/20261021120000_marketing_pay_checks.sql`
- [ ] Deploy the `delete-account` function so it calls `erase_user_usage`.
- [ ] Deploy resuming.me (`npm run build`, then Wrangler) so the privacy page matches the database. Last updated in the repo: 13 Oct 2026.
- [ ] Open https://resuming.me/privacy and confirm the live page says: usage events are collected, they are deleted after 13 months and on account deletion, referral records keep a hashed device ID, and backups last up to 7 days.
- [ ] Confirm the collection section also names that Android reads Google’s Play install referrer. Retention already names the hashed device ID. Add the referrer line if it is missing, then redeploy.
- [ ] `npm test` passes.
- [ ] `npm run build:android`, then build the signed release bundle in Android Studio. The file is `android/app/build/outputs/bundle/release/app-release.aab`.
- [ ] Install that build on a phone that is not your daily one. Check: Google sign-in, Today in Hindi, a reminder with a photo, a shared WhatsApp link that opens the event page, Health Connect steps if the phone has them, and offline then back online.

## Play Console

Follow `play-listing/release-1.0.4.md`, then the extra Data safety lines below. English is enough to go live. The other six languages can follow in the first week.

- [ ] **Main store listing.** Name `Resuming: Habits & Reminders`. Short description `Track your day, gently. Missed a day? Just resume.` Full description from `play-listing/listing-en.md`. Feature graphic `play-listing/feature-graphic.png`. Remove the old screenshots and upload the six in `play-listing/screenshots/` in file order.
- [ ] Read the listing once more. Every line is a feature that ships. No medicines, no “coming soon”, no health claims.
- [ ] **Data safety**, on top of the three changes already written in `release-1.0.4.md` (reminder photos, shared-event text, anonymous device id for shared events):
  - Device or other IDs: a hash of the Android ID, stored with a referral group so installs and five-day returns can be counted. Not shared. Not required. Purpose: analytics (and app functionality if that type is already declared).
  - App activity: in-app usage events (event name, anonymous device id, page, app version, platform). Not shared. Purpose: analytics.
  - The form matches https://resuming.me/privacy.
- [ ] **Production → Create new release.** Upload the AAB, paste the release notes from `play-listing/release-1.0.4.md`, and roll out.
- [ ] Apply for production access. Do this on day 14, which is today if the test has not already been extended.

## Launch day

Start this list only when the Play page loads for a signed-out browser, not when the release is “in review”.

- [ ] On a phone that has never had the app, install from the public link. Sign in, open a shared WhatsApp link, and switch the app to Hindi.
- [ ] Confirm https://resuming.app Play buttons open that same public page. `PLAY_LIVE` is already `true` in `marketing/src/site.ts`, so the buttons may already be on and may have been pointing at a missing page. Redeploy the site (`cd marketing && npm run deploy`) only if the live site still says “Coming soon” or the links are wrong.
- [ ] Send each referral-group member their own link from `/admin/groups`. Tell them payment waits until the checks in the last checklist below.
- [ ] Post one short clip (hero loop or a B-roll cut), with a tagged Play link, in the WhatsApp and Facebook groups you already belong to. Read each group’s rules first.
- [ ] Publish Medium article 1 (“Missed a day? Why restarting is the real skill”) if it is written. If it is not, post the founder note on LinkedIn with the Play link and write the article the same week. Do not hold the listing for the article.
- [ ] In Play Console, open Android vitals. Reply to every review and every public comment the same day.

## First two days

- [ ] Day 2: start the Google app campaign and the Instagram/Facebook install ads at about $10 a day each, India, Hindi and English, installs only. Wording stays on habits, reminders, and family dates.
- [ ] Each ad uses its own `utm_source` on the Play link. Referral-group links stay the ones from `/admin/groups` and do not get a second campaign tag.
- [ ] Check crashes again. A crash on the first open or on sign-in stops the ads until a fix is in review.

## Days 3 to 7

- [ ] Product Hunt, three to five days after the page is public, once there is at least one review to point to.
- [ ] Peerlist, r/developersIndia, and Indie Hackers: the build story, after reading each community’s rules.
- [ ] Dev.to and Hashnode: the same build story, with the canonical link set to the Medium (or later the blog) copy.
- [ ] Quora: two short answers, English and Hindi, on restarting a habit after a missed day. Link the article where the site allows it.
- [ ] Hindi listing: title, short description, full description, and release notes. English screenshots can stay until Hindi ones exist.
- [ ] Spend about $50 on Google and about $50 on Instagram/Facebook, then stop and read the gates before any more money goes in.

## Week 2 gates

Stop a paid channel if cost per install goes above about $0.50, or if day-1 return is below about 20%. Move that money to the better channel. Take day-1 and day-7 return from the admin Analytics screen, and installs per source from Play Console.

| Channel | Spend | Installs | Cost per install | Day-1 return | Keep or stop |
|---------|-------|----------|------------------|--------------|--------------|
| Google app campaign | | | | | |
| Instagram and Facebook | | | | | |
| Referral groups | | | | | |
| Free posts | | | | | |

- [ ] The table above is filled for week 1.
- [ ] Every Play review has a reply.
- [ ] One change is written down for week 2 (onboarding, the first reminder, or which channel gets the reserve).

## Before anyone is paid

Do not pay from the “Earned” number. The referral tables can be filled by a script until Play Integrity exists. Pay only the “Safe to pay now” figure on `/admin/groups`, and only after all of these:

- [ ] The pay-check migration is on production, and “Before you pay” is visible on the group page.
- [ ] Each group is set to ₹20 per five-day return, no pay for a bare install, a ₹20,000 cap, and a minimum of 500 five-day people.
- [ ] Play Console’s install count for that group’s source tag has been typed in. If our count is at least 20% higher, and at least 10 higher, do not pay until you know why.
- [ ] Only installs whose 30 days ended at least 7 days ago are in the payable figure.
- [ ] Any spike flag (a day with at least 25 installs and at least five times that member’s usual day, or at least 70% of 20 or more closed installs opening on five days) has a note about what the member posted.
- [ ] The privacy page and the Data safety form both describe the hashed device ID, the install referrer, and usage events.
- [ ] Play Integrity (a server check that the install is the real app) is still not built. Until it is, do not raise the cap or add groups beyond the first ones.

## Not in this launch

- Listing copy in Gujarati, Marathi, Telugu, Tamil, and Bengali. Hindi first, then those, after English is live.
- The in-app Play review prompt. It is not in the app. Ask for reviews by hand in the first week, and add the prompt after the third day someone logs something (task P15-12 in `marketing.md`).
- Indus Appstore and any other store.
- Influencer Reels. Book them only after a paid channel clears the week-2 gates.
- Community reminders. They are not in the build this listing describes.
