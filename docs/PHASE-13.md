# Resuming — Phase 13: Repeating reminders, sharing them, and habit alert times

Status: parked (12 Oct 2026), for after the first launch. The decisions below need more thought before work starts.

Goal: a reminder can repeat (daily, on chosen weekdays, monthly, or yearly), and a repeating reminder can be shared on WhatsApp like a one-time event. For example, "Satsang every Monday at 7 pm", shared once, stays in everyone's reminders until the organizer cancels it. A habit or vital can also have its own optional alert time, such as "Pranayam at 6:30 am", while the rest keep the shared daily nudge.

## Where things stand (12 Oct 2026)

| Part | State |
|------|-------|
| Repeats | Only "Every year". Marking one done creates a separate copy for next year (`nextYearCopy`). |
| Today | Open reminders show on their day and stay until done. Done ones show for 36 hours. |
| Alerts | One alert per reminder at its time, plus an optional alert the evening before, scheduled on the phone. |
| Sharing | One-time reminders only. `isShareableReminder` rejects every-year reminders. A shared event has one day, an optional time, and a time zone, and its details are locked once shared. |
| Cancelled events | An hourly Android check drops alerts for cancelled or switched-off shared events. |
| Limit | 100 open reminders per account. |
| Habit and vital alerts | None of their own. A shared daily nudge, one to five times a day set in Settings, lists what is still open on Today (and reminders with no time) and stays silent when everything is done. A separate nudge follows a few quiet days. "Usually when" only orders Today. |
| Medicine alerts | One per dose time. |

## Decisions to make

1. **Repeat choices.** Suggested: daily, weekly on chosen days, monthly on a date (the 31st becomes the month's last day), and yearly, with an optional end date. Leave out "every N days" for now.
2. **How a repeat is stored.** Copying on done, as every-year does now, would make 365 rows a year for a daily reminder. Suggested: one row that moves its date forward to the next occurrence on Done or Skip, and keeps the last done date. Existing every-year reminders move to the same model.
3. **A missed occurrence.** A one-time reminder stays on Today until done. Suggested: a missed repeat gives way to the next one, so they never pile up ("missed a day? just resume").
4. **Editing.** Suggested: Edit changes the whole series. Move to tomorrow and Skip change only that occurrence.
5. **Reminder or habit.** A daily reminder can look like a habit. Suggested line: reminders alert at a time and have no progress or streaks. Medicines stay separate.
6. **Release timing.** The 1.0.4 app does not know about repeats. If it opens a repeating reminder, it treats it as one-time, and marking it done there ends the series. Either repeats ship with the app version that understands them, and the website does not save repeat rules until that version is out, or 1.0.4 waits for this phase.
7. **Organizer skipping one occurrence** ("no satsang this Monday"). Needs per-date exceptions sent to everyone. Suggested: not in the first version.
8. **Habit alert times.** Suggested: keep the shared daily nudge as the default, and add an optional time per habit or vital, empty unless the person sets one. Alerts for every habit by default would mean several notifications a day, and people who feel nagged turn off notifications for the whole app, losing medicine and reminder alerts too. Open question: the limit on timed habits (suggested five).

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 Repeat model | P13-01 Database and migration | M |
| | P13-02 Next occurrence logic | M |
| M2 Alerts | P13-03 Schedule ahead and top up | L |
| M3 Screens | P13-04 Form, Today, list, and reminder page | M |
| | P13-05 Guests | S |
| M4 Sharing | P13-06 Share a repeating reminder | M |
| | P13-07 Message, link page, and preview | S |
| M5 Habit alert times | P13-08 Optional time on a habit or vital | M |

M5 does not depend on M1 to M4 and can ship on its own, before them if wanted.

## Milestone 1 — Repeat model

### P13-01 — Database and migration

- New reminder columns: the repeat rule (none, daily, weekly, monthly, yearly), its weekdays or date, an optional end date, and the last done date.
- Move existing every-year reminders to the yearly rule. Old next-year copies stay valid.
- The same rule columns on shared events, locked by the guard trigger, and returned by `get_shared_event` and `admin_shared_events`.
- Done when existing every-year reminders load as yearly repeats with nothing lost.

### P13-02 — Next occurrence logic

- Work out the next occurrence for each rule, including month ends, 29 February, and the end date.
- Done and Skip move the reminder to its next occurrence. Reopen moves it back.
- A repeating reminder counts as one toward the 100 open reminders.
- Done when tests cover every rule across month ends, leap years, and end dates.

## Milestone 2 — Alerts

### P13-03 — Schedule ahead and top up

- Schedule each repeating reminder's next few occurrences, staying well under Android's limit of about 500 pending alarms per app.
- The hourly Android check also tops up alerts, so they keep coming even if the app is not opened for weeks.
- The evening-before alert and the alert's Done and Later buttons act on the right occurrence.
- Done when a daily reminder keeps alerting for three weeks on a real phone without the app being opened.

## Milestone 3 — Screens

### P13-04 — Form, Today, list, and reminder page

- The form's "Every year" switch becomes "Repeats": never, daily, weekly (with day chips), monthly, yearly, and an optional end date.
- Today shows a repeating reminder on its days. Done today still lists it.
- The list and reminder page show the rule ("Every Mon, Thu · 7:00 pm") and the next date.
- Rule text in all six languages.

### P13-05 — Guests

- The rule is kept in the guest draft on the device and carried over at sign-up.

## Milestone 4 — Sharing

### P13-06 — Share a repeating reminder

- A repeating reminder can be shared while it has future occurrences.
- People who add it get the same rule. Their done and skipped days stay their own.
- Stop adds, Reset link, and Cancel work as now. Cancel stops every future occurrence for everyone, and the hourly check drops their alerts.
- The admin screen shows the rule.

### P13-07 — Message, link page, and preview

- The WhatsApp message, the shared link page, and the link preview (`worker/index.ts`) say "Every Monday at 7 pm" instead of a date, in all six languages.

## Milestone 5 — Habit alert times

At the end of M5, a habit or vital can have its own alert time. Habits without one keep the shared daily nudge.

Why: some habits are tied to a time (Pranayam at 6:30 am, a walk after dinner, prayer at sunset), and doctors usually ask for BP at the same time each morning. It also prepares for the family care circle in Phase 12, where "Papa's 8 am BP" needs a time.

### P13-08 — Optional time on a habit or vital

- A "Remind me at" field on the habit form, empty by default, in all six languages.
- One alert at that time, only on the habit's scheduled days (respecting days off), and silent if the habit is already done that day.
- A habit with its own time leaves the shared daily nudge, so it is never alerted twice.
- A gentle limit on timed habits (suggested five), with the shared nudge covering the rest.
- The alert has a Done button for checkbox habits. Timer and count habits open the habit, as reminder alerts open the reminder.
- Android only, like the other alerts. Uses its own notification id range, apart from reminders, medicines, and the daily nudge.
- Done when a timed habit alerts once at its time on a real phone, stays silent if already done, and no longer appears in the shared nudge.

## Out of this phase

- Nudges that repeat every few hours, such as for water.
- Rules like "every 3 days" or "second Tuesday of the month".
- The organizer skipping or moving one occurrence of a shared repeat.
- Repeat history or statistics beyond the existing analytics counts.
- No privacy page or Data safety change is expected, because no new kind of data is collected.
