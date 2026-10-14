# Resuming — Phase 15: Android launch, promotion, and keeping people

Goal: after the 14-day closed test, launch on Google Play and bring in the first few thousand Indian users with a $500 budget plus free channels, then keep them using it. Success is people who come back, not installs alone.

## Where things stand (12 Oct 2026)

| Part | State |
|------|-------|
| Android | Day 12 of the 14-day closed test. Launch (production access) follows day 14. |
| Price | Free, no ads, no selling data. An install earns nothing, so retention is the real measure. |
| Audience | Indian adults of about 30 to 60 who want small daily routines (a walk, water, Pranayam, BP) and keep the family's dates (bills, doctor visits, weddings). See P14-01. |
| Languages | Seven: English plus Hindi, Gujarati, Marathi, Telugu, Tamil, Bengali. |
| Message | "Missed a day? Just resume." |
| Assets | Play listing, feature graphic and six screenshots in `play-listing/`. English and Hindi screen recordings (B1 to B9) made for Phase 14. The hero loop (English and Hindi) is on the site. The 75-second explainer and the vertical short are not made yet. |
| Site | resuming.app is built (Astro, in `marketing/`, its own Cloudflare worker). The Play buttons stay off until the listing is public. It has no blog yet. |
| Own analytics | The app already records its own events and page views on our server (`track.ts`, `analytics.ts`). The admin Analytics screen shows sign-ups, day-1 and day-7 return, and weekly cohorts. Nothing is sent to Google or Meta. |
| Referral groups | Built. An admin makes a group (a community or a set of people), adds members, and each member gets a Play link with their own code. The app reads Google's install referrer and counts each install and each person who opens the app on five different days within 30 (`marketing_*` tables, `marketing_record_open`, the `/admin/groups` screen). The app records payments but does not send money. The problems to fix before paying anyone, and the data retention gaps, are listed in P15-15. |
| Built-in growth loop | A shared reminder opens a page with "Get it on Google Play". Every wedding or event someone shares reaches new people. |
| Not shipped | Medicines (web only), widgets, circles. None appear in ads or posts. |

## Rules

- **Show only what ships.** Same rule as Phase 14. No medicines, widgets, or "coming soon" in any ad, post, or video.
- **No health claims.** Say "habits and reminders" and "log your BP". Never what it cures or prevents. Google and Meta review health ads strictly.
- **The privacy promise stays true.** No ads, no selling data. Measure with our own analytics, Play Console, and tracking links on the Play URL. Do not add Google's or Meta's code to the app to feed their ad platforms (see decision 2).
- **Say what we collect.** The hashed device ID and install referrer used for referral groups go in the privacy policy and the Play Data safety form before launch (P15-15).
- **Play link only.** Never share an APK. APK installs do not update, hurt ratings and tracking, and are a security risk.
- **No TikTok.** It is banned in India. Use Instagram Reels, YouTube Shorts, and optionally ShareChat or Moj.
- **Disclose paid posts.** Influencer posts carry a clear "ad" or "paid partnership" label, as Indian advertising rules expect. Check the current ASCI influencer guidelines before the first one.
- **Hindi first.** Then Gujarati and Marathi. Few habit apps do these well, so this is where Resuming stands out.
- **Stop what does not work.** Each paid channel gets a small test and a gate before more money goes in.

## Targets

An install is not a user. Paid installs often leave quickly, so the targets are about people who come back.

| Measure | Target |
|---------|--------|
| Day-1 return | 30% |
| Day-7 return | 12% |
| Day-30 return | 6% |
| Play rating | 4.5 or better, with at least 25 reviews in the first month |
| Cost per install (paid) | Stretch $0.10, expected $0.20 to $0.30, stop above $0.50 |

These costs are estimates for Android in India and need checking against the first week's real numbers.

| Scenario | Installs from $500, plus free channels |
|----------|----------------------------------------|
| Stretch (about $0.10 each) | About 5,000 paid |
| Expected | 2,000 to 3,500 paid, plus 500 to 1,500 free |
| Floor | About 1,200 paid |

## Decisions to make

