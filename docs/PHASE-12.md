# Resuming — Phase 12: Family and the ideas that could change the game

Goal: Resuming becomes something families use together, not only one person. A son can see that his father took his BP tablet. A family can do 21 days of Pranayam together. The app reminds people of the festivals and fasts they already keep, and anyone can add a reminder by speaking in their own language.

This is a plan of ideas, not a commitment. Each milestone stands alone and can ship on its own. Start after 1.0.4 is live and stable.

## Where things stand (12 Oct 2026)

| Part | State |
|------|-------|
| Sharing | Shared events (Phase 8): one link on WhatsApp, people add it in one tap, the organizer can stop adds, reset, or cancel. Works for guests through an anonymous device id. |
| Health | Medicines with dose times and taken marks, BP, heart rate, weight, sleep, steps from Health Connect (kept on the phone, never sent to our servers). |
| Habits | Built-in and custom habits, timers, Heartfulness and Pranayam videos, and an optional own YouTube video on any habit. |
| Reminders | One-time and every-year reminders with a kind, description, and photo. Alerts are scheduled on the phone. |
| Languages | English, Hindi, Gujarati, Marathi, Telugu, Tamil. |
| Background work | An hourly Android check (WorkManager) for cancelled shared events. No cloud push service. |

## How to use this file

Five milestones. M1 is a quick win and can start right away. M2 is the headline feature. M3 to M5 can go in any order after M2.

## Rules

- **The person being cared for decides.** Nothing about one person is shown to another without that person's clear yes, and they can stop it at any time from their own phone.
- **Show done, not details.** Helpers see "taken" or "not yet", never notes, photos, or anything the person did not choose to share.
- **No shame.** No rankings, no broken-streak messages. Group totals count effort, in the spirit of "missed a day? just resume".
- **Health Connect data stays on the phone.** Steps are never shared with a helper or a group, because Health Connect's Limited Use rules do not allow it.
- **Every new data flow updates the privacy page and the Play Data safety form before release.**
- **All six languages ship together**, as with every phase.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 Home-screen widget | P12-01 Today widget (view only) | M |
| | P12-02 Tick from the widget | M |
| M2 Family care circle | P12-03 Invite and consent | L |
| | P12-04 What the helper sees | M |
| | P12-05 Gentle nudge when something is missed | M |
| | P12-06 Privacy, Data safety, and stopping | S |
| M3 Group challenges | P12-07 Start and join a challenge | M |
| | P12-08 Shared total and the end | M |
| M4 Festival and fasting calendar | P12-09 Curated dates | M |
| | P12-10 Suggest and add | S |
| M5 Voice reminders | P12-11 Speak a reminder | M |
| | P12-12 Understand day and time words | L |

## Milestone 1 — Home-screen widget

At the end of M1, an Android widget shows today's habits and the next reminder, and people can tick a habit without opening the app.

Why: a widget puts the app on the home screen every time the phone is unlocked. It is one of the most reliable ways to keep people coming back on Android, and it costs little.

### P12-01 — Today widget (view only)

