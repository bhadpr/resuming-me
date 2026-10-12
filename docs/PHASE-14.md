# Resuming — Phase 14: Marketing site at resuming.app, and launch videos

Goal: resuming.app is a fast, rich, static marketing site that explains Resuming in a minute and sends people to Google Play or to the web app at resuming.me. Two videos carry the story: a short silent loop at the top of the page, and a 75-second explainer in English and Hindi that also becomes the Play Store promo video.

## Where things stand (12 Oct 2026)

| Part | State |
|------|-------|
| resuming.me | The app itself: a React single-page app on Cloudflare (static assets, `wrangler.toml`), with a worker for shared links (`/e/*`). Also serves privacy, terms, delete-account, and `assetlinks.json`. |
| resuming.app | Owned. No site yet. Registrar and DNS to check. |
| Marketing | No marketing site. The Play listing, banners, and six store screenshots exist in `play-listing/`. |
| Brand | Name "Resuming: Habits & Reminders". Tagline "Track your day, gently. Missed a day? Just resume." Clay artwork and themes in the app (`docs/DESIGN.md`). |
| Languages | English, Hindi, Gujarati, Marathi, Telugu, Tamil. |
| Features on Android | Habits (with Pranayam and Heartfulness videos, and an own YouTube video on any habit), vitals (BP, weight, sleep, water), steps from Health Connect, reminders with a description and photo, sharing an event on WhatsApp, six languages. |
| Not on Android | Medicines (web only for now, `MEDICINES_ENABLED`). |

## How to use this file

Four milestones. M1 first. M2 (videos) and M3 (site) can run side by side once M1 is done. M4 is the switch-on. The video scripts are at the end of this file, ready for HeyGen.

## Rules

- **resuming.me stays the app.** Play Console's privacy and delete-account URLs, App Links (`assetlinks.json`), shared event links already sent on WhatsApp, and the sign-in redirect all depend on it. Nothing moves.
- **Show only what ships.** Every screen in the videos and on the site is the real app as released. Medicines are left out while they are web only. Phase 12 and 13 ideas are not shown until they ship.
- **No health claims.** Say what the app does ("log your BP", "follow along"), never what it cures or prevents. Match the "not medical advice" line on the privacy page.
- **The privacy promise is true word for word.** It matches the privacy page: no ads, no selling data, steps stay on the phone.
- **Fast.** The page is readable in under a second on a mid-range Android phone on 4G. The hero video is at most 3 MB with a still poster image, and does not play when the phone asks for reduced motion.
- **Captions on every video.** Many people watch with the sound off.
- **Languages ship in pairs.** English and Hindi first, then Gujarati, Marathi, Telugu, and Tamil.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 Message | P14-01 Audience, message, and page copy | S |
| M2 Videos | P14-02 Screen recordings for the videos | S |
| | P14-03 Make the videos in HeyGen | M |
| | P14-04 YouTube and the Play promo video | S |
| M3 Site | P14-05 resuming.app on Cloudflare | S |
| | P14-06 Astro site in `marketing/` | M |
| | P14-07 Page sections | M |
| | P14-08 Interactive Today card | S |
| | P14-09 Languages | M |
| | P14-10 Search and measurement | S |
| M4 Launch | P14-11 Switch on and link everything | S |

## Milestone 1 — Message

### P14-01 — Audience, message, and page copy

- Main audience: Indian adults of about 30 to 60 who want small daily routines (a walk, water, Pranayam, BP) and who keep the family's dates (bills, doctor visits, weddings, festivals).
- One message: starting again is the skill. Missed a day? Just resume.
- Write the page copy in English, section by section (see P14-07), then Hindi.
- Done when the English and Hindi copy for every section is agreed.

## Milestone 2 — Videos

### P14-02 — Screen recordings for the videos