1. **What "10,000 per 1000" means.** Read here as 10,000 installs per $1,000 ($0.10 each). Confirm, or correct this file.
2. **Install-only ads, or add Google's or Meta's code.** The app already measures itself, and that stays on our server. The question is whether ad platforms get to see what each person does. For that, their code (an SDK, such as Firebase) must sit inside the app and report to them, which shares user data and changes the privacy page and Data safety form. Suggested: no. Run ads that aim for installs only, judge quality with our own day-1 and day-7 numbers, and accept a somewhat higher cost per install.
3. **Which stores beyond Google Play.** Suggested: Indus Appstore (PhonePe's, built for India) after the Play launch. Skip Samsung Galaxy Store and Xiaomi GetApps for now. Each needs its own uploads and updates. A shared link such as `resuming.me/e/abc` opens inside the app only if the app's signing key is listed in `assetlinks.json`, which has two keys today, including Play's. An app from another store with a different key would open the web page instead. Add that store's key to the file before using it, including for Indus.
4. **Influencer terms.** Free use of the app is no reason for a creator to post. Suggested: pay a flat fee per Reel with a short written brief and the disclosure label, and no promises about results.
5. **Who records Hindi and regional voice-overs.** HeyGen covers English and Hindi. Gujarati, Marathi, Telugu, Tamil and Bengali need captions at least, and ideally a native check.
6. **In-app review prompt.** Check whether the app asks for a Play review after a good moment. If not, add it (P15-12).
7. **Referral group numbers and budget.** Suggested: ₹5 per install, ₹10 per five-day return, a cap of ₹15,000 per 1,000 installs (at most ₹5,000 + ₹10,000), and no pay until 500 installs. The form defaults to ₹50 for a return and has no cap, so both must be set by hand. If 15% to 30% of people return, 1,000 installs cost about ₹6,500 to ₹8,000. Decide whether this comes out of the $500 (suggested: yes, about $175 at the most, at roughly ₹85 per dollar), so the paid split shrinks accordingly.
8. **What "returned" means.** Today it is five different days opening the app in 30 days, even if nothing is logged. Suggested: keep it for the first group, and review the numbers by hand before paying.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 Ready | P15-01 Play listing in seven languages | M |
| | P15-02 Tracking links per channel | S |
| | P15-03 Creative pack | M |
| | P15-04 Three articles | M |
| | P15-05 Influencer shortlist | S |
| | P15-15 Referral groups ready to pay | M |
| M2 Launch week | P15-06 Production access and go-live | S |
| | P15-07 Free posting | M |
| | P15-08 Credibility channels | S |
| M3 Paid test | P15-09 Google app campaign | S |
| | P15-10 Instagram and Facebook ads | S |
| | P15-11 Influencer Reels | M |
| M4 Keeping people | P15-12 Review prompt and first-week check | S |
| | P15-13 Weekly review | S |
| M5 Content engine | P15-14 YouTube and Instagram, weeks 2 to 8 | L |

M1 can start now, while the test finishes. M3 starts only after the listing is public. Phase 14's videos and site feed this phase, and M1 does not wait for the site.

## Milestone 1 — Ready (now to the end of the test)

### P15-01 — Play listing in seven languages

- Translate the title, short description, full description, and release notes into Hindi, Gujarati, Marathi, Telugu, Tamil and Bengali, with the English as the base (`play-listing/listing-en.md`).
- Screenshots in English and Hindi at least, with captions in the listing language where possible.
- Keep every line to features that ship. No health claims.
- Done when the listing reads naturally in each language, checked by a native speaker, and the Play Console preview shows no missing fields.

### P15-02 — Tracking links per channel

- A Play Store link for each channel (Facebook groups, WhatsApp, Reddit, Quora, Instagram, YouTube, each paid campaign, each influencer) with its own source tag, so Play Console shows where installs come from. Referral groups already have their own links from `/admin/groups` (`marketingInstallLink`), so use those for people who are paid per install and tags for everything else.
- The "Get it on Google Play" button on shared event pages carries its own tag, so the sharing loop can be counted.
- Done when a test click from each link shows up under its own source in Play Console.

### P15-03 — Creative pack

- Cut the Phase 14 videos into 6 to 15 second pieces for Reels and Shorts. Vertical, captions on, English and Hindi first.
- About ten shareable image cards, sized for WhatsApp status and Instagram. One line and the logo, such as "Missed a day? Just resume."
- A press kit page or folder: logo, screenshots, one paragraph, the founder note.
- Done when each cut and card exists in English and Hindi and passes the rules above (nothing unshipped, no health claims).

### P15-04 — Three articles

1. "Missed a day? Why restarting is the real skill."
2. "A habit app for Indian families: seven languages, no ads."
3. "How to share a wedding or doctor reminder on WhatsApp."

A fourth, the build story, is for the builder communities in P15-08. Each article goes in English, and the first two in Hindi. Write them all before launch, but publish from launch day, because the Play link is not public until then.

Where each one goes:

| Where | What | When |
|-------|------|------|
| **Medium** | Articles 1 and 2, in English and Hindi. This is the main copy until resuming.app has a blog. | Launch day |
| **LinkedIn** | The founder story as an article, plus a short post linking to it. | Launch day |
| **Quora** | No full articles. Answer questions such as "how do I restart a habit after missing days?" in 150 to 300 words, in English and Hindi, linking to the article. | From launch day, a few a week |
| **Facebook and WhatsApp groups** | The 20-second clip and the article link, never the full text. | Launch day |
| **Dev.to and Hashnode** | The build story only, with the canonical link set to the main copy so Google does not see a duplicate. | Days 3 to 5 |
| **Reddit, Indie Hackers, Peerlist, r/developersIndia** | The build story, told as a story. Read each community's rules first. | Days 3 to 5 |
| **resuming.app/blog** | A simple blog page, then move articles here and point Medium's canonical link to it. | Week 2 or later |

From week 2, one new article a week, with the Hindi versions of articles 1 and 2 first.

- Done when three articles are written, checked against the rules, and each ends on a tagged Play link.

### P15-05 — Influencer shortlist

- Five to eight creators with 10,000 to 50,000 followers in yoga, walking, family routines, or regional lifestyle content. Check that the comments look real.
- Note typical fees and ask for a rate card. Expect roughly ₹2,000 to ₹10,000 per Reel, to be confirmed with each creator.
- Done when each shortlisted creator has a name, an audience, a rate, and a tagged link ready.

## Milestone 2 — Launch week

### P15-06 — Production access and go-live

- Apply for production access as soon as day 14 of the test is complete. Review can take a few days, so ads wait until the listing is public.
- Check the first public build once more: sign-in, a shared link opened from WhatsApp, Health Connect, and a Hindi run through Today.
- Done when the listing is live and the tagged links open the public page.

### P15-07 — Free posting

Post a short clip or story, never a bare link, and read each group's rules first.

- **Facebook and WhatsApp groups:** yoga, Pranayam, morning-walk, senior-citizen, and Gujarati and Marathi community groups. A 20-second clip with the tagged link.
- **Housing society and RWA groups, walking and yoga clubs:** a short personal note and the clip.
- **Quora:** answers to "how do I restart a habit after missing days?", in English and Hindi, with the article linked where allowed.
- **Reddit:** r/getdisciplined, r/Habits, r/productivityapps, r/androidapps. A "why I built this" post that gives value first.
- **LinkedIn and X:** the founder story.
- Done when each place has been posted once, with replies answered the same day.

### P15-08 — Credibility channels

These bring feedback, backlinks, and trust more than installs. Expect 50 to 300 installs in total.

- **Indus Appstore:** list the app after the Play launch (see decision 3).
- **Peerlist:** a launch post with the builder story.
- **r/developersIndia:** a story post that follows its self-promotion rules.
- **Indie Hackers:** screenshots and the build story.
- **Product Hunt:** three to five days after launch, once there are reviews to point to. The audience is mostly builders, so use it for credibility.
- **Smol Launch and LaunchDB:** free listings for a backlink, if still active when the time comes.
- **Indian startup press (YourStory, Inc42, NextBigWhat):** one short pitch each. A long shot.
- Skipped on purpose: BetaList (a waitlist for unlaunched web products), r/appledevelopers (the app is not on iOS), and any APK sharing.
- Done when each listed place has a post or listing, with its tagged link.

## Milestone 3 — Paid test ($500)

| Item | Budget | Notes |
|------|--------|-------|
| Google app campaign (India, Hindi and English) | $150 | About $10 a day to start, installs only |
| Instagram and Facebook install ads | $100 | Vertical Hindi clips first |
| Influencer Reels | $150 | Three to five creators |
| Reserve | $100 | Goes to whichever channel proves cheapest |

**Gates.** Spend about $50 on each paid channel first. Stop a channel if cost per install goes above about $0.50, or if day-1 return is below about 20%. Move its money to the best one.

### P15-09 — Google app campaign

- Set up an install-only campaign for India in Hindi and English, with the Hindi vertical clips and the screenshots. Add other languages only after Hindi and English show a result.
- Done when the campaign runs, and the first $50 is reviewed against the gates.

### P15-10 — Instagram and Facebook ads

- Run the vertical Hindi clips, then English, to adults of about 30 to 60. Wording stays on habits, reminders, and family dates.
- Done when the first $50 is reviewed against the gates.

### P15-11 — Influencer Reels

- Book the first three creators with a brief: the one message, the real app on screen, the disclosure label, the tagged link.
- Done when each Reel is live and its installs and day-1 return are recorded against its link.

## Milestone 4 — Keeping people

### P15-12 — Review prompt and first-week check

- Ask for a Play review after the third day someone logs something, not on first open. Use the Android in-app review prompt if the app does not already.
- Read the first week as a new user would: the first open, the first reminder, the nudge after quiet days. It should feel gentle, not naggy.
- Done when the review prompt works on a real phone and the first-week reminders have been checked.

### P15-13 — Weekly review

Every week, fill in one table: spend, installs per channel, cost per install, day-1 and day-7 return, new reviews, and what to change. Take day-1 and day-7 return from the admin Analytics screen, and installs per source from Play Console and the referral groups. Check Play Console for crashes and one-star reviews and reply to every review.

- Done when the first four weeks are in the table and each week's change is written down.

## Milestone 5 — Content engine (weeks 2 to 8)

### P15-14 — YouTube and Instagram

Four themes, all gentle and with no health claims:

1. **Restart stories:** "Day 1 again", with a small win.
2. **Follow along:** Pranayam and Kapalabhati with the in-app video.
3. **Family reminders:** sharing a wedding or bill on WhatsApp.
4. **Behind the scenes:** a one-person app, built in public.

Cadence:

- YouTube: three Shorts a week (24 over eight weeks) and one longer video every two weeks, starting with the Hindi explainer and "how to restart a habit".
- Instagram: four Reels a week, stories on the other days, and one carousel a week.
- Reuse the B-roll and the Phase 14 videos. Keep the same message throughout.
- Done when eight weeks of the cadence have run and the best three themes are known from views and installs per tagged link.

### P15-15 — Referral groups ready to pay (belongs to M1, listed here to keep it with the launch checklist)

The referral system works, but these must be done before anyone is paid on its numbers.

- **Set the numbers** on each group: ₹5 per install, ₹10 per five-day return, a cap of ₹15,000 per 1,000 installs, and a 500-install minimum (decision 7). The goal is only displayed and does not stop pay, so the cap is what limits spending.
- **Close the fake-install hole.** `marketing_record_open` is open to anyone (`anon`) and trusts what the phone sends. The member code is visible in the Play link, so a script could send unlimited fake device keys and days, which after five days count as returned. Before paying: compare each group's installs with the referral figures in Play Console, watch for sudden jumps, and pay by hand only after both agree. Better: have a server function check Google's Play Integrity token, so only real installs of the real app count.
- **Say it in the privacy policy and Data safety form.** The app stores a hash of the device's Android ID and reads Google's install referrer (`InstallReferrerPlugin.java`). The policy mentions neither, and `release-1.0.4.md` mentions an anonymous device ID only for shared events. The policy also does not mention the in-app usage events (the `events` table: event name, a per-device anonymous id, page, app version, platform). It names only page views. List all three.
- **Data retention and deletion (checked on 12 Oct 2026).** The policy says data is kept while an account is active and gives no period. What the code and database do today:
  - **Nothing expires.** The database has no scheduled cleanup jobs. Inactive accounts are never removed. Usage events (about 6,600 rows), page views (about 4,100) and install records (about 610) are kept indefinitely.
  - **Account deletion** (the `delete-account` function) removes the profile, habits, logs, vitals, medicines, reminders, shared events, the medicine, reminder and event photos, feedback and page views.
  - **Account deletion leaves these behind.** Usage events keep their rows with only the user id blanked, and each still carries the anonymous device id. Install records (`marketing_installs`) hold a hashed device id and the referral group, are not linked to an account, and are never touched. The policy's "deleting your account removes it" is slightly too strong for these two.
  - **Export** leaves out medicines (the policy says so). Backups: the project is on the Pro plan, which keeps daily backups for 7 days, and the policy now says deleted data can remain in backups for up to 7 days (13 Oct 2026).
  - **To do:** (1) delete a user's usage events when their account is deleted, or say in the policy that they are kept anonymously. (2) Say in the policy what happens to install records. (3) Pick and state a plain period for events, page views and install records, for example 13 months, and add a scheduled cleanup to match. (4) Look up the backup period on the Supabase plan and put it in the policy. (5) Move the "Last updated" date.
  - **Decision (13 Oct 2026).** Build (1) to (3) with a period of 13 months. Written and tested, **not yet deployed**:
    - `supabase/migrations/20261019120000_data_retention.sql` adds `erase_user_usage` (deletes a deleted account's events, including those its device sent before sign-in, and takes the email off any referral seat) and `enforce_data_retention` (daily at 03:30 UTC through pg_cron: deletes events and page views older than 13 months, and replaces the device id of install records older than 13 months with a random value so the totals stay).
    - The `delete-account` function calls `erase_user_usage` before deleting the user.
    - Install records are not linked to an account, so account deletion cannot find them. The 13-month rule is what removes the device id. The policy says so.
    - The policy has a new "usage data" paragraph in the Retention section (three copies).
    - Tried in a rolled-back transaction on production: events, page views and installs behaved as above, and anon and signed-in users cannot run either function. At the moment nothing is older than 13 months, so the first run deletes nothing.
    - To go live: apply the migration, deploy `delete-account`, then deploy the app so the policy matches.
- **Fix the analytics limit (built 13 Oct 2026, not yet deployed).** The Analytics screen downloaded event rows and counted them in the browser. The API returns at most 1,000 rows per request (`max_rows` in `supabase/config.toml`), so the `.limit(5000)` and `.limit(8000)` calls were really cut at 1,000, oldest first. The comeback loop and cohorts were already affected, with 3,534 `app_opened` events in 90 days. Now the onboarding funnel, guest journey and creates, reminders and shared events, and the comeback loop and signup-week cohorts are counted in the database (`onboarding_funnel_summary`, `guest_journey_summary`, `reminder_analytics_summary`, `loop_analytics_summary`, migration `20261020120000_analytics_summaries.sql`). The page-view and website cards still count in the browser, but now read every page of rows and show an error above 100,000 rows instead of a partial number. Checked: the old browser code and the new SQL gave the same numbers on the 6,900 production events from the last 95 days, and `supabase/scripts/test_analytics_summaries.sql` keeps the rules under test. One deliberate change: a person who signed up twice now counts once in the signup-week cohorts (before, each sign-up event counted, so 8 people showed as 18). Next step if traffic grows: move the page-view and website counts into the database too.
- **Smaller:** the app version is fixed at `0.1.0` in `track.ts`, so versions cannot be compared. Add tests for the database function and for abuse cases.
- Done when a test group shows correct numbers after a scripted fake install is rejected or flagged, the policy and Data safety form match what the app stores, the policy's retention section matches what the database does (including what account deletion leaves behind), and the Analytics screen still shows the latest events when a window holds more than 5,000 of them.

## Launch-day checklist

**Before launch day**
1. Set the referral group numbers and fix P15-15.
2. Add the privacy-policy and Data safety lines.
3. Finish the Play listing in English and Hindi at least.
4. Finish the pending release steps: push the commits, deploy `delete-account`, deploy the website, and build the release app.
5. On day 14 of the test, apply for production access. Review can take a few days.

**Launch day (when the Play page is public)**
1. Install from the public link on a clean phone. Check sign-in, a shared WhatsApp link, and Hindi.
2. Switch on the Play buttons on resuming.app and redeploy it.
3. Send each referral group member their own link.
4. Post the clip in WhatsApp and Facebook groups. Publish Medium article 1 and the LinkedIn founder story. Start Quora answers.
5. Check Play Console for crashes and reply to every review and comment.

**After launch**
- Day 2: start the Google and Instagram ads at about $10 a day each.
- Days 3 to 5: Product Hunt, Peerlist, r/developersIndia, Indie Hackers, and the build story on Dev.to and Hashnode.
- Week 2: read the numbers against the gates and move money to the best channel.

## Timeline

| When | What |
|------|------|
| Now to day 14 of the test | M1: listing, tracking links, creative pack, articles, influencer shortlist, referral groups ready to pay (P15-15) |
| After day 14 | Apply for production access (P15-06). No ads until live |
| Launch week | Free posting (P15-07). Credibility channels (P15-08), with Product Hunt on day 3 to 5. Start the Google and Instagram tests at about $10 a day each |
| Weeks 2 to 3 | Read the numbers against the gates. Move money to the best channel. Influencer Reels go live |
| Weeks 4 to 8 | Content cadence (P15-14), one article a week, and fix onboarding from the day-7 and day-30 numbers |

## Out of this phase

- Medicine reminders, widgets, circles, and any other unshipped feature in public material.
- TikTok, APK sharing, and other app stores until decision 3 is settled.
- Google's or Meta's code inside the app, to feed their ad platforms (decision 2).
- Paid ads in the other five languages until Hindi and English show a result.
- Any claim about health outcomes.
