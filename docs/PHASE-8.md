# Resuming — Phase 8: Shared event reminders

Goal: someone posts an event in a WhatsApp group, and anyone who taps the link gets the reminder in Resuming. Example: the mandal's Ganesh Aarti, every day at 7:00 pm for 14 days. The organizer creates it once, shares one link, and every tap sets the reminder on that person's phone.

A shared event is a reminder that many people follow. It is not a habit, and it is not a group chat.

Prerequisite: Phase 7 Milestones 1 and 2 (reminders on Today and phone alerts). The Play install referrer from Phase 6 is reused for people who do not have the app yet. Opening the app straight from the link needs a new Android version code.

## How to use this file

Five milestones, in order. Each one is usable on its own. Inside a milestone, one task per step.

## Rules

- Adding always takes a tap. A link never adds a reminder by itself.
- The organizer needs an account. The person receiving does not.
- The organizer sees a count of people who added the event, never names or phone numbers.
- Anyone with the link can see the event text. The share screen says so before the link is made.
- Links are open on purpose. A WhatsApp link can always be forwarded, so the app does not try to limit who receives it. The organizer controls it by closing or resetting the link instead.
- The event page and confirm screen never show the organizer's name, email, or phone number. Only the optional From line.
- Event text cannot contain web links. This blocks "click here to claim a prize" messages.
- Once the link is made, the event's text, From line, days, and time never change. To fix a mistake, the organizer cancels it and shares a new one.
- A day range is capped at 31 days. Longer, open-ended repeats are habits.
- A shared event is never a streak or an Insight, the same as any reminder.
- Bottom nav stays four tabs.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 Day ranges | P8-01 Every day from one date to another | M |
| M2 Share it | P8-02 Shared event records | M |
| | P8-03 Share on WhatsApp | S |
| | P8-04 The event page | M |
| M3 Open in the app | P8-05 Link opens the app | M |
| | P8-06 Install, then add | M |
| | P8-07 The confirm screen | S |
| M4 Cancel and counts | P8-08 Locked once shared | S |
| | P8-09 Cancel | S |
| | P8-10 How many added it | S |
| | P8-11 Close or reset the link | S |
| M5 Safety | P8-12 Report and switch off | S |
| | P8-13 Data, privacy, and Play | S |

## Milestone 1 — Day ranges

### P8-01 — Every day from one date to another

Phase 7 allows one day or every year. This adds a bounded daily range, which a festival needs.

- When adding a reminder: **One day** or **Every day from … to …**.
- The range is at most 31 days. One time for every day in the range.
- Today shows it on each day of the range. Done marks only that day.
- Phone alerts fire on each day at the time.
- After the last day, it leaves Today and Coming up.
- This works for private reminders too, not only shared ones.

## Milestone 2 — Share it

At the end of M2, an organizer can share a link, and anyone can open the event page on the website and add it there.

### P8-02 — Shared event records

- A `shared_events` table: short code, owner, text, optional "From" line (such as a mandal name), first day, last day, time, time zone, optional kind, status (active, cancelled, switched off), whether it takes new adds, created and updated times. A reset replaces the short code; old codes are kept only so their links can say "no longer available".
- A follower record links one account or one guest device to one event. It exists for the count and so copies can learn the event was cancelled or switched off. It has no name or phone number.
- A person's copy of a shared event is their own reminder with a link back to the event.
- Row-level security: the owner can change only the status, whether it takes new adds, and the short code (on reset). Text, From line, days, time, and time zone are fixed when the row is created. Anyone can read an active event by its code. Only the owner and the admin see the count.

### P8-03 — Share on WhatsApp