- A native Android App Widget in two sizes: small (the next three items) and medium (today's list).
- The app writes a small snapshot whenever Today changes: habit names, done or not, and the next reminder's text and time. The widget reads only that snapshot. It never calls the server.
- Tapping an item opens the app on that habit or reminder.
- Follows the app's theme and language.
- Done when the widget updates within a minute of marking something done in the app, and shows correctly after a phone restart.

### P12-02 — Tick from the widget

- A tick button on checkbox habits and on reminders.
- A tick is saved on the phone first and sent with the app's existing offline queue the next time the app opens or the background check runs.
- Timer and count habits open the app instead.
- Done when a tick made with no network appears on Today, and then on the server once the phone is back online.

## Milestone 2 — Family care circle

At the end of M2, an adult child can follow a parent's daily medicines and chosen habits, with the parent's consent, and gets a gentle nudge if something is missed.

Why: "Did Papa take his BP tablet?" is a worry millions of families have every day. Every circle brings in a second person, the parent keeps logging because someone cares, and the child opens the app to check. Most of the pieces already exist: medicines, readings, the six languages, and WhatsApp links.

### P12-03 — Invite and consent

- Either person can start it. The helper (for example, the son) sends an invite link on WhatsApp, or the parent sends a "look after me" link.
- The person being cared for always sees one clear screen before anything is shared: who will see it, and a checklist of what (each medicine, each habit, BP readings). Nothing is ticked by default except medicines.
- Both people need an account. A guest is asked to save their progress first.
- One person can have up to five helpers. One helper can follow up to five people.
- Done when an invite opened on a second phone leads to a circle only after the parent taps Agree, and declining leaves nothing behind.

### P12-04 — What the helper sees

- A Family section, reached from Today, with a card per person: today's medicines and chosen habits as taken or not yet, and the last BP reading if shared.
- No notes, photos, descriptions, step counts, or history beyond today and yesterday.
- The parent can see the same list of what each helper sees.
- Done when a dose marked on the parent's phone shows as taken on the helper's phone within a minute while the app is open.

### P12-05 — Gentle nudge when something is missed

- If a shared medicine is still not marked two hours after its time (changeable by the parent), the helper gets one alert: "Papa's evening BP tablet isn't marked yet."
- At most one nudge per item per day. Nothing is sent to the parent by the helper's app.
- Decision needed before building: the app has no cloud push service today. Option A is to reuse the hourly background check, so nudges may arrive up to an hour late. Option B is to add Firebase Cloud Messaging, which is on time but adds a third party and changes the privacy page. Start with A.
- Done when an unmarked dose produces exactly one nudge on the helper's phone, and none once it is marked.

### P12-06 — Privacy, Data safety, and stopping

- The parent can stop sharing with any helper, or change what is shared, at any time. The helper can leave at any time. Either way the helper's view clears at once.
- Deleting either account ends the circle.
- Privacy page: a new section on care circles. Data safety: health info (medicines, BP) is now visible to a person the user chose. Check whether Play counts this as sharing, and answer accordingly.
- Done when stopping on one phone clears the other phone's view on its next refresh, and the privacy page and Data safety notes are updated.

## Milestone 3 — Group challenges

At the end of M3, anyone can start a challenge such as "21 days of Pranayam" or "10,000 steps this week", share one link on WhatsApp, and the group sees a shared total.

Why: it uses the same one-link sharing as shared events, but for habits, and gives groups (family, office, yoga class) a reason to open the app together every day.

### P12-07 — Start and join a challenge

- Pick a habit, a length (7, 21, or 30 days), and a daily goal. The challenge gets a link, shared like an event.
- Joining adds the habit to the person's own list if they do not have it, and ties it to the challenge.
- Each person picks the name the group sees. Up to 50 people per challenge.
- Steps cannot be the habit while steps come from Health Connect. A typed count can.
- Done when a link opened on a second phone adds the habit and joins the challenge in one tap.

### P12-08 — Shared total and the end

- The challenge page shows the group's total (for example, "312 minutes of Pranayam together") and how many people showed up today. No ranking, and no list of who missed.
- At the end, everyone gets a short summary they can share on WhatsApp, and the habit stays in their own list.
- The organizer can end a challenge early or remove someone. Reports work as they do for shared events.
- Done when logs from three phones add up correctly on the challenge page, and the end summary appears on all three.

## Milestone 4 — Festival and fasting calendar

At the end of M4, the app suggests reminders for the festivals and fasts a person keeps, such as Ekadashi, Navratri, Karva Chauth, and Diwali puja, at the right dates for their region.

Why: fasting is already a habit in the app, and these dates are what people actually plan around. Each one is a reason to open the app every few weeks, and a natural thing to share as an event.

### P12-09 — Curated dates

- A table of dates we write and check ourselves for each year (2026 and 2027 first), by region where dates differ. We do not compute a lunar calendar in the app.
- Each entry has a name in all six languages, the date, optional muhurat time, and a kind (festival or fast).
- Done when the 2027 table is reviewed by someone who keeps these dates, for at least two regions.

### P12-10 — Suggest and add

- In settings, the person picks their region and which kinds to see (all festivals, fasts only, or none). Off by default.
- A week before each date, Today shows a quiet card: "Ekadashi is on Thursday. Add a reminder?" One tap adds it as a reminder of kind Event.
- Fasting entries can start the fasting timer on the day.
- Done when choosing a region shows the right next three dates, and adding one creates a normal reminder with an alert.

## Milestone 5 — Voice reminders

At the end of M5, a person can tap a microphone and say "Kal subah das baje doctor" ("Doctor, tomorrow at 10 am") and get the right reminder.

Why: typing is the biggest barrier for older users, who are the people M2 and M4 serve.

### P12-11 — Speak a reminder

- A microphone button on the Add reminder form. It uses the phone's own speech recognition (Android's SpeechRecognizer, on the device where the language supports it).
- Audio never goes to our servers. Only the recognised text is used, and it fills the form, which the person checks before saving.
- Done when speaking in Hindi and English fills the reminder text on a real phone.

### P12-12 — Understand day and time words

- Read day and time words from the text: today, tomorrow, day after, weekday names, dates, morning, evening, and clock times, in all six languages.
- Start with English and Hindi, then the other four. Anything not understood stays in the text for the person to set by hand.
- Done when a test list of at least 50 spoken phrases per language fills the day and time correctly at least 9 times out of 10.

## Out of this phase

- Reading bills or bank messages from SMS. Play restricts SMS access heavily, and it is a privacy risk.
- Sending reminders through WhatsApp's business service. It costs money for every message and needs Meta's approval for each message template.
- Push notifications through Firebase, unless P12-05 shows the hourly check is not good enough.
- Care circles on iOS. They follow when the iOS app ships (Phase 10).
