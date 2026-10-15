# Marketing — Resuming launch playbook

Resuming is a free daily list for habits, health numbers, and reminders. The line everything hangs on is **Missed a day? Just resume.**

This is the one file for the public Google Play launch: the strategy, the tasks, what to post where, and the launch risks. It replaces `docs/PHASE-15.md`. The task numbers (P15-01 to P15-15) are kept, because `docs/LAUNCH.md` and the database migrations refer to them. Ideas that are not scheduled yet live in [newIdeas.md](./newIdeas.md). The go-live checklist, with the release order and the pay checks, is [docs/LAUNCH.md](./docs/LAUNCH.md).

The web app is already at [resuming.me](https://resuming.me). The site is [resuming.app](https://resuming.app). The Android package is `com.cheerfulgames.resuming`.

| Part | What is in it |
|------|---------------|
| 1. Strategy | Where things stand, targets, decisions, rules, tracking links |
| 2. Step 1: Where to post | Every place, in order, and the bios |
| 3. Step 2: What to publish | Themes, clips to record, the first 14 days, and paste-ready copy per channel |
| 4. Task plan | Milestones M1 to M5 with budget, gates, referral groups, the launch-day checklist and the timeline |
| 5. Launch risks and gaps | Problems to fix before posting, and what the plan had missed |

Owned accounts:

| Account | Address | What it is for |
|---------|---------|----------------|
| Facebook | [facebook.com/resumingme](https://www.facebook.com/resumingme) | Page posts, and the home base you link from groups |
| Instagram | [instagram.com/resumingme](https://www.instagram.com/resumingme/) | Reels, carousels, stories. The main visual channel |
| YouTube | [youtube.com/@resumingme](https://www.youtube.com/@resumingme) | Shorts now, the longer explainer when it exists |

WhatsApp is not a public page, and it will still bring more installs in India than the three accounts above. Treat Status and the groups you already belong to as a fourth place, with the same clips.

---

# Part 1 — Strategy

Goal: after the 14-day closed test, launch on Google Play and bring in the first few thousand Indian users with a $500 budget plus free channels, then keep them using it. Success is people who come back, not installs alone.

## Where things stand (12 Oct 2026, updated 15 Oct)

| Part | State |
|------|-------|
| Android | The closed test reached day 14 on 14 Oct. Build 1.0.5 (version code 8) is the release. Production access still has to be applied for, and then Google reviews it, which can take a few days. The public date is not in our hands. The steps are in `docs/LAUNCH.md`. |
| Price | Free, no ads, no selling data. An install earns nothing, so retention is the real measure. |
| Audience | Indian adults of about 30 to 60 who want small daily routines (a walk, water, Pranayam, BP) and keep the family's dates (bills, doctor visits, weddings). See P14-01. |
| Languages | Seven: English plus Hindi, Gujarati, Marathi, Telugu, Tamil, Bengali. |
| Message | "Missed a day? Just resume." |
| Assets | Play listing, feature graphic and six screenshots in `play-listing/`. English and Hindi screen recordings (B1 to B9) made for Phase 14. The hero loop (English and Hindi) is on the site. The 75-second explainer and the vertical short are not made yet. |
| Site | resuming.app is built (Astro, in `marketing/`, its own Cloudflare worker). The Play buttons were meant to stay off until the listing is public, but `PLAY_LIVE` is already `true` in `marketing/src/site.ts` (see LAUNCH.md), so they may point at a missing page until the listing is live. It has no blog yet. |
| Own analytics | The app already records its own events and page views on our server (`track.ts`, `analytics.ts`). The admin Analytics screen shows sign-ups, day-1 and day-7 return, and weekly cohorts. Nothing is sent to Google or Meta. |
| Referral groups | Built. An admin makes a group (a community or a set of people), adds members, and each member gets a Play link with their own code. The app reads Google's install referrer and counts each install and each signed-in person who opens the app on five different days within 30 (`marketing_*` tables, `marketing_record_open`, the `/admin/groups` screen). The app records payments but does not send money. The problems to fix before paying anyone, and the data retention gaps, are listed in P15-15. |
| Built-in growth loop | A shared reminder opens a page with "Get it on Google Play". Every wedding or event someone shares reaches new people. |
| Not shipped | Medicines (web only), widgets, circles. None appear in ads or posts. |

## Targets

An install is not a user. Paid installs often leave quickly, so the targets are about people who come back.

| Measure | Target |
|---------|--------|
| Day-1 return | 30% |
| Day-7 return | 12% |
| Day-30 return | 6% |
| Play rating | 4.5 or better, with at least 25 reviews in the first month |
| Cost per install (paid) | Stretch $0.10, expected $0.20 to $0.30, stop above $0.50 |
| Cost per retained user (referral groups) | ₹20 (about $0.24), paid only for people who made an account and opened the app on five days. Nothing until a group has 500, and a ₹20,000 cap (decisions 1 and 7) |

These costs are estimates for Android in India and need checking against the first week's real numbers.

| Scenario | Installs from $500, plus free channels |
|----------|----------------------------------------|
| Stretch (about $0.10 each) | About 5,000 paid |
| Expected | 2,000 to 3,500 paid, plus 500 to 1,500 free |
| Floor | About 1,200 paid |

## Decisions to make

1. **What "10,000 per 1000" means.** Decided 15 Oct 2026: it is about **retained users, not installs**. A retained user is someone who **creates an account and then opens the app on five different days** (within 30 days of installing). A group is paid ₹20 for each one, nothing until it has 500 (₹10,000), and never more than ₹20,000 (reached at 1,000). An install on its own earns nothing. This replaces the earlier reading of 10,000 installs per $1,000, and the ₹10-each reading (₹10,000 for 1,000 people), which was set aside in favour of the ₹20 already built.
2. **Install-only ads, or add Google's or Meta's code.** Decided 15 Oct 2026: **no.** No Google or Meta code goes inside the app, and ads aim for installs only. The app keeps measuring itself on our own server, and quality is judged with our own day-1 and day-7 numbers, at a somewhat higher cost per install. Adding their code later would share user data and change the privacy page and the Data safety form.
3. **Which stores beyond Google Play.** Decided 15 Oct 2026: **yes to Indus Appstore** (PhonePe's, built for India), **after the Play launch** is stable. It is not part of launch week. Skip Samsung Galaxy Store and Xiaomi GetApps for now, because each needs its own uploads and updates. A shared link such as `resuming.me/e/abc` opens inside the app only if the app's signing key is listed in `assetlinks.json`, which has two keys today, including Play's. An app from another store with a different key would open the web page instead. Add Indus's key to the file before listing the app there.
4. **Influencer terms.** Free use of the app is no reason for a creator to post. Suggested: pay a flat fee per Reel with a short written brief and the disclosure label, and no promises about results.
5. **Who records Hindi and regional voice-overs.** HeyGen covers English and Hindi. Gujarati, Marathi, Telugu, Tamil and Bengali need captions at least, and ideally a native check.
6. **In-app review prompt.** Checked on 15 Oct 2026: the app source has no call to Play's in-app review. Add it (P15-12). `docs/LAUNCH.md` says to ask by hand in the first week until then. The review target (25 reviews at 4.5 or better) depends on it. Never offer anything in return for a review, because Play forbids it.
7. **Referral group numbers and budget.** Decided: pay only for retained people (five different days within 30 days of installing). ₹20 per retained person, nothing until the group has 500 retained people (₹10,000), and a cap of ₹20,000 per group (reached at 1,000 retained people). Installs earn nothing. The new-group form now defaults to these numbers. Decide whether this comes out of the $500 (about $235 at the most per group, at roughly ₹85 per dollar), so the paid split shrinks accordingly. Confirmed 15 Oct 2026 (decision 1): ₹20 each, a minimum of 500 and a cap of ₹20,000. The rate, cap and minimum are per-group settings (`retained_rate_rupees`, `cap_rupees`, `min_payout_installs`).
8. **What "retained" means.** Decided 15 Oct 2026: someone who **creates an account and opens the app on five different days** (opening is enough, nothing has to be logged). The 30-day window stays as built. **Built and applied 15 Oct 2026** (migration `20261027120000_marketing_retained_accounts.sql`). Each install record now has a `user_id`. The app's daily `marketing_record_open` call links it to the signed-in account, taken from the login token on the server, never from a value the phone sends. A first open is usually signed out, so the link is made on the next day's open after sign-in, inside the 30-day window. A retained person is an install with an account **and** five open days. One account links to one install only (a second phone or a reinstall is paid once), and the link is removed when the account is deleted. A device with five days and no account stays "in progress" until its window ends, then "ended short". That also makes fake installs harder, because a script now needs a real signed-in account for every payout, not just made-up device keys. Opening the app on five days is still easy to fake with real accounts, so keep reading the spike flags (P15-15).

## Rules for every post

- **Show only what ships.** Habits (walk, water, Pranayam, Heartfulness follow-along, a YouTube link on any habit), vitals (blood pressure, weight, heart rate, sleep), steps from Health Connect, reminders with a photo, sharing an event on WhatsApp, and seven languages. Free, no ads. Leave out medicines, widgets, circles, "coming soon", and anything still being built.
- **No health claims.** Say "habits and reminders" and "log your BP". Never what it cures or prevents. Do not say the app lowers blood pressure, improves sleep, or treats anything. Google and Meta review health ads strictly. If a post mentions BP or weight, add one plain line: Resuming does not give medical advice.
- **No streak shame.** A missed day is just a day. The app does not break a streak.
- **The privacy promise stays true.** No ads, no selling data. Measure with our own analytics, Play Console, and tracking links on the Play URL. Do not add Google's or Meta's code to the app to feed their ad platforms (decision 2).
- **Say what we collect.** The hashed device ID and install referrer used for referral groups go in the privacy policy and the Play Data safety form before launch (P15-15).
- **Play link only.** Never share an APK. APK installs do not update, hurt ratings and tracking, and are a security risk.
- **No TikTok.** It is banned in India. Use Instagram Reels and YouTube Shorts, and optionally ShareChat or Moj.
- **Disclose paid posts.** Influencer posts carry a clear "ad" or "paid partnership" label, as Indian advertising rules expect. Check the current ASCI influencer guidelines before the first one.
- **Hindi first.** Then Gujarati and Marathi. Few habit apps do these well, so this is where Resuming stands out. English and Hindi for the owned accounts. Gujarati or Marathi only inside a group that speaks that language, and only if you can write it yourself.
- **Stop what does not work.** Each paid channel gets a small test and a gate before more money goes in.
- **One link per post.** Reply to every comment the same day.
- **Read a group's rules before posting.** If self-promotion is banned, answer a question and mention the app once, or skip the group.
- **Do not hold the listing for a perfect video.** The 75-second explainer and the 30-second presenter short are not made yet. Launch posts use the hero loop, the B1 to B9 screen recordings, and the six Play screenshots in `play-listing/screenshots/`.

## Links

The Play button on the site already carries its own tag. For posts, use a separate link so Play Console shows where the install came from.

Pattern (never add `utm_campaign` — the app treats `utm_source` plus `utm_campaign` as a paid referral code):

```text
https://play.google.com/store/apps/details?id=com.cheerfulgames.resuming&referrer=utm_source%3DSOURCE%26utm_medium%3DMEDIUM
```

| Place | `utm_source` | `utm_medium` |
|-------|--------------|--------------|
| Instagram Reel or post | `instagram` | `reel` or `post` |
| Instagram Story | `instagram` | `story` |
| Facebook page | `facebook` | `post` |
| A Facebook group | `facebook` | `group` |
| YouTube Short or video description | `youtube` | `short` or `video` |
| WhatsApp Status | `whatsapp` | `status` |
| A WhatsApp group | `whatsapp` | `group` |
| Medium | `medium` | `article` |
| LinkedIn | `linkedin` | `post` |
| Quora | `quora` | `answer` |
| Reddit | `reddit` | `post` |
| Dev.to | `devto` | `article` |
| Hashnode | `hashnode` | `article` |
| Product Hunt | `producthunt` | `listing` |
| Peerlist | `peerlist` | `post` |
| Indie Hackers | `indiehackers` | `post` |
| People you know (early reviews) | `friends` | `message` |
| Instagram and Facebook ads | `meta` | `paid` |

People on iPhone or a computer cannot install from Play. Send them to [https://resuming.me/start](https://resuming.me/start). No account is needed to try it.

Referral-group members keep the links from `/admin/groups`. Do not put a second tag on those.

---

# Part 2 — Step 1: Where to post

Post in this order. The first block is where a real person in India will see the app. The later blocks are trust, search, and a record of the launch. They will not carry the first week.

## A. Do these on launch day

These are the only posts that should go out the hour the Play page is public.

| Place | Why it is on this list | Language | What you attach |
|-------|------------------------|----------|-----------------|
| **WhatsApp Status** | People you already know. Highest chance someone installs today | English, then a Hindi status the same day | 15–20 s screen clip, Play link in the caption |
| **WhatsApp groups you already belong to** | Family, society, walking, yoga. One message, then stop | The group’s language | Same clip, or one screenshot plus two lines |
| **Facebook Page** | Permanent home for the launch. Groups can be pointed here | English post, Hindi post a few hours later | Clip or the six screenshots as a carousel |
| **Facebook groups** | Yoga, Pranayam, morning-walk, senior-citizen, Gujarati and Marathi community groups, housing-society groups | Match the group | Clip and the page link, not a wall of text |
| **Instagram** | Reels get shown to people who do not follow you yet | Hindi Reel first, English Reel the next day | Vertical screen recording, captions burned in |
| **YouTube** | Shorts stay searchable. The channel also holds the longer videos later | Hindi Short, then English | Same vertical clip as the Reel. Not marked made for kids |
| **Google Play listing** | This is the page every link lands on. It is marketing, not paperwork | English on day one. Hindi listing in week 1 | Name, short description, full description, feature graphic, six screenshots. Copy is already in `play-listing/listing-en.md` |

## B. Write these in the first week

These bring people from search and from people who do not use Instagram.

| Place | Why | When | What |
|-------|-----|------|------|
| **Medium** | The article Google can find until resuming.app has a blog. Publish here first, and later point the canonical link at the site | Launch day, or the same week if the article is not ready. Do not delay the Play posts for it | Article 1, English. Hindi version the same week |
| **LinkedIn** | Founder note. Useful for press, creators, and anyone who looks you up | Launch day | Short post, first person, Play link |
| **Quora** | People already asking how to restart a habit. An answer outlives a Reel | Two answers in week 1, then a few a week | 150–300 words. Link the Medium article where Quora allows a link |
| **resuming.app** | Every social bio points here. The page already explains the product | Before the first post | Confirm the Play buttons open the public listing |

## C. Days 3 to 7 — credibility, not volume

These audiences are builders. Expect feedback, a backlink, and a small number of installs. Post the build story once. Do not paste the consumer Reel.

| Place | Why it is worth one post |
|-------|--------------------------|
| **Peerlist** | Indian builders. A launch post fits the site |
| **Indie Hackers** | The build story, with screenshots |
| **r/developersIndia** | Only if the post follows that week’s self-promotion rules |
| **r/androidapps** | People looking for a new Android app. Lead with what it does |
| **Dev.to** and **Hashnode** | Same build story as Indie Hackers. Set the canonical URL to the Medium article so Google does not see two copies |
| **Product Hunt** | Three to five days after the listing is public, and only after at least one Play review exists. Makers, not families |
| **Indus Appstore** | A second Indian store listing. Not part of launch week (LAUNCH.md). Do it after Play is stable, and add its signing key to `assetlinks.json` first (decision 3). Same screenshots and description |

Optional, one email each, no follow-up spam: YourStory, Inc42, NextBigWhat. A short pitch. Treat a reply as a bonus.

## D. Leave for later

| Place | Why it waits |
|-------|----------------|
| **resuming.app/blog** | Worth it for search from week 2. Until the page exists, Medium is the article |
| **X** | Only if you already post there. Do not open a new account for launch week |
| **Pinterest** | Fine later for “habit tracker” and “Diwali reminder” images. Not a launch-day job |
| **Telegram** | Only groups you already use. Same rule as WhatsApp: one clip, then stop |
| **TikTok** | Out of this launch |
| **Other app stores, APK sites** | Play first. Indus after that. Nowhere else |
| **Paid ads** | Day 2 at the earliest, and only after a clean install on a phone that has never had the app. About $10 a day each on a Google app campaign and on Instagram/Facebook, India, Hindi and English, installs only. Wording stays on habits, reminders, and family dates. Stop a channel if cost per install goes above about $0.50 or day-1 return is below about 20% |
| **Influencer Reels** | Only after a paid channel clears the week-2 gates (LAUNCH.md). Shortlist now (P15-05), book later. Five to eight creators in yoga, walking, or family routines, about 10,000 to 50,000 followers, comments that look real |

## E. Bios, once, before the first post

Use the same line everywhere so a person who sees you on two sites recognizes it.

**Name:** Resuming

**Bio (English):** Missed a day? Just resume. A free daily list for habits, health and reminders. No ads. Android and the web.

**Bio (Hindi), Instagram alternate or Facebook about:** एक दिन छूट गया? फिर से शुरू करें। आदतें, सेहत और याद दिलाने के लिए एक मुफ़्त ऐप। कोई विज्ञापन नहीं।

**Link in bio:** `https://resuming.app` (the site routes people to Play or the browser). **Only set this once the Play page loads for a signed-out browser.** Until then, put `https://resuming.me/start` in the bio. See Part 5, problem A2: the site's Play buttons are already switched on.

**YouTube channel description:** the English bio, then “Google Play:” and the YouTube tagged link, then “In a browser: https://resuming.me/start”. Upload `play-listing/social/youtube-banner-2560x1440.png` as the banner and `play-listing/social/profile-1080.png` as the picture. Facebook cover: `play-listing/social/facebook-cover-1640x624.png`.

---

# Part 3 — Step 2: What to publish

Four themes. Every post is one of these. Do not invent a fifth for launch week.

1. **Restart.** A missed day is not a failure. Two minutes still counts.
2. **Follow along.** Kapalabhati, Anulom Vilom, Bhramari, or Heartfulness, with the video inside the habit.
3. **Family dates.** A wedding, a puja, a doctor visit, a bill. Photo on the reminder. One WhatsApp link, and each person adds it.
4. **The day itself.** One Today list: walk, water, BP, the bill. This is the product demo.

Diwali is 8 Nov 2026. That is a theme-3 post in week 3 (share the date, add it from the community calendar under Reminders), not the launch post. Check on the 1.0.5 build that Diwali shows in that list before you film it.

## What to record this week

You need four vertical clips, 1080×1920, captions burned in, 12–20 seconds, no voice required. Music low or off. Record the English app and the Hindi app.

| Clip | What is on screen | Caption |
|------|-------------------|---------|
| **R1 Restart** | A habit that was quiet yesterday. Tap Resume | Missed a day? Just resume. |
| **R2 Today** | Today list. Tick water, then a walk | Small things. Every day. |
| **R3 Follow along** | Start Kapalabhati. The video plays with the timer | Five minutes. Follow along. |
| **R4 Share** | Open a reminder that has an invitation photo. Tap Share. WhatsApp opens | Share a date. Family adds it in one tap. |

Hindi captions:

| Clip | Caption |
|------|---------|
| R1 | एक दिन छूट गया? फिर से शुरू करें। |
| R2 | छोटी-छोटी आदतें। हर दिन। |
| R3 | पाँच मिनट। वीडियो के साथ। |
| R4 | तारीख शेयर करें। परिवार एक टैप में जोड़ ले। |

Stills, if a clip is not ready: the six files in `play-listing/screenshots/`, in that order. One line on the image is enough. Do not cover the screen with text.

## First 14 days

Launch day is the day a signed-out phone can open the Play page. Not the day you submit the release.

| Day | Instagram | Facebook | YouTube | Also |
|-----|-----------|----------|---------|------|
| **0. Launch** | Hindi Reel, R1. Story with the Play link sticker | Page: English launch post with R2 or the screenshot carousel. Then the Hindi post. Two or three groups, R1, only where rules allow | Hindi Short, R1. Description has the Play link and resuming.app | WhatsApp Status (R1) and two groups you actually use. LinkedIn founder note. Medium article 1 if it is written |
| **1** | English Reel, R2. Three stories: screenshot, “free, no ads”, link | Reply to comments. One more group, different city or language from day 0 | English Short, R2 | Start Quora answer 1 (English) |
| **2** | Reel R3, Hindi. Story: “your own YouTube video works too” | Page post: follow along, R3 | Short R3, Hindi, if the English one already has the pinned comment | Ads only if day-0 and day-1 installs opened the app cleanly |
| **3** | Carousel, six screenshots, English captions from the listing | Share the carousel to the page. Skip groups today | Community post or a comment on your own Short, asking what people keep forgetting | Quora answer 2 (Hindi) |
| **4** | Reel R4, Hindi. Story of the shared-link page | Page post: wedding or doctor visit, R4. One society or family-style group | Short R4 | — |
| **5** | Restories the best Reel. Reply to every comment in a Story | Reply. Do not post a new pitch | Pin the best Short. Reply to comments | Product Hunt, Peerlist, or Indie Hackers — one of these, the build story |
| **6** | English carousel: “What goes on Today” (walk, water, Pranayam, BP, bill) | Same carousel, shorter caption | — | Dev.to or Hashnode, canonical set to Medium |
| **7** | One photo card: “A missed day is just a day.” No feature list | Same card, Hindi caption | — | Look at Play reviews. Reply to all of them. Note which clip got taps |
| **8–10** | One Reel a day, repeating the theme that was watched. New caption, same clip is fine | One page post every other day. Groups only if someone asked a question | One Short every other day | r/androidapps once, if you have not posted there |
| **11–14** | One carousel (how Resume works) and two Reels | One Hindi page post, one English | The Hindi and English Shorts that are still missing from R1–R4 | Hindi Play listing. Outline article 2 |

After the first 14 days, if you are still posting: four Instagram Reels a week, stories on the other days, one carousel a week, three YouTube Shorts a week. One new article a week, Hindi versions of articles 1 and 2 first.

---

## Instagram — @resumingme

**Format.** Reels are the posts that get shown to new people. Carousels explain. Stories are for people who already follow, and for the link sticker. Feed photos alone will not travel.

**Size.** Reel and Story 1080×1920. Carousel 1080×1350 or the Play screenshots as they are. Captions on the video, large, high on the frame so the buttons do not cover them. Assume the sound is off.

**Cadence.** Launch week: one Reel most days, stories daily, one carousel. Then four Reels and one carousel a week.

**Hashtags.** Three to five, at the end. Do not use a block of thirty.

`#habittracker` `#androidapp` `#missedaday` `#प्रणायाम` `#आदत`

Swap in `#walk` `#reminder` `#दिवाली` only when that post is actually about it.

### Reel captions you can paste

**R1, Hindi (launch)**

एक दिन छूट गया?

ज़्यादातर habit apps उस दिन आपको हार मानने पर मजबूर करते हैं। Resuming में streak नहीं टूटती। Resume दबाइए और छोटी सी शुरुआत फिर से कीजिए। दो मिनट भी गिने जाते हैं।

मुफ़्त। कोई विज्ञापन नहीं। Android पर Google Play, या browser में resuming.me

**R2, English**

One list for the day.

A short walk. Water. Five minutes of breathing. The electricity bill. Tick them off on a screen called Today.

Missed yesterday? That still counts. Just resume.

Free on Google Play. No ads. Also works in the browser at resuming.me

**R3, Hindi**

कपालभाति, अनुलोम विलोम या भ्रामरी।

habit खोलिए, वीडियो साथ में चलता है, टाइमर साथ में शुरू होता है। अपना YouTube वीडियो भी लगा सकते हैं।

यह मेडिकल सलाह नहीं है। सिर्फ़ साथ में करने के लिए।

**R4, English**

A wedding, a puja, a doctor’s visit.

Put the card’s photo on the reminder. Share one link on WhatsApp. Each person adds it to their own Today list. If it is cancelled, they see that too.

Your email and phone number are not on the link. Only the “From” line you type.

### Carousel — “What goes on Today” (day 6)

Six slides, one idea each. Use the screenshots.

1. One list for your whole day
2. Small steps count. Two minutes is enough
3. Blood pressure, weight, and water. Not medical advice
4. Bills, visits, birthdays: never forget
5. A shared event, on their phone
6. Free. No ads. English, हिन्दी, ગુજરાતી, मराठी, తెలుగు, தமிழ், বাংলা

Caption: “Today holds the walk, the water, the BP reading, and the bill. Missed a day? Just resume.”

### Stories

Three frames is enough. Frame 1 the clip, frame 2 one line (“Free. No ads.”), frame 3 the link sticker to the Instagram tagged Play link. Do not put a link in the only frame. People tap past it.

## Facebook — the page, then groups

**The page** is the durable post. Write it as if the reader has never seen Instagram.

**Launch post, English**

Most habit apps make the day you miss feel like a failure.

Resuming does not. There is no streak to break. You keep a short list — a walk, water, a few minutes of Pranayam, your BP, the family’s dates — and when a day gets skipped, you tap Resume and start smaller. That still counts.

It is free, there are no ads, and it runs in English, Hindi, Gujarati, Marathi, Telugu, Tamil and Bengali.

Android: [Play link, source facebook, medium post]
Browser, no account needed to try: https://resuming.me/start

Resuming is a habit and reminder app. It does not give medical advice.

**Launch post, Hindi** (a few hours later, not a duplicate of the English post in the same hour)

आदत का एक दिन छूट जाए, तो अक्सर लगता है कि सब फिर से शुरू करना पड़ेगा।

Resuming में ऐसा नहीं है। streak नहीं टूटती। सैर, पानी, कुछ मिनट प्राणायाम, BP, और घर की तारीखें — एक ही Today लिस्ट पर। दिन छूट जाए तो Resume दबाइए। छोटी शुरुआत भी गिनी जाती है।

मुफ़्त। कोई विज्ञापन नहीं।

Android: [same facebook post link]
Browser: https://resuming.me/start

यह मेडिकल सलाह नहीं है।

**Groups.** Two or three on launch day, not twenty. Yoga and Pranayam groups get R3. Walking groups get R2. Society, family, and festival groups get R4. Senior groups get a still of Today plus two lines, because a Reel is easy to miss.

Group text, keep it personal:

“I made a small Android app for the days I skip. It does not scold you. You tick a walk or a few minutes of breathing, and if you miss a day you just resume. Sharing a family date on WhatsApp is in there too. Happy to hear if it is useful: [link]”

Then stop. Answer replies. Do not post the same text in the same group again.

## YouTube — @resumingme

**Launch week is Shorts only.** One Short per clip R1–R4, Hindi first. Title under 50 characters. The first line of the title is the caption from the clip.

| Short | Title |
|-------|--------|
| R1 Hindi | एक दिन छूट गया? फिर से शुरू करें |
| R2 English | One list for your whole day |
| R3 Hindi | प्राणायाम, ऐप के अंदर वीडियो के साथ |
| R4 English | Share a wedding reminder on WhatsApp |

**Description (every Short):**

Resuming is a free daily list for habits, health numbers and reminders. Missed a day? Just resume. No streak to break. No ads.

Google Play: [youtube tagged link]
Try it in a browser: https://resuming.me/start
https://resuming.app

Not medical advice.

**Pinned comment:** “Free on Google Play. The link is in the description.”

Mark the channel and each video **not made for kids**. Add the English or Hindi captions file as well as the burned-in words, when you have it.

**Longer videos, after the Shorts exist.** Do not block launch on these.

1. The 75-second explainer, English and Hindi. Script is in `docs/PHASE-14.md` (Video 2). This is also the Play promo video.
2. “How to restart a habit after you miss a day.” Five to eight minutes. Screen recording of Resume, you talking over it. No health claims.
3. “How to share a wedding or a doctor visit on WhatsApp.” The R4 flow, slower, on two phones.

One longer video every two weeks is enough. Shorts stay the weekly habit.

## WhatsApp

**Status.** R1, 15 seconds, the line “Missed a day? Just resume.”, and the status tagged link. Hindi status later the same day. Status disappears, so this is the launch-day version of the Reel, for people who will not see Instagram.

**Groups.** Only groups where you are a real member. One message. The personal Facebook-group text above is the right length. If the group forbids links, send the clip with “search Resuming on Google Play” and stop.

Do not forward the same message into groups you are not part of.

## Medium — the articles

Write in a normal speaking voice. 700–1,000 words. End with the Medium tagged Play link and https://resuming.me/start. No keyword stuffing. Publish article 1 on launch day if it is done. If it is not, post everywhere else and publish it the same week.

Set the canonical URL to the Medium post itself for now. When `resuming.app/blog` exists, move the article and point Medium’s canonical link at the site.

### Article 1 — Missed a day? Why restarting is the real skill

**Who it is for.** Someone who has dropped a habit and feels they have to start over. This is the post you link from Quora.

**Shape**

1. Open on a specific skipped day. A walk that did not happen, or a week of Pranayam that went quiet. Do not invent a dramatic failure.
2. What most apps do next: they show a broken streak, and the next session feels like day one of a punishment.
3. The actual skill is the restart. Two minutes counts. The days you already did are still there.
4. How Resuming behaves: no streak to lose, a smaller step after a quiet stretch, the minutes from earlier sessions still on that habit.
5. Close with who it is for (a person who will miss days, which is most people) and the two links.

**Hindi.** Same article, not a word-for-word translation of the jokes. Title: “एक दिन छूट गया? असली आदत फिर से शुरू करना है।” Publish as its own Medium story in Hindi.

### Article 2 — A habit app for Indian families

**When.** Week 2.

**Shape.** Seven languages, by name. One Today list that holds a walk, water, BP, and a bill. Free, no ads, data not sold, steps stay on the phone. The WhatsApp share in one paragraph, not the whole article. End on the same links. Hindi version the week after.

### Article 3 — How to share a wedding or a doctor visit on WhatsApp

**When.** The week you have two phones to screenshot. This is a how-to, so it can be shorter.

**Shape.** Create the reminder, add the invitation photo, tap Share, send to the family group, the other person taps Add, the date is on their Today list. Say what the other person does not see: your email and your phone number. Mention cancel: if you cancel it, people who added it see that. End on the links.

### The build story — for Dev.to, Hashnode, Indie Hackers, Peerlist

**When.** One afternoon on days 3 to 5. Write it once. Paste it in each place with a new opening line, and set canonical to the Medium copy if you also put it on Medium. If it only lives on Dev.to, canonical is the Dev.to URL, and Hashnode points at it.

**Shape.** What you were trying to track (postponed habits, not a perfect streak). What you refused to copy from other apps (guilt, a broken streak, ads). What is actually in 1.0: Today, Resume, reminders with a photo, WhatsApp share, seven languages, Health Connect steps that never leave the phone. What you left out on purpose. What you want feedback on. The Play link once, near the end, not in the first sentence.

**r/developersIndia.** Read the current self-promotion rules before posting. If they want a comment in a weekly thread instead of a new post, do that. Lead with the technical choice (one Today list, resume instead of streaks, no third-party ad SDK), not “please install.”

**r/androidapps.** Different post. Two paragraphs on what the app does for a person, the six screenshots, the Play link. No build diary.

## LinkedIn — founder note, launch day

Post this from your personal profile. The company page can share it. Fill the bracket with one true sentence from you. Do not invent a backstory.

I got tired of habit apps that treat a missed day as a failure.

So I built Resuming. It is one daily list: a walk, water, a few minutes of Pranayam, blood pressure, and the dates a family actually has to remember. If you skip a day, nothing breaks. You tap Resume and start smaller. That still counts.

[One sentence on why you made it. A habit you kept dropping is enough.]

It is free, there are no ads, and the Android app is on Google Play today. It also works in the browser.

[linkedin tagged link]
https://resuming.me/start

It does not give medical advice. It helps you keep a log and remember things.

## Quora

Search these and answer two of them in week 1. Prefer a question that already has answers, so you are not talking to an empty page.

- How do I restart a habit after missing several days?
- What is a simple habit tracker that does not use streaks?
- How can I remind my family about a wedding or a doctor visit?
- आदत छूट जाए तो फिर से कैसे शुरू करें?

**English answer (about 180 words)**

Restart smaller than you planned, on the same day you remember. If the habit was a thirty-minute walk, go for ten, or even to the end of the road. The point is to do it once so the next day is not “day one after a long gap.”

A few things that make the restart harder than it needs to be:

- An app that shows a broken streak. The number is what you look at, instead of the walk.
- Starting again at the full target. That is why the second try dies on day two.
- Keeping the habit in a different app from the rest of the day, so you only open it when you feel motivated.

I built a small app, Resuming, around the opposite idea. There is no streak to lose. After a few quiet days it suggests a smaller step, and the days you already showed up still count. The same list holds a walk, water, a short breathing practice, and reminders like a bill or a doctor’s visit.

If you want the longer version of this, I wrote it up here: [Medium article 1]. The app is free on Google Play and in the browser at resuming.me.

**Hindi answer.** Same three points, in Hindi, 150–250 words. Link the Hindi Medium article. If the Hindi article is not up yet, link the English one and say it is in English.

Do not paste the answer under ten questions in one day. Two a week is the pace that still looks like a person.

## Product Hunt

**When.** Days 3 to 5, after one real Play review.

**Tagline (60 characters):** Missed a day? Just resume. Habits, health, reminders.

**Description.** Four short paragraphs:

1. Habit apps punish the day you miss. Resuming does not keep a streak.
2. One Today list: walk, water, Pranayam with a follow-along video, BP, weight, steps on Android, and reminders.
3. Share a wedding or a puja on WhatsApp. Family adds it in one tap. Seven languages. Free, no ads.
4. Android on Google Play. Browser at resuming.me, no account needed to try.

Gallery: the six screenshots, in file order. First comment from you: how Resume works, in three sentences, plus the producthunt tagged link. Reply to every comment that day.

## Google Play listing

The store page is the post everyone lands on. Do not rewrite it for each channel.

- Name: `Resuming: Habits & Reminders`
- Short description: `Track your day, gently. Missed a day? Just resume.`
- Full description: `play-listing/listing-en.md`
- Feature graphic: `play-listing/feature-graphic.png`
- Screenshots: `play-listing/screenshots/` in numbered order

Hindi title, short description, full description, and release notes in week 1. English screenshots can stay until Hindi ones exist.

Reply to every review and every public comment the same day. A one-star review gets a fix or a plain explanation, not a defence.

## Paid posts, only after the free ones are live

Day 2 at the earliest. The budget split, the gates and the task details are under Milestone 3 in Part 4.

| Campaign | Who sees it | Creative | Words on the ad |
|----------|-------------|----------|-----------------|
| Google app campaign, India | Hindi and English | R1 and the screenshots | The short description. Installs only |
| Instagram and Facebook, India | Adults roughly 30 to 60 | R1 Hindi, then R4, then R2 | “Missed a day? Just resume.” and “A wedding or a doctor visit, shared on WhatsApp.” |

Meta restricts ads that imply you know something about a person’s health (“Is your BP high?”, “Struggling with sleep?”). Keep ad copy on habits, reminders, and family dates. BP and weight can appear in a screenshot, not in the headline. Each ad has its own `utm_source` (`google` and `meta`). No `utm_campaign`. About $10 a day each. After about $50 on a channel, check cost per install and day-1 return before spending more. The gates are in `docs/LAUNCH.md`.

---

## What you can finish before the listing is public

The posts wait. The preparation does not.

1. Bios and pictures on Facebook, Instagram, and YouTube.
2. Record R1–R4 in English and Hindi, or at least R1 and R2.
3. Write the English launch posts above into drafts. Schedule nothing. Publish when the Play page loads for a signed-out phone.
4. Draft Medium article 1 and the LinkedIn note, with the bracket filled in.
5. List ten groups you are actually in, and which clip each one gets. Drop any group whose rules forbid apps.
6. Install the 1.0.5 build from closed testing on a phone that is not your daily one. Sign in, open a shared WhatsApp link, switch Today to Hindi. On launch day, do it once more from the public link on a phone that has never had the app. Then post.

---

# Part 4 — Task plan

The tasks below keep their Phase 15 numbers. M1 can be done now, while Google reviews production access. M3 starts only after the listing is public. Phase 14's videos and site feed this plan, and M1 does not wait for the site.

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

M1 can be done now, while Google reviews production access. M3 starts only after the listing is public. Phase 14's videos and site feed this plan, and M1 does not wait for the site.

## Milestone 1 — Ready (now, while Google reviews)

### P15-01 — Play listing in seven languages

- Translate the title, short description, full description, and release notes into Hindi, Gujarati, Marathi, Telugu, Tamil and Bengali, with the English as the base (`play-listing/listing-en.md`).
- Screenshots in English and Hindi at least, with captions in the listing language where possible.
- Keep every line to features that ship. No health claims.
- Use the words people search for in the first two lines of the full description, in English and Hindi: habit tracker, reminders, pranayam timer, BP log, bill reminder, and their Hindi forms (`marketing.md`, B4). Check Play Console's search-terms report after a week.
- Done when the listing reads naturally in each language, checked by a native speaker, and the Play Console preview shows no missing fields.

### P15-02 — Tracking links per channel

- A Play Store link for each channel (Facebook groups, WhatsApp, Reddit, Quora, Instagram, YouTube, each paid campaign, each influencer) with its own source tag, so Play Console shows where installs come from. Referral groups already have their own links from `/admin/groups` (`marketingInstallLink`), so use those for people who are paid per install and tags for everything else.
- The "Get it on Google Play" button on shared event pages carries its own tag, so the sharing loop can be counted.
- Done when a test click from each link shows up under its own source in Play Console.

### P15-03 — Creative pack

- Cut the Phase 14 videos into 6 to 15 second pieces for Reels and Shorts. Vertical, captions on, English and Hindi first.
- About ten shareable image cards, sized for WhatsApp status and Instagram. One line and the logo, such as "Missed a day? Just resume."
- A press kit page or folder: logo, screenshots, one paragraph, the founder note.
- Done when each cut and card exists in English and Hindi and passes the rules in Part 1 (nothing unshipped, no health claims).

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

- Apply for production access (day 14 of the test was 14 Oct, so it can be done now). Review can take a few days, so ads wait until the listing is public. The order is: apply, put 1.0.5 on closed testing, and after approval create the production release (`docs/LAUNCH.md`).
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

- **Set the numbers** on each group: ₹20 per five-day return, no install rate, a ₹20,000 cap, and a minimum of 500 five-day people (decision 7). The new-group form defaults to these. The goal is only displayed and does not stop pay, so the cap is what limits spending. The column `min_payout_installs` now holds the five-day minimum.
- **Close the fake-install hole (checks built 13 Oct 2026, not yet deployed).** `marketing_record_open` is open to anyone (`anon`) and trusts what the phone sends. The member code is visible in the Play link, so a script could send unlimited fake device keys and, over five days, make them count as returned. Until installs are verified with Play Integrity, pay only through these checks, all on the group page in `/admin/groups` under "Before you pay" (migration `20261021120000_marketing_pay_checks.sql`):
  1. **Check Google Play.** Type in the installs Play Console shows for the group's source tag. The page shows "Safe to pay now", based on the lower of our count and Google's, and warns when ours is at least 20% (and at least 10) higher.
  2. **Wait.** Only installs whose 30 days ended at least 7 days ago count as payable. Members are told this on their own page.
  3. **Look at the flags.** A day with at least 25 installs and at least five times the member's usual day, or at least 70% of 20 or more closed installs opening on five days. A flag is a reason to ask the member what they posted, not proof.
  Pay the "Safe to pay now" figure, not the "Earned" one. `supabase/scripts/test_marketing_pay_checks.sql` keeps the rules under test.
  The pay checks and flags now count a retained person as an account with five days (15 Oct 2026, migration `20261027120000_marketing_retained_accounts.sql`). The same script tests the account link, the one-account-one-install rule and what deletion does.
  **Still to build before paying at scale:** a server function that checks Google's Play Integrity token, so only real installs of the real app count. It needs a Google Cloud setup, an Edge Function and a new app release.
- **Say it in the privacy policy and Data safety form.** The app stores a hash of the device's Android ID and reads Google's install referrer (`InstallReferrerPlugin.java`). The policy mentions neither, and `release-1.0.4.md` mentions an anonymous device ID only for shared events. The policy also does not mention the in-app usage events (the `events` table: event name, a per-device anonymous id, page, app version, platform). It names only page views. List all three.
- **Data retention and deletion (checked on 12 Oct 2026).** The policy says data is kept while an account is active and gives no period. What the code and database do today:
  - **Nothing expires.** The database has no scheduled cleanup jobs. Inactive accounts are never removed. Usage events (about 6,600 rows), page views (about 4,100) and install records (about 610) are kept indefinitely.
  - **Account deletion** (the `delete-account` function) removes the profile, habits, logs, vitals, medicines, reminders, shared events, the medicine, reminder and event photos, feedback and page views.
  - **Account deletion leaves these behind.** Usage events keep their rows with only the user id blanked, and each still carries the anonymous device id. Install records (`marketing_installs`) hold a hashed device id and the referral group, were not linked to an account at the time, and were never touched. (Since 15 Oct 2026 they carry an account link, and deleting the account removes it.) The policy's "deleting your account removes it" is slightly too strong for these two.
  - **Export** leaves out medicines (the policy says so). Backups: the project is on the Pro plan, which keeps daily backups for 7 days, and the policy now says deleted data can remain in backups for up to 7 days (13 Oct 2026).
  - **To do:** (1) delete a user's usage events when their account is deleted, or say in the policy that they are kept anonymously. (2) Say in the policy what happens to install records. (3) Pick and state a plain period for events, page views and install records, for example 13 months, and add a scheduled cleanup to match. (4) Look up the backup period on the Supabase plan and put it in the policy. (5) Move the "Last updated" date.
  - **Decision (13 Oct 2026).** Build (1) to (3) with a period of 13 months. Written and tested, **not yet deployed**:
    - `supabase/migrations/20261019120000_data_retention.sql` adds `erase_user_usage` (deletes a deleted account's events, including those its device sent before sign-in, and takes the email off any referral seat) and `enforce_data_retention` (daily at 03:30 UTC through pg_cron: deletes events and page views older than 13 months, and replaces the device id of install records older than 13 months with a random value so the totals stay).
    - The `delete-account` function calls `erase_user_usage` before deleting the user.
    - Install records were not linked to an account when this was written, so account deletion could not find them. The 13-month rule removes the device id. Since 15 Oct 2026 they hold an account link (for the retained count), and `erase_user_usage` removes it on deletion. The policy says so.
    - The policy has a new "usage data" paragraph in the Retention section (three copies).
    - Tried in a rolled-back transaction on production: events, page views and installs behaved as above, and anon and signed-in users cannot run either function. At the moment nothing is older than 13 months, so the first run deletes nothing.
    - To go live: apply the migration, deploy `delete-account`, then deploy the app so the policy matches.
- **Fix the analytics limit (built 13 Oct 2026, not yet deployed).** The Analytics screen downloaded event rows and counted them in the browser. The API returns at most 1,000 rows per request (`max_rows` in `supabase/config.toml`), so the `.limit(5000)` and `.limit(8000)` calls were really cut at 1,000, oldest first. The comeback loop and cohorts were already affected, with 3,534 `app_opened` events in 90 days. Now the onboarding funnel, guest journey and creates, reminders and shared events, and the comeback loop and signup-week cohorts are counted in the database (`onboarding_funnel_summary`, `guest_journey_summary`, `reminder_analytics_summary`, `loop_analytics_summary`, migration `20261020120000_analytics_summaries.sql`). The page-view and website cards still count in the browser, but now read every page of rows and show an error above 100,000 rows instead of a partial number. Checked: the old browser code and the new SQL gave the same numbers on the 6,900 production events from the last 95 days, and `supabase/scripts/test_analytics_summaries.sql` keeps the rules under test. One deliberate change: a person who signed up twice now counts once in the signup-week cohorts (before, each sign-up event counted, so 8 people showed as 18). Next step if traffic grows: move the page-view and website counts into the database too.
- **Smaller:** the app version is fixed at `0.1.0` in `track.ts`, so versions cannot be compared. Add tests for the database function and for abuse cases.
- Done when a test group shows correct numbers after a scripted fake install is rejected or flagged, the policy and Data safety form match what the app stores, the policy's retention section matches what the database does (including what account deletion leaves behind), and the Analytics screen still shows the latest events when a window holds more than 5,000 of them.

## Launch-day checklist

The working lists, with the release order and the pay checks, are in [LAUNCH.md](./LAUNCH.md). The short list below is the same shape.

**Before launch day**
1. Set the referral group numbers and fix P15-15.
2. Add the privacy-policy and Data safety lines.
3. Finish the Play listing in English and Hindi at least.
4. Finish the pending release steps: push the commits, deploy `delete-account`, deploy the website, and build the release app.
5. Apply for production access now, and put 1.0.5 on closed testing while Google reviews. Review can take a few days.

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
| Now, while Google reviews | Apply for production access (P15-06). M1: listing, tracking links, creative pack, articles, influencer shortlist, referral groups ready to pay (P15-15). No ads until live |
| Launch week | Free posting (P15-07). Credibility channels (P15-08), with Product Hunt on day 3 to 5. Start the Google and Instagram tests at about $10 a day each |
| Weeks 2 to 3 | Read the numbers against the gates. Move money to the best channel. Influencer Reels go live |
| Weeks 4 to 8 | Content cadence (P15-14), one article a week, and fix onboarding from the day-7 and day-30 numbers |

---

# Part 5 — Launch risks and gaps

A second pass over the plan, checked against the repo (`marketing/src/site.ts`, `docs/LAUNCH.md`, the app source). It lists the problems to fix before you post and the things the plan had not covered. The ideas that came out of the same review are in [newIdeas.md](./newIdeas.md). Each problem here has a matching checkbox in `docs/LAUNCH.md`.

## A. Problems to fix before you post

1. **The launch may not be in 2–3 days.** Google’s production review can take a few days after you apply, and LAUNCH.md says exactly that. Do not plan around a date you do not control. The web app is live now, so run a **web-first soft launch today** (LinkedIn, Quora, a Facebook Page post, a WhatsApp Status that links to `https://resuming.me/start`). Hold every “Get it on Google Play” post for the day the public page loads. The first Android posts then become a second announcement, which is fine: “Now on Android.”

2. **The site’s Play buttons are already on.** `PLAY_LIVE = true` in `marketing/src/site.ts`, and the comment beside it says the links land on “not found” until the listing is public. If the live site was deployed with that value, anyone who taps Play on resuming.app today hits a dead page. Before sending any traffic to resuming.app, or putting it in a bio, either confirm the listing is public or set `PLAY_LIVE = false` and redeploy (`cd marketing && npm run deploy`), then flip it back on launch day. The first plan put resuming.app in every bio. That is fixed above, but check it.

3. **The plan is too big for one person on day 0.** Do this minimum, and treat the rest of the calendar as optional:
   1. Install on a clean phone and check it works (LAUNCH.md).
   2. One Hindi Reel (R1), posted as an Instagram Reel, a Facebook Reel and a YouTube Short from the same file.
   3. WhatsApp Status and two groups you really belong to.
   4. One Facebook Page post.
   5. The LinkedIn note.
   Everything else can slip a day without costing you anything.

4. **Web is underserved.** You said Android and web. The plan treats web as a fallback link. Web needs its own posts:
   - **iPhone and desktop people have no Play button.** They get `https://resuming.me/start`. Give them a 15-second clip of “Share → Add to Home Screen” on iPhone (the app has an iOS tip, and a PWA manifest). Without it, iPhone users try once and lose the tab.
   - **Guests keep their list for 7 days** (site FAQ). Web posts should end “sign in with Google to keep it,” not only “try it, no account.” Otherwise the best web users lose their data and never come back.
   - **Tag the web links too.** The app’s home page reads `utm_source` from its own address (PHASE-9). Use `https://resuming.me/?utm_source=linkedin&utm_medium=post` for web posts, and check in the admin Analytics screen that it shows. Same rule as Play: never add `utm_campaign`. Confirm `/start` reads the tag as well. If not, use the home page link.
   - Web audiences are different: LinkedIn, Product Hunt, Indie Hackers, Reddit, and Quora lean toward web. Android audiences are Instagram, WhatsApp, Facebook groups, YouTube. Do not send a builder to a Play button or a grandmother to a browser tab.

5. **There is no in-app review prompt in the code yet.** I searched the source: nothing calls Play’s in-app review API. Task P15-12 plans it. The success target is 25 reviews at 4.5 or better in the first month. Without a prompt, only angry people leave reviews. Either ship the prompt (after the third day someone logs something, not on first open) or ask by hand, see B3 below. Never offer anything in return for a review. Play forbids that, and a referral member must not do it either.

6. **Referral-group members need a kit.** The plan mentions their links and nothing else. They post for money per five-day return, so what they post is on you. Give each one: the clips, one paste-ready caption in their language, the line “free, no ads, not medical advice”, and the rules (no fake installs, no asking for reviews, no health claims, no spam in groups that forbid it). Tell them posts that break the rules are not paid. The spike flags in `/admin/groups` will show you who needs a call.

7. **Disclosure for paid creators.** Use the platform’s paid-partnership label and “#ad” or “#sponsored” in the caption. India’s ASCI guidelines expect this. The rules in Part 1 already require a label. Keep it in every creator brief.

8. **Use one video file on three platforms.** Export once, 1080×1920, captions burned in, no watermark. Instagram can cross-post the Reel to the Facebook Page automatically. Upload the same file to YouTube Shorts. This turns three posts into one afternoon of work.

9. **Small wording fixes.**
   - “Pranayam”, “Kapalabhati”, “Anulom Vilom”, “Bhramari” and “Heartfulness” are feature names in the app. Do not suggest the app is endorsed by, or partnered with, any teacher or organization unless it is.
   - R3’s caption says “यह मेडिकल सलाह नहीं है।” Keep that line on any post that names a breathing practice or a vital.
   - `#missedaday` is not a tag anyone searches. Prefer `#habittracker`, `#हिंदी`, and one tag per post that matches its topic.

## B. Things the plan did not cover

### B1. Pre-launch (the 24–48 hours before the page is public)

- Only if the date is certain: one Story and one Status, “Android launch tomorrow.” Do not tease a date Google may move.
- If the date is not certain, post nothing about Android. Use the web-first soft launch in A1 above.
- Draft every caption now. Put the final tagged links in one note on your phone so launch day is copy and paste.

### B2. Launch-day tracking and a bad-day plan

Keep one sheet, one row per hour for the first six hours, then a row per day for two weeks.

| Column | Where it comes from |
|--------|---------------------|
| Installs by `utm_source` | Play Console, Acquisition |
| Web visits by source | Admin Analytics screen |
| Day-1 and day-7 return | Admin Analytics screen |
| Crashes and ANRs | Play Console, Android vitals |
| New reviews, replied? | Play Console |
| Posts live, comments unanswered | Your own list |

If there is a crash on first open or on sign-in, **stop posting and stop ads** until a fix is in review (LAUNCH.md says the same about ads). A bad first week is hard to undo. Say publicly, in one line, that you are on it.

### B3. Honest early reviews

Message the people who tested the app, friends, and the closed-test group once the page is public:

> It is live on Google Play. If the app was useful to you, an honest review helps a lot, whatever the stars. If something annoyed you, tell me at resuming.me@gmail.com first. Link: [Play link, source `friends`, medium `message`]

Ask only people who really used it. Do not ask for five stars. Do not offer anything. Send it one person at a time, not as a broadcast, and ask once.

**Review replies, short and plain.**

- Five stars: “Thank you. If you ever skip a day, just resume.”
- Bug report: “Sorry about that. Which phone and Android version? Write to resuming.me@gmail.com and I will look today.”
- Feature request: “Noted. I read every one. This one is [on the list / not planned yet, here is why].”
- One star with no text: “Sorry it did not work for you. If you tell me what went wrong, I will try to fix it.”

### B4. Play store keywords (ASO)

The listing text above is written for a person. The words in it also decide whether Play shows it. Use these naturally, in the first two lines of the full description and in the Hindi listing. Do not stuff them.

| English | Hindi |
|---------|-------|
| habit tracker, daily habits, reminders, missed a day | आदत ट्रैकर, रोज़ की आदतें, रिमाइंडर |
| pranayam timer, kapalabhati, anulom vilom | प्राणायाम टाइमर, कपालभाति, अनुलोम विलोम |
| BP log, weight log, steps | बीपी रिकॉर्ड, वज़न, कदम |
| bill reminder, birthday reminder, festival reminder | बिल रिमाइंडर, जन्मदिन, त्योहार |

Check what Play Console’s search-terms report shows after a week, and adjust.

### B5. Press kit folder

Task P15-03 asks for one. Put these in a shared folder, and link it from the LinkedIn post and from anything sent to a creator or a journalist:

- Logo (`play-listing/icon-512.png`) and the banner images in `play-listing/social/`.
- The six screenshots and the feature graphic.
- One paragraph about the app, one about why you built it, and your photo.
- The two links (Play and `resuming.me/start`) and the contact email.

## C. What to do this afternoon

In order, about three hours. The Play steps come first because Google’s review is the only part you cannot speed up.

1. Do the “Today” list in `docs/LAUNCH.md`: apply for production, put 1.0.5 on closed testing, refresh the listing screenshots and description.
2. Open the live resuming.app on a signed-out phone and see what a visitor sees today (A2), then decide whether to set `PLAY_LIVE` to false until the listing is public.
3. Record R1 and R2 in Hindi. That is enough to launch.
4. Write the three captions you will actually post (Instagram Hindi, Facebook English, LinkedIn).
5. Message ten group admins and ten organizers (ideas 1 and 2 in [newIdeas.md](./newIdeas.md)). They answer in hours or days, not minutes, so ask first.
6. Create the tracking sheet (B2).
7. Put the web-first soft launch posts on the schedule for tomorrow, so something goes out even if Google is late.

---

# Out of scope

- Medicine reminders, widgets, circles, and any other unshipped feature in public material.
- TikTok, APK sharing, and any app store other than Google Play and, after the Play launch, Indus Appstore (decision 3).
- Google's or Meta's code inside the app, to feed their ad platforms (decision 2).
- Paid ads in the other five languages until Hindi and English show a result.
- Any claim about health outcomes.
