# Resuming — Phase 9: Welcome flow by link

Goal: the welcome questions match where the person came from. Someone who installs from a yoga class link is asked about pranayam first. Someone from a diabetes camp is asked about medicines and vitals first. Everyone can still reach every question.

A **track** is one version of the welcome flow: which questions come first, what is preselected, and an optional language hint. The default track is today's order: Medicine, Pranayam, Workout, Heartfulness, Vitals, then Reminder and Save.

Prerequisite: Phase 6 groups and the Play install referrer (P6-01, P6-02). Reading the track on an Android phone needs a new Android version code. The website part can ship first.

## How to use this file

Four milestones, in order. Each one is usable on its own. Inside a milestone, one task per step.

## Rules

- Reorder and preselect. Never hide. Every person can reach every welcome question.
- Anything preselected can be unselected with one tap.
- The person is not told which track they are on. No "You came from the yoga group."
- The track is chosen once, on the first open, and kept with the guest draft. A reload or a later open keeps the same track.
- Changing a group's track affects new installs only.
- The link format from Phase 6 stays the same. QR codes already printed keep working.
- The install referrer chooses a flow. It does not unlock anything paid and is not proof of who someone is.
- A Phase 8 event link comes first. If the link carries an event, the event confirm screen shows before the welcome questions, then the track continues.
- The language screen layout stays as it is. A language hint only highlights a button. The person still taps to choose.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M1 Tracks | P9-01 Track records | M |
| | P9-02 Welcome flow follows a track | M |
| M2 Pick the track from the link | P9-03 Track on the group | S |
| | P9-04 Read it on the phone | M |
| | P9-05 Read it on the website | S |
| M3 Language hint | P9-06 Highlight a language | S |
| M4 Measure | P9-07 Finish rate by track | S |
| | P9-08 Five-day return by track | S |

## Starter tracks

| Track | Order | Preselected |
|-------|-------|-------------|
| Default | Medicine, Pranayam, Workout, Heartfulness, Vitals | Nothing new |
| Yoga | Pranayam, Heartfulness, Workout, Medicine, Vitals | Anuloma Viloma |
| Health camp | Medicine, Vitals, Workout, Pranayam, Heartfulness | Weight, Blood Pressure |
| Seniors | Medicine, Vitals, then the rest behind **Show more** | Blood Pressure |
| Fitness | Workout, Vitals, Pranayam, Heartfulness, Medicine | Walking, Steps |
| Heartfulness | Heartfulness, Pranayam, Medicine, Workout, Vitals | Relaxation, Meditation |

Reminder and Save always come last.

## Milestone 1 — Tracks

At the end of M1, the welcome flow can run in any order from a track, and the default track behaves exactly as it does today.

### P9-01 — Track records

- An `onboarding_tracks` table: a short key, a name for the admin, the question order, the preselected activity ids, an optional language hint, and an optional point after which the rest sit behind **Show more**.
- Questions are the five welcome questions: medicine, pranayam, workout, heartfulness, vitals.
- Preselected ids must be ids those questions already offer, such as `anuloma_viloma`, `weight`, or `steps`.
- Anyone can read the tracks. Only the admin can change them.
- The starter tracks above are seeded. Default is always present and cannot be deleted.
- The app keeps a built-in copy of Default, so the welcome flow works with no network.

### P9-02 — Welcome flow follows a track

- The welcome flow asks the five questions in the track's order.
- Back follows the same order.
- The progress dots follow the same order and count.
- Preselected activities are selected when their question opens, not before. Saying No to that question clears them.
- **Show more** is one screen: "Want to see more options?" with Yes and No. No goes straight to Reminder.
- The track key is stored on the guest draft.

## Milestone 2 — Pick the track from the link

At the end of M2, a group's link starts its own track, on the phone and on the website.

### P9-03 — Track on the group

- On the admin group screen, each group has a **Welcome flow** choice. The default is Default.
- A member can have their own choice that overrides the group's, for a member who runs a different kind of stall.
- Group members do not see this choice in Settings.

### P9-04 — Read it on the phone

- On the first open, the Android app reads the install referrer once and keeps the group and member codes on the device.
- The app asks the server for that code's track. If the answer takes more than two seconds or fails, it uses Default.
- The language screen does not wait. The track lookup runs while the person chooses a language.
- An install with no code, or a reinstall, uses Default.

### P9-05 — Read it on the website

- The home page reads `utm_source` and `utm_campaign` from its own address, the same codes as the Play link.
- The website asks the server for the track the same way, with the same Default fallback.
- The track is kept with the guest draft, so going through Get started uses it.

## Milestone 3 — Language hint

### P9-06 — Highlight a language

- A track or a group can carry a language hint, such as Gujarati for a stall in Ahmedabad.
- On the language screen, that language's button is highlighted and has focus. Nothing is chosen until the person taps.
- The English prompt stays English. The buttons stay in their own scripts.
- If a language is already saved on the device, the language screen does not show, as today.

## Milestone 4 — Measure

### P9-07 — Finish rate by track

- Admin analytics shows, for each track: welcome flows started, flows that reached Reminder, and flows that reached Save or sign-in.
- Counts only. No names and no answers.

### P9-08 — Five-day return by track

- The Phase 6 five-day count is also shown by track: installs, still inside 30 days, reached five days, ended short.
- This shows which welcome flow keeps people, not only which one is finished.

## Out of this phase

- Tracks for people who did not come from a link, such as guessing from their answers.
- Different screens or wording inside a question. A track changes order and preselection only.
- Tracks on iPhone.
- Testing two tracks on the same group at random.
- Letting group members create their own tracks.
