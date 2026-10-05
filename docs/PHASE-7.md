# Resuming — Phase 7: Reminders

Goal: one place for the things people put off that are not habits. Go to the post office tomorrow. File tax. Doctor at 11. A cousin's wedding on Saturday. Many people do not use a calendar. Resuming can hold these next to their medicines and habits, in their own language, without feeling like office software.

A reminder is a single thing to do on a day. It is not a habit, a medicine, or a vital.

Prerequisite: none for the website parts. Phone alerts ship in a later Android version code, not the version in review.

## How to use this file

Four milestones. Each one is usable on its own. Finish a milestone before starting the next. Inside a milestone, one task per step, in the order below.

## Rules

- A reminder is not a habit. No streak, no Insight, no "you moved this three times."
- An unfinished reminder is not marked late or red. It stays on Today until it is done or removed.
- Bottom nav stays four tabs. Reminders live on Today, and all open ones are listed on Activities.
- No calendar grid. Days are chips: Today, Tomorrow, Pick a date.
- A time is optional. A reminder with no time is for "any time that day."
- No contacts, calendar, or location permission. No sharing with other people.
- The website shows reminders but cannot alert. Only the Android app sends notifications.
- Names people type stay as they wrote them, in any language.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 See it on Today | P7-01 Reminder records | M |
| | P7-02 Add a reminder | M |
| | P7-03 Reminders on Today | M |
| | P7-04 Reminders on Activities | S |
| M2 Phone alerts | P7-05 Alert at the time | M |
| | P7-06 A day before | S |
| M3 Easier to add | P7-07 Kind of reminder | S |
| | P7-08 Every year | S |
| M4 Off the phone | P7-09 Email for website users | S |
| | P7-10 Data, privacy, and Play | S |

## Milestone 1 — See it on Today

At the end of M1, a person can add a reminder on the website or the phone, see it on that day's Today, and mark it done. No notifications yet.

### P7-01 — Reminder records

- A new `reminders` table: text (up to 120 characters), day, optional time, done time, created and updated times. Row-level security so a person sees only their own.
- Signed-out visitors keep reminders in the guest draft, like medicines. Signing in moves them to the account.
- A cap per person, such as 100 open reminders, so the list stays a list and not an archive.
- Delete account and Export my data include reminders.

### P7-02 — Add a reminder

One screen, reached from **Add reminder** on Today, next to Add habit.

- A text box: "What do you want to remember?"
- Day chips: **Today**, **Tomorrow**, **Pick a date**. Pick a date opens the phone's own date picker.
- Time chips: **Any time**, **Morning**, **Afternoon**, **Evening**, **Pick a time**. Morning, Afternoon, and Evening map to fixed times (9:00, 14:00, 18:00) that can be changed later in Settings.
- Save. Nothing else is required.
- Copy in all six languages.

### P7-03 — Reminders on Today

- On their day, reminders appear on Today in their own short section, after medicines and before habits.
- Tap to mark done. A done reminder leaves the list. Undo is available for a few seconds.
- Reminders done today collect in one collapsed line at the end of the section: **Done today (3)**. Tap to open it and see them, struck through, with **Not done** to put one back. The line is hidden when nothing is done today, and it empties at the start of the next day.
- Each open reminder has **Move to tomorrow** and **Pick a day**.
- A reminder from an earlier day that is still open stays on Today with a quiet "From Tuesday" line. It does not turn red.
- Edit and delete from the reminder itself.

### P7-04 — Reminders on Activities

- The Activities tab gets a **Reminders** section below the habits, with its own **Add reminder** button, like Medicines on Vitals.
- It lists every open reminder by day: Today first (with earlier open days), then Tomorrow and later dates.
- Tap a reminder to edit it, change its day, or delete it.
- Done reminders are not listed. Only today's show, under Done today on Today. No history screen in this phase.

## Milestone 2 — Phone alerts

At the end of M2, the Android app sends a notification when a reminder is due. This needs a new Android version code.

### P7-05 — Alert at the time

- A reminder with a time gets a local notification at that time, using the same notification setup as medicines.
- Actions on the notification: **Done**, **Tomorrow**, **In 1 hour**.
- A reminder with no time does not get its own alert. It is named in the existing daily notification with what is still open on Today.
- Editing, moving, or deleting a reminder updates or cancels its alert.

### P7-06 — A day before

- When adding a reminder, an optional switch: **Also remind me the day before**.
- The day-before alert comes in the evening of the previous day.
- Meant for doctor visits, events, and anything that needs preparing.

## Milestone 3 — Easier to add

At the end of M3, reminders have a kind and an icon, and birthdays come back each year.

### P7-07 — Kind of reminder

- An optional kind with an icon: **Errand**, **Bill or tax**, **Doctor**, **Event**, **Other**.
- The kind is for the icon and the Coming up list. It does not change how the reminder works.
- No kind is required. Skipping it is Other.

### P7-08 — Every year

- An optional **Every year** switch for birthdays, anniversaries, and festivals.
- When an every-year reminder is marked done, the next year's copy appears in Coming up.
- No weekly or custom repeats. Repeating every day or week is a habit, and habits already exist.

## Milestone 4 — Off the phone

### P7-09 — Email for website users

- Signed-in people who do not use the Android app can choose to get an email on the morning of a reminder's day.
- Off by default. One switch in Settings.
- Uses the existing check-in email function and its opt-out.

### P7-10 — Data, privacy, and Play

- Privacy policy and Terms say reminders are stored to show and alert them, and are not shared.
- Play Data safety form lists reminder text as user content.
- Admin analytics counts reminders added and done, not their text.

## Out of this phase

- Adding a reminder by speaking. Speech input gets its own phase.
- Calendar sync (Google Calendar or the phone calendar).
- Shared reminders or reminding another person.
- Location reminders ("when I reach the market").
- Reading dates from plain words, such as "next Tuesday."
- iPhone alerts.
- Lists, projects, priorities, or tags.
