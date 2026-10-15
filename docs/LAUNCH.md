# Resuming — Launch

This is the go-live runbook for the first public Android release. The plan, budget, channel rules, and what to post are in [marketing.md](../marketing.md), which replaced `PHASE-15.md`. Unscheduled ideas are in [newIdeas.md](../newIdeas.md). Tick the boxes here.

**As of 15 Oct 2026.** The closed test reached day 14 on 14 Oct, so production access can be applied for now. Google reviews the answers, and that can take a few days. The public date is not in your hands, so do not announce one. The commits are pushed (`main` matches `origin/main`).

**15 Oct, 3 pm.** Production access is submitted and waiting for Google. resuming.app was redeployed with the latest code, with `PLAY_LIVE` still `true`, so its Play buttons and QR code open a Play page that is not public until Google approves. Do not share resuming.app yet.

**Build:** `1.0.5`, version code `8` (`android/app/build.gradle`). Package `com.cheerfulgames.resuming`. 1.0.5 replaces 1.0.4 because it signs in through `https://api.resuming.me`, so Google’s sign-in screen says resuming.me. Phones still on 1.0.4 keep the old address until they update. Release notes and the Play Console order are in `play-listing/release-1.0.5.md`. The Data safety wording is in `play-listing/release-1.0.4.md`.

## The order Google makes you follow

1. **Apply for production.** Google reviews the answers. You cannot create a production release before it says yes.
2. **While you wait,** put 1.0.5 on closed testing so the testers get the new sign-in address.
3. **After approval,** create the production release with the same bundle.
4. **Launch day** is the day the Play page loads for a signed-out browser. Not the day you submit, and not while the release is “in review”.

Everything under “While Google reviews” can be done during step 2, and the posts in `marketing.md` can be prepared then too.

## What this launch is

The Android app goes from the closed test to a public Google Play listing. The web app at resuming.me and the site at resuming.app are already up. An install earns nothing. Success is people who come back: day-1 return 30%, day-7 return 12%, a Play rating of 4.5 or better with at least 25 reviews in the first month.

## What can be shown

Habits (including Pranayam and Heartfulness follow-along, and a YouTube link on any habit), vitals (BP, weight, sleep, water), steps from Health Connect, reminders with a description and a photo, the community calendar (pick Diwali or Christmas from Reminders), sharing an event on WhatsApp, and seven languages. The message is “Missed a day? Just resume.”

## Leave out

Medicines (web only), widgets, circles, and the admin screens (the community days and referral groups). No health claims. No APK. No TikTok. No Google or Meta code inside the app. The 75-second explainer and the vertical short are not made yet, so launch posts use the hero loops and the B1–B9 recordings.

## Today

- [ ] The bundle at `android/app/build/outputs/bundle/release/app-release.aab` is version `1.0.5` (code `8`). If you are not sure, run `npm run build:android` and build the signed bundle again in Android Studio.
- [x] **Production → Apply for production.** Answer the closed-test questions. The three checks were already green in `release-1.0.5.md`.
- [x] **Closed testing → Create new release.** Done 15 Oct. 1.0.5 is in review by Google.
- [x] **Phone screenshots** are uploaded (15 Oct). The files were moved out of `play-listing/screenshots/`, so that folder is empty.
- [x] **Main store listing, languages line.** বাংলা added on 15 Oct.
- [ ] **Main store listing, sign-in line.** Confirm the full description from `play-listing/listing-en.md` has “Try it without an account. Sign in with Google to keep your data safe.”

## While Google reviews

Do these in order. The website goes out before the production release, so a shared link works on the day the listing opens.

- [ ] Push anything new that is meant for this release. Everything up to 1.0.5 is already pushed.
- [x] Apply the migrations that are written and not yet on production. Checked on 15 Oct: all three were already applied, the functions exist, and the daily cleanup job (`resuming-data-retention`, 03:30 UTC) is active.
  - `supabase/migrations/20261019120000_data_retention.sql` (13-month cleanup, `erase_user_usage`)
  - `supabase/migrations/20261020120000_analytics_summaries.sql`
  - `supabase/migrations/20261021120000_marketing_pay_checks.sql`