- From an organizer's reminder: **Share on WhatsApp**.
- Before the first share, one line: "Anyone with this link can see this reminder."
- The app makes the short link and opens WhatsApp (or the phone's share sheet) with a ready message in the organizer's language. For example: "🪔 Ganesh Aarti — every day 7:00 pm, 7–20 Sep. Tap to get a reminder: resuming.me/e/ab12cd"
- The message carries the date and time in plain words, so it is useful even to people who never tap.
- A daily limit per account, such as 10 new links, to slow spam.

### P8-04 — The event page

`resuming.me/e/<code>`

- The page shows the event text, the From line, the days, and the time. The page's own words are in the visitor's language. The event text stays as the organizer wrote it.
- The page is served with its own preview details, so WhatsApp shows the title and dates in the link preview, not a generic Resuming card.
- **Add on this website** puts it on the website's Today, signed in or not. The website cannot alert.
- **Get it on Play** goes to the Play listing with the event code in the install link.
- A cancelled event says so. A switched-off event, or an old code after a reset, says it is no longer available. An event closed to new adds, or past its last day, shows the details but no add button.

## Milestone 3 — Open in the app

At the end of M3, tapping the link on an Android phone opens Resuming straight to the confirm screen, whether the app was installed or not. Needs a new Android version code.

### P8-05 — Link opens the app

- Android App Links for `resuming.me/e/*`, with the verification file on the website, so the link opens the app without asking which app to use.
- Without the app, the same link opens the event page from P8-04.

### P8-06 — Install, then add

- The Play link from the event page carries the event code in the install referrer, the same way as the Phase 6 marketing links. Both codes can travel together.
- On the first open, after the language screen, the app shows the confirm screen for that event.
- If the event was cancelled, switched off, reset, or closed to new adds meanwhile, the app says so and adds nothing.

### P8-07 — The confirm screen

- The event text, the From line, the days, and the time, in the receiver's language.
- If the receiver's phone is in a different time zone from the event, show the time on their phone and the event's local time.
- **Add reminders** and **Not now**. A small **Report** link.
- If they already have it: "This is already on your Today."
- After adding, open Today.

## Milestone 4 — Cancel and counts

### P8-08 — Locked once shared

Alerts are scheduled on each phone, and a phone only syncs when Resuming is opened. A change could leave people with the old time, so a shared event does not change.

- Before the first share, the organizer's reminder is private and can be edited like any other.
- After the link is made, the organizer's reminder shows its details but no edit. A short line explains: "Shared events can't be changed. Cancel and share a new one."
- A follower cannot edit a shared copy. They can mark days done, remove it, or turn off its alerts. Removing it ends their follow.

### P8-09 — Cancel

- The organizer can cancel. Copies show "Cancelled by the organizer" and their alerts stop when that phone or browser next syncs.
- A cancelled event leaves Today and Coming up after its last day.
- **Cancel and make a new one** opens a new reminder filled in with the old details, ready to fix and share. It is a new event with a new link and a count starting at zero.

### P8-10 — How many added it

- On the organizer's reminder: "42 people added this."
- One account or one guest device counts once. Removing it lowers the count.
- No names, numbers, or list of followers.

### P8-11 — Close or reset the link

The link is open, so the organizer needs a way to stop it spreading without hurting people who already added it.

- **Stop new adds:** the link stays readable, but the event page and confirm screen say "This event is not taking new reminders." People who already added it keep it.
- **Reset link:** makes a new short code. The old link says it is no longer available and adds nothing. Existing followers are not affected. Counts against the daily link limit.
- After the last day, the link closes by itself and shows "This event has ended."
- The organizer can turn new adds back on. After a reset, only the newest code works.

## Milestone 5 — Safety

### P8-12 — Report and switch off

- The Report link offers a few reasons: spam, wrong or harmful, other.
- The admin area lists reported events with the report count.
- The admin can switch an event off. Its page and the confirm screen say it is no longer available, and copies stop alerting.

### P8-13 — Data, privacy, and Play

- Privacy policy and Terms say shared event text can be seen by anyone with the link, and that followers stay anonymous to the organizer.
- Play Data safety form updated for shared event text.
- Admin analytics counts events created, link opens, adds, and installs from event links, not the event text.

## Out of this phase

- RSVPs, comments, or chat on an event.
- Changing an event after it is shared, and push notifications to deliver changes.
- The organizer seeing who added it.
- Photos or posters on the event.
- More than one time per day.
- Donations or payments.
- iPhone app links and alerts.
- Sharing to apps other than through WhatsApp or the phone's share sheet.
