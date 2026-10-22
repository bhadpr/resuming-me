# Resuming — Phase 17: One link, many reminders

Status: planned on 22 Oct 2026. Nothing is built.

Goal: an admin makes a set of reminders once and shares one link. Anyone who opens it can accept them onto their own list.

Example: a school holiday list. Parents tap one link. If Resuming is installed, they see the holidays and accept them. If it is not installed, they go through the install path and see that same list on the first open.

## Decisions

- **Admin only creates the link.** The same rule as community reminders. A signed-in person cannot make one.
- **Anyone with the link can read it and accept it.** No account is required to accept. A WhatsApp link can be forwarded. The admin stops that by switching the link off.
- **Accepting takes a tap.** The link never adds reminders by itself. The person can accept all, or only some.
- **A copy is an ordinary reminder.** Alerts work as they do today. The website can show them and cannot alert.
- **Snapshot.** Accepting copies what the list holds at that moment. A later edit is not pushed to people who already accepted. To fix a mistake, the admin switches the link off and shares a new one.
- **One day per item.** A break that spans many days is one reminder per day. No end date in this phase.
- **No web links in the text.** Same block as a shared event.
- **Cap.** 20 reminders on one link, so it stays a list.
- **Privacy.** The server stores the title, the reminder text, and the dates. It does not store the names of people who accept. A count is enough.

## What exists today

- One reminder can already be shared as `resuming.me/e/<code>` (`SharedEventPage`, `src/lib/sharedEvents.ts`). The page can send an Android phone without the app to Play, and the install referrer brings that event back on the first open.
- Android App Links already open `/e/` inside the app. `/c/` does not.
- Community reminders are already admin-only. Accepting a shared list can copy items into ordinary reminders the same way.

## How to use this file

Five sprints, in order. Each one is usable on its own. Finish a sprint before starting the next.

## Sprints

| Sprint | Done when | Size |
|--------|-----------|------|
| 1. Admin makes the list | An admin can add the reminders, copy one link, and switch it off | M |
| 2. The list page | Anyone can open the link on the website, see the reminders, and accept them | M |
| 3. Not installed | An Android phone without the app goes to Play, then sees the list on the first open | M |
| 4. Already installed | The link opens the Android app on that same list | M |
| 5. Safety | Report, the count, privacy, and all seven languages are in place | S |

About 3 to 5 days for all five. Sprint 4 needs a new Android version code. Do not upload that build while 1.0.8 is still in Play review.

### Sprint 1 — Admin makes the list

- Two tables: the list (title, short code, status, created time) and its items (text, day, optional time, optional kind).
- Only an admin can insert or change them. Anyone can read an active list by its code.
- An admin screen, opened from **Settings → Admin → Reminder lists**: title, then each reminder typed by hand, then **Copy link**. The link is `resuming.me/c/<code>`.
- **Switch off** makes the link say it is no longer available. Items already accepted stay on those phones.
- New strings in all seven languages.

### Sprint 2 — The list page

`resuming.me/c/<code>`

- The page shows the title and every reminder: text, day, and time if it has one. The page's own words follow the visitor's language. The reminder text stays as the admin wrote it.
- **Accept all** and a way to accept only some. Each accepted item becomes that person's own reminder, signed in or as a guest.
- Accepting the same item twice does not make a second copy.
- A switched-off list, or a bad code, shows a clear message and no accept button.
- WhatsApp's link preview shows the title, not a generic Resuming card.

### Sprint 3 — Not installed

- On an Android phone that does not have the app, the link opens Play with this list's code in the install referrer, the same way a shared event does.
- On the first open, after the language screen, the app shows the Sprint 2 list.
- **Accept** adds the chosen reminders. **Not now** adds nothing.
- If the list was switched off between the tap and the install, the app says so and adds nothing.
- An iPhone opens the website page from Sprint 2. The App Store path waits until the iPhone app is listed.

### Sprint 4 — Already installed

- Android App Links for `resuming.me/c/*`, with the verification file on the website, so the link opens Resuming without asking which app to use.
- The app shows the same list and the same Accept / Not now choice.
- This ships in a new Android version code, after 1.0.8 has left review.
- iPhone universal links for `/c/` are part of the iPhone release, not this sprint.

### Sprint 5 — Safety

- A **Report** link on the list page and on the accept screen.
- The admin sees how many people accepted the list. One account or one guest device counts once. No names.
- The privacy page says an admin can publish a list of reminders, anyone with the link can read it, and accepting stores a copy on that person's account or device.

## Not in these sprints

- A signed-in person creating a list. Admin only.
- Pushing later edits to people who already accepted.
- An end date that covers many days in one item.
- `.ics` export or import.
- The iPhone App Store install path.
- Reading dates out of a photo. The admin types each day. A photo that suggests dates, for the admin to check before the link is shared, can come after this.