- [x] Deploy the `delete-account` function so it calls `erase_user_usage`. Redeployed on 15 Oct (version 3). The old version predated that change. An unauthenticated call returns 401.
- [x] **Two more migrations** (`20261026120000_community_festival_names.sql`, `20261026130000_thanksgiving.sql`), applied on 15 Oct with `supabase db push`. The community calendar now has six days, with names in all seven languages: Vijayadashmi (20 Oct), Halloween (31 Oct), Diwali (8 Nov), Guru Nanak Jayanti (24 Nov), Thanksgiving (26 Nov) and Christmas (25 Dec).
- [x] The privacy page matches the database. Checked 15 Oct: the live page already shows the 13 Oct 2026 text, so no deploy was needed for that. The install-referrer line below was added and deployed afterwards.
- [x] Open https://resuming.me/privacy and confirm the live page says (checked 15 Oct, all four are there): usage events are collected, they are deleted after 13 months and on account deletion, referral records keep a hashed device ID, and backups last up to 7 days.
- [x] **Add the Play install-referrer line.** Done 15 Oct: an “Install source (Android)” bullet is in `public/privacy.html`, `public/privacy/index.html` and `src/components/LegalPage.tsx`, the date is now 15 Oct 2026, and resuming.me is redeployed. Checked live at https://resuming.me/privacy. The same deploy also shipped the Anulom Vilom centering fix. Android 1.0.5 doesn’t have that fix.
- [ ] `npm test` passes.
- [ ] **Sign-in on 1.0.5.** `api.resuming.me` is set up outside the code, so check it by hand: it answers, Google sign-in works from the 1.0.5 build, Google’s screen says resuming.me, and you land back in the app. Try email sign-in too if the app still offers it.
- [ ] Install the 1.0.5 build from closed testing on a phone that is not your daily one. Check: Google sign-in, Today in Hindi, a reminder with a photo, a shared WhatsApp link that opens the event page, the community calendar (Reminders → community button → Diwali shows and can be added), Health Connect steps if the phone has them, and offline then back online.
- [ ] **Decide what to do with the site’s Play buttons.** `PLAY_LIVE` is `true` in `marketing/src/site.ts` and resuming.app was deployed with it on 15 Oct, so the buttons open a Play page that does not exist yet. Either leave it and do not send anyone to resuming.app until the listing is public, or set it to `false`, redeploy (`cd marketing && npm run deploy`), and set it back to `true` on launch day. Until the listing is public, use `https://resuming.me/start` in bios and posts.
- [ ] **Get the posts ready** (see Part 5 of `marketing.md`, “What to do this afternoon”): bios and pictures on Facebook, Instagram and YouTube, the Hindi clips R1 and R2 recorded, the Facebook, Instagram and LinkedIn captions written as drafts, the tracking sheet made, and the admins of the groups you want to post in asked. Publish nothing about Android yet.

## Play Console

Follow `play-listing/release-1.0.5.md`, then the Data safety lines below. English is enough to go live. The other six languages can follow in the first week.

- [ ] **Main store listing** is as in “Today”. Name `Resuming: Habits & Reminders`. Short description `Track your day, gently. Missed a day? Just resume.` Full description from `play-listing/listing-en.md`. Feature graphic `play-listing/feature-graphic.png`.
- [ ] Read the listing once more. Every line is a feature that ships. No medicines, no “coming soon”, no health claims.
- [ ] **Data safety**, on top of the three changes already written in `release-1.0.4.md` (reminder photos, shared-event text, anonymous device id for shared events). Check those three are saved in Play Console, then add:
  - Device or other IDs: a hash of the Android ID, stored with a referral group so installs and five-day returns can be counted. Not shared. Not required. Purpose: analytics (and app functionality if that type is already declared).
  - App activity: in-app usage events (event name, anonymous device id, page, app version, platform). Not shared. Purpose: analytics.
  - The form matches https://resuming.me/privacy.
- [ ] **After Google approves production access: Production → Create new release.** Upload the same bundle, paste the release notes from `play-listing/release-1.0.5.md`, and roll out.

## Launch day

Start this list only when the Play page loads for a signed-out browser, not when the release is “in review”. The smallest launch that still counts is the first five items. The rest can slip a day.

