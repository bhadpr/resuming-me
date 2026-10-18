# Resuming — Phase 17: Shared calendars (parked idea)

Status: parked on 17 Oct 2026. Nothing is built. This file keeps the idea and the decisions to make, so it can be picked up later.

Goal: someone makes a set of reminders once and shares them with one link, so many people get them all at once.

## Use case

A school publishes its holiday calendar for the year. Today parents go back to the school website every time to check a date. Instead, one parent (or the school) makes all the holidays as reminders and shares one link. Parents open it and have every holiday in one place, with the normal alerts.

## What exists today

- A single reminder can be shared as `resuming.me/e/<code>`. The link opens a page with an "Add to my reminders" button (`SharedEventPage`, `src/lib/sharedEvents.ts`).
- The app tracks who added it (followers), lets the organizer close the link, cancel the event, or reset the code, and lets people report it.
- Shared events are one-day only and in the future (`isShareableReminder`), block web links (`hasWebLink`), and have a daily cap.
- Community reminders (admin-only, `src/lib/communityReminders.ts`) copy a catalogue item into an ordinary reminder. A shared calendar can use the same copy approach.

## The idea

A shared calendar: one link, `resuming.me/c/<code>`, that holds many reminders.

- The creator picks several reminders, or builds the list as they go, and shares the link.
- The link opens a page such as "Springfield School holidays 2026–27" with the list.
- A parent taps "Add all", or picks only some. Each one becomes a normal reminder on their phone.
- Built on the shared events pieces: a table for the calendar, a table for its items, and the same follow, close and report logic. Moderate effort, a few days.

## Decision 1: do copies update when the calendar changes?

| Option | What it means | Cost |
|--------|---------------|------|
| Snapshot (start here) | Parents get what the calendar holds when they tap "Add all". A later change is not pushed. The page shows "Updated on <date>" and an "Add new ones" button for people who reopen it. | Small |
| Live | Parents follow the calendar, and new or changed holidays arrive in the app. Needs edit sync, which does not exist today (a copy only picks up a cancellation), and phones must check for changes. | Larger |

Recommendation: snapshot first.

## Other things to decide

- **Who can create one.** Admin-only first (safer, like community reminders), or every signed-in user later.
- **Web links.** Keep the block on links in text, as shared events do.
- **Multi-day breaks.** Shared events are one-day only. "Winter break, 22 Dec to 2 Jan" needs one reminder per day, or an end date on the item.
- **Limits.** A cap on items per calendar (for example 60) and on calendars per day, so it cannot be used to spam.
- **Time zones.** Holidays are all-day, so this does not matter for the school case. Timed items would reuse `localEventTime`.
- **Privacy.** The server holds the text and dates of the shared items. Nothing about the people who add them is stored beyond a follower count (unless live sync is added later).
- **Android.** Alerts for the copies work as today. A new app build is needed so `/c/` links open in the app, as `/e/` links do.
- **Translations.** New strings in all seven locales.

## Related, also parked

`.ics` calendar files. Exporting a reminder or a shared calendar as an `.ics` file is cheap (plain text, no backend). Importing `.ics` files into the app is not worth it for now. Decided on 17 Oct 2026 to think about it in the future.

## Done when (if picked up)

- The creator can share a set of reminders with one link.
- A parent who opens the link can add all of them, or some, in a couple of taps.
- A closed, expired or switched-off calendar shows a clear message.
- Reports and the admin view work as they do for shared events.