- Record the real app at phone size, for the scenes listed in the scripts below (B-roll list at the end).
- Use a clean demo account with friendly sample data: Water, Walk, Kapalabhati, BP, and reminders "Riya's wedding" (with an invitation card photo), "Pay electricity bill", "Dr. Mehta checkup".
- Record in English and in Hindi (the app's language setting), so the Hindi video shows a Hindi app.
- Export as MP4, 1080 × 1920 (portrait), 30 fps, a few seconds longer than each scene needs.
- Done when every B-roll item in both languages is recorded.

### P14-03 — Make the videos in HeyGen

- Video 1 (hero loop): no avatar, no voice. Screen recordings with short captions.
- Video 2 (explainer): one presenter avatar with the screen recordings as B-roll, in English and in Hindi. Use the same avatar for both, so the brand has one face.
- Video 3 (vertical short): a 30-second cut of Video 2 for WhatsApp Status, YouTube Shorts, and Instagram Reels, in English and Hindi.
- Burned-in captions on Videos 2 and 3.
- Done when all five files are exported: Video 1, Video 2 English and Hindi, and Video 3 English and Hindi.

### P14-04 — YouTube and the Play promo video

- Upload Video 2 (English and Hindi) and Video 3 to a Resuming YouTube channel. Not marked as made for kids. Captions uploaded as well as burned in.
- Set the English Video 2 as the promo video in Play Console's main store listing.
- Done when the Play listing shows the video.

## Milestone 3 — Site

### P14-05 — resuming.app on Cloudflare

- Move resuming.app's DNS to Cloudflare (and later the registration, as planned for cheerfulgames.com in Phase 11).
- `www.resuming.app` redirects to `resuming.app`. HTTPS is required for `.app`, and Cloudflare provides it.
- Done when `https://resuming.app` serves a placeholder page and `www` redirects.

### P14-06 — Astro site in `marketing/`

- A static site built with Astro in a `marketing/` folder of this repository, with its own build and its own Cloudflare project. The app's build does not change.
- Reuses the app's clay artwork, colours, and fonts. Small interactive parts are React components.
- Done when `marketing/` builds and deploys to resuming.app on its own.

### P14-07 — Page sections

One long page, in this order:

1. **Hero.** The tagline, Video 1 in a phone frame, "Get it on Google Play" and "Try it in your browser" (to `resuming.me/start`), and the language switcher.
2. **How it works.** Three steps: pick a few small things, tick them on Today, missed a day? Resume.
3. **Habits.** Built-in habits with follow-along Pranayam and Heartfulness videos, or any YouTube video of your own.
4. **Reminders.** Bills, doctor visits, weddings, with a photo of the card. Share an event on WhatsApp, and family adds it in one tap.
5. **Vitals and steps.** BP, weight, sleep, water. Steps from Health Connect, kept on the phone.
6. **Your language.** Six languages, shown in their own scripts.
7. **Try it here.** The interactive Today card (P14-08).
8. **Video 2.** Embedded from YouTube, loaded only when tapped.
9. **Privacy promise.** No ads. We don't sell your data. Steps stay on your phone. Link to the privacy page on resuming.me.
10. **FAQ.** Free? Do I need an account? Which phones? Is my data private? What languages? What if I miss a day?
11. **Final call to action** and a footer with privacy, terms, and contact.

- Done when every section is live in English and the page passes the speed rule on a real phone.

### P14-08 — Interactive Today card

- A small Today card on the page with three habits the visitor can tick, and a "missed yesterday" item with a Resume button. It saves nothing and needs no account.
- Done when it works with touch and keyboard, and reads correctly with a screen reader.

### P14-09 — Languages

- Pages at `/` (English), `/hi/`, then `/gu/`, `/mr/`, `/te/`, `/ta/`, each with language tags that tell search engines about the other versions.
- The Play and web app buttons open the app in the same language.
- Done when English and Hindi are live. The other four follow in pairs.

### P14-10 — Search and measurement

- Title, description, and link preview image for every language. A sitemap, and structured data marking Resuming as an app.
- Play links carry campaign tags (`utm_source=resuming.app&utm_medium=website`) so Play Console shows installs from the site. Never add `utm_campaign`: the app reads `utm_source` plus `utm_campaign` as a marketing group's code (`codesFromReferrer`).
- Page views counted with the app's own first-party analytics. No third-party trackers, so no cookie banner is needed.
- Done when the link preview looks right on WhatsApp and the site appears in Google Search Console without errors.

## Milestone 4 — Launch

### P14-11 — Switch on and link everything

- Play Console: set the website field to `https://resuming.app`.
- The app's About page and the site footer on resuming.me link to resuming.app.
- Share the Hindi and English shorts on WhatsApp Status and social media.
- Done when a visitor can go from resuming.app to the Play Store and to the web app in their own language.

## Out of this phase

- A blog or guides (such as "Anulom Vilom for beginners"). Worth doing later for search traffic, with care to avoid health claims.
- Paid ads.
- Testimonials and ratings, until there are real ones to quote.
- An App Store button, until the iOS app ships (Phase 10).

---

## Appendix — Video scripts for HeyGen

Timings are targets. English runs at about 150 words a minute. Scene numbers match the B-roll list at the end.

### Video 1 — Hero loop (20 seconds, silent)

Landscape 16:9, phone frame in the middle, warm cream background matching the app. No avatar, no voice, soft music optional (off on the website). Ends on a frame that loops cleanly into the start.

| Time | Scene (B-roll) | On-screen caption |
|------|----------------|-------------------|
| 0–4 s | B1: Today screen, tick Water, then Walk | Small things. Every day. |
| 4–8 s | B2: Kapalabhati timer starts, video plays beside it | Follow along. |
| 8–12 s | B3: A habit that was quiet yesterday, tap Resume | Missed a day? Just resume. |
| 12–16 s | B4: Reminder with an invitation card photo, tap Share, WhatsApp opens | Share an event in one tap. |
| 16–20 s | Logo on cream | Resuming. Track your day, gently. |

Hindi captions, if a Hindi version of the page uses its own loop:

| Time | Caption |
|------|---------|
| 0–4 s | छोटी-छोटी आदतें। हर दिन। |
| 4–8 s | वीडियो के साथ-साथ करें। |
| 8–12 s | एक दिन छूट गया? फिर से शुरू करें। |
| 12–16 s | एक टैप में WhatsApp पर शेयर करें। |
| 16–20 s | Resuming. अपना दिन, आराम से। |

### Video 2 — Explainer, English (about 75 seconds)

Presenter: a warm, friendly avatar, about 35 to 45, at home or in a calm room. Speaks to camera, unhurried. B-roll fills the screen where noted, with the presenter's voice continuing.

| Time | Presenter says | On screen |
|------|----------------|-----------|
| 0–7 s | "Most habit apps make you feel bad the day you miss a streak. Resuming works the other way." | Presenter |
| 7–17 s | "Pick a few small things. A ten-minute walk. Two glasses of water. Five minutes of Pranayam. Then tick them off on one simple screen called Today." | B1, B5 |
| 17–27 s | "For breathing and meditation, a video plays right inside the habit, and the timer starts with it. You can even use your own favourite YouTube video." | B2, B6 |
| 27–37 s | "Missed a few days? No guilt and no broken streak. Just tap Resume and start again. That still counts." | B3 |
| 37–50 s | "Reminders work the same gentle way. The doctor's visit, the electricity bill, a cousin's wedding. Add a photo of the invitation card, share it on WhatsApp, and your family adds it to their reminders in one tap." | B4, B7 |
| 50–60 s | "Log your blood pressure, weight and sleep when you want to. Your steps come from Health Connect, and they stay on your phone." | B8 |
| 60–68 s | "It speaks your language: English, Hindi, Gujarati, Marathi, Telugu and Tamil. No ads, and we never sell your data." | B9 |
| 68–75 s | "Resuming. Track your day, gently. Get it free on Google Play, or try it in your browser at resuming dot me." | Presenter, then logo with the Play badge and resuming.me |

### Video 2 — Explainer, Hindi (about 75 seconds)

Same presenter, same scenes, Hindi app in the B-roll.

| Time | Presenter says | On screen |
|------|----------------|-----------|
| 0–7 s | "ज़्यादातर habit apps में एक दिन छूट जाए, तो लगता है सब बेकार हो गया। Resuming ऐसा नहीं करता।" | Presenter |
| 7–17 s | "कुछ छोटी चीज़ें चुनिए। दस मिनट की सैर। दो गिलास पानी। पाँच मिनट प्राणायाम। फिर उन्हें Today नाम की एक आसान स्क्रीन पर टिक कीजिए।" | B1, B5 |
| 17–27 s | "प्राणायाम और ध्यान के लिए, वीडियो habit के अंदर ही चलता है, और टाइमर साथ में शुरू होता है। चाहें तो YouTube का अपना पसंदीदा वीडियो भी लगा सकते हैं।" | B2, B6 |
| 27–37 s | "कुछ दिन छूट गए? कोई बात नहीं। Resume दबाइए और फिर से शुरू कीजिए। वो भी गिना जाता है।" | B3 |
| 37–50 s | "Reminders भी इतने ही आसान हैं। डॉक्टर के पास जाना, बिजली का बिल, किसी की शादी। निमंत्रण कार्ड की फ़ोटो लगाइए, WhatsApp पर शेयर कीजिए, और परिवार एक टैप में उसे अपने reminders में जोड़ लेता है।" | B4, B7 |
| 50–60 s | "जब चाहें, BP, वज़न और नींद लिखिए। आपके कदम Health Connect से आते हैं, और आपके फ़ोन पर ही रहते हैं।" | B8 |
| 60–68 s | "यह आपकी भाषा बोलता है: हिंदी, अंग्रेज़ी, गुजराती, मराठी, तेलुगु और तमिल। कोई विज्ञापन नहीं, और हम आपका डेटा कभी नहीं बेचते।" | B9 |
| 68–75 s | "Resuming. अपना दिन, आराम से। Google Play पर मुफ़्त पाइए, या browser में resuming dot me पर आज़माइए।" | Presenter, then logo with the Play badge and resuming.me |

### Video 3 — Vertical short (30 seconds, 9:16)

For WhatsApp Status, YouTube Shorts, and Instagram Reels. Presenter in the top third, the app below, big captions.

English:

| Time | Presenter says | On screen |
|------|----------------|-----------|
| 0–5 s | "Missed a day of your new habit? Most apps make you start over. Not this one." | B3 |
| 5–14 s | "Resuming keeps it small. Tick a walk, water, or five minutes of Pranayam, with a video to follow along." | B1, B2 |
| 14–24 s | "Got a wedding or a doctor's visit? Add the card's photo and share it on WhatsApp. Family adds it in one tap." | B4, B7 |
| 24–30 s | "Resuming. Free on Google Play." | Logo and Play badge |

Hindi:

| Time | Presenter says | On screen |
|------|----------------|-----------|
| 0–5 s | "नई आदत का एक दिन छूट गया? बाकी apps कहते हैं, फिर से शुरू करो। यह नहीं।" | B3 |
| 5–14 s | "Resuming सब छोटा रखता है। सैर, पानी या पाँच मिनट प्राणायाम टिक कीजिए, साथ में वीडियो भी।" | B1, B2 |
| 14–24 s | "शादी या डॉक्टर का अपॉइंटमेंट? कार्ड की फ़ोटो लगाइए और WhatsApp पर शेयर कीजिए। परिवार एक टैप में जोड़ लेता है।" | B4, B7 |
| 24–30 s | "Resuming. Google Play पर मुफ़्त।" | Logo and Play badge |

### B-roll list (screen recordings, portrait, in English and Hindi)

| Id | What to record |
|----|----------------|
| B1 | Today screen with Water, Walk, and Kapalabhati. Tick Water, then Walk. |
| B2 | Start the Kapalabhati timer. The follow-along video opens and plays. |
| B3 | A habit marked quiet yesterday. Tap Resume. |
| B4 | Open "Riya's wedding" with its invitation card photo. Tap Share, then the WhatsApp share sheet. |
| B5 | Add a habit: the template picker, choose Walk, save. |
| B6 | Edit a habit, paste a YouTube link in Video, save, then the video on Today. |
| B7 | The shared link page on a second phone, tap Add, then the reminder on that phone's Today. |
| B8 | Log a BP reading, then the steps card from Health Connect. |
| B9 | Settings, switch the language from English to Hindi, and Today redraws in Hindi. |

### Notes for HeyGen

- Use one avatar and one voice for English, and the same avatar with a natural Hindi voice for Hindi. Check the Hindi pronunciation of "Resuming", "Kapalabhati", and "Health Connect" before the final render.
- Keep the presenter on screen for the first and last scene of Videos 2 and 3. B-roll fills the middle.
- Captions: large, two lines at most, high contrast, bottom third.
- Export Video 1 as MP4 (H.264) and WebM, 1280 × 720, under 3 MB, plus a still poster frame. Export Videos 2 and 3 as MP4, 1080p.