- [ ] On a phone that has never had the app, install from the public link. Sign in, open a shared WhatsApp link, and switch the app to Hindi.
- [ ] Confirm https://resuming.app Play buttons open that same public page. If you set `PLAY_LIVE` to `false`, set it back to `true` and redeploy the site (`cd marketing && npm run deploy`). Then put `https://resuming.app` in the bios.
- [ ] Post the Hindi clip (R1) as an Instagram Reel, a Facebook Reel and a YouTube Short, from the same file, each with its own tagged Play link (`marketing.md`, Links).
- [ ] Post one short clip (hero loop or a B-roll cut), with a tagged Play link, to WhatsApp Status and in the WhatsApp and Facebook groups you already belong to. Read each group’s rules first.
- [ ] Post the launch post on the Facebook Page, then the Hindi one a few hours later. Post the founder note on LinkedIn.
- [ ] Publish Medium article 1 (“Missed a day? Why restarting is the real skill”) if it is written. If it is not, write it the same week. Do not hold the listing for the article.
- [ ] Send each referral-group member their own link from `/admin/groups`. Tell them payment waits until the checks in the last checklist below.
- [ ] Message the people who tested the app, one at a time, asking for an honest review. Ask once, do not ask for five stars, and offer nothing in return (`marketing.md`, B3).
- [ ] In Play Console, open Android vitals. Reply to every review and every public comment the same day.
- [ ] Open the tracking sheet and fill a row at hour 1, 6 and 24. If there is a crash on the first open or on sign-in, stop posting and stop ads until a fix is in review.

## First two days

- [ ] Day 1: start Quora answer 1 (English). Answer comments on every post.
- [ ] Day 2: start the Google app campaign and the Instagram/Facebook install ads at about $10 a day each, India, Hindi and English, installs only. Wording stays on habits, reminders, and family dates. Do not describe anyone’s health in an ad.
- [ ] Each ad uses its own `utm_source` on the Play link. Referral-group links stay the ones from `/admin/groups` and do not get a second campaign tag.
- [ ] Check crashes again. A crash on the first open or on sign-in stops the ads until a fix is in review.

## Days 3 to 7

- [ ] Product Hunt, three to five days after the page is public, once there is at least one review to point to.
- [ ] Peerlist, r/developersIndia, and Indie Hackers: the build story, after reading each community’s rules.
- [ ] Dev.to and Hashnode: the same build story, with the canonical link set to the Medium (or later the blog) copy.
- [ ] Quora: the second answer, in Hindi, on restarting a habit after a missed day. Link the article where the site allows it.
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

- [x] **A retained person is an account.** Decided 15 Oct: someone who creates an account and opens the app on five different days (decision 8 in `marketing.md`). Built and applied to production on 15 Oct (migration `20261027120000_marketing_retained_accounts.sql`), and tested with `supabase/scripts/test_marketing_pay_checks.sql`. The account link is made on the next open after sign-in, so count only installs whose window has closed.
- [ ] The pay-check migration is on production, and “Before you pay” is visible on the group page.
- [ ] Each group is set to ₹20 per retained person (an account that opened the app on five different days), no pay for a bare install, a ₹20,000 cap, and a minimum of 500 retained people.
- [ ] Play Console’s install count for that group’s source tag has been typed in. If our count is at least 20% higher, and at least 10 higher, do not pay until you know why.
- [ ] Only installs whose 30 days ended at least 7 days ago are in the payable figure.
- [ ] Any spike flag (a day with at least 25 installs and at least five times that member’s usual day, or at least 70% of 20 or more closed installs opening on five days) has a note about what the member posted.
- [ ] The privacy page and the Data safety form both describe the hashed device ID, the install referrer, and usage events.
- [ ] Play Integrity (a server check that the install is the real app) is still not built. Until it is, do not raise the cap or add groups beyond the first ones.

## Not in this launch

- Listing copy in Gujarati, Marathi, Telugu, Tamil, and Bengali. Hindi first, then those, after English is live.
- The in-app Play review prompt. It is not in the app. Ask for reviews by hand in the first week, and add the prompt after the third day someone logs something (task P15-12 in `marketing.md`).
- Indus Appstore. Decided 15 Oct: yes, after the Play launch is stable (see “After the Play launch is stable” below). No other store.
- Influencer Reels. Book them only after a paid channel clears the week-2 gates.
- The admin community-days and referral-group screens. They work, but nothing in a post or the listing should point to them.

## After the Play launch is stable

Not before week 2. Google Play stays the only store in launch week.

- [ ] **Indus Appstore** (PhonePe’s, built for India). Add Indus’s signing key to `public/.well-known/assetlinks.json` first, so shared links open inside the app and not the web page. Use the same screenshots, description and release notes as Play, and give it its own tagged link (`utm_source=indus`) for the posts that point to it.
- [ ] Do not list on Samsung Galaxy Store or Xiaomi GetApps for now.
