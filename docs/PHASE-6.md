# Resuming — Phase 6: Local marketing groups

Goal: a small group of people can take the app to a local event, and you can see how many real installs and returns came from that group. They see their own counts in Settings. You record when you have paid them.

Prerequisite: the app is already live on Play. This phase does not start during the current review. Paying people in rupees waits until the Indian company in Phase 5 can pay them. The screens below can be built before that. The app records the payment. It does not send the money.

## The deal

You create a group and add its members. Five people in Group A share one goal. Each person has their own link, so the work can be split when you pay.

A **qualified install** is the first open of the app from that person’s link, on one device, one time. A reinstall does not add another.

A person is **retained** when they open the app on five different days inside the first 30 days. The 30 days start on that first open. Five opens on the same day count as one day.

The example pot is ₹5 for each qualified install and ₹50 for each retained person, with a cap you set on the group. One thousand installs and one hundred people who reached five days is ₹10,000. Two hundred retained people on the same one thousand installs is ₹15,000, still inside the cap if you set one. You can change the rates per group. The rupees follow the five-day count. The install count is the entry ticket.

One level only. The company pays the group. A member does not add another group under them.

## How to use this file

One task per step, in the order below. P6-01 is the records. Counts mean nothing until P6-02 tags the install. Settings in P6-04 shows those counts. The ledger in P6-05 is the last step.

## Rules

- Admin adds every member. A member has no invite button and there is no join code.
- Group stats are counts. A member never sees the name, phone, medicines, vitals, or logs of someone they helped install.
- A member sees their own group only, plus their own link.
- Payment notes stay with the admin. A member does not see amounts, the paid tick, or notes.
- One device counts once. The tag is the Play install referrer from that person’s link.
- The stall help is language, one habit or one medicine reminder, and Today opened once. The app does not tell the new person that a marketer is waiting.

## Recommended order

| Order | Task | Size |
|-------|------|------|
| 1 | P6-01 Groups and members | M |
| 2 | P6-02 The link and the first open | M |
| 3 | P6-03 The 30-day count | M |
| 4 | P6-04 Stats in Settings | S |
| 5 | P6-05 The payment ledger | S |

## P6-01 — Groups and members

You manage groups from the admin area that already uses `is_admin` (`/admin/analytics`, `/admin/feedback`). A group member never gets that screen.

- Create a group with a name, an install goal, the rupee rates, and a cap.
- Add a member by the email on their Resuming account. They must already be signed in once so the email matches.
- Removing a member stops their link from counting new installs. Installs already tagged stay on the group.
- Each member gets a stable code under the group. The code is what the link carries.
- The group list shows members and the codes. It does not yet show install counts. That arrives in P6-03.

## P6-02 — The link and the first open

Each code has a Play install link for `com.cheerfulgames.resuming`. The link’s `referrer` carries UTM tags for the group and that member (`utm_source`, `utm_medium`, `utm_campaign`). A QR uses the same link. The package name stays `com.cheerfulgames.resuming`.

- On the first open, the Android app reads the Play install referrer and stores the code with that device.
- A qualified install is that first open. The same device opening again does not add a second install. A reinstall does not add one either.
- A direct Play install with no code stays a normal install and belongs to no group.
- iPhone and the website are out of this phase. The link is for the Android app on Play.
- The member can copy their link and show their QR from Settings once P6-04 is in. Until then, the admin screen can show the link so a stall can be tried.

## P6-03 — The 30-day count

Each qualified install carries the day it started. Later opens on that device add distinct days.

- A day counts in the device’s local date. Five opens on one date add one day.
- Retained means five distinct dates on or before day 30, counting the first open as day one.
- After day 30, further opens do not change the result. The install is retained or it ended short.
- While the 30 days are still running and five days are not reached yet, the install is in progress.
- Store the counts on the group and on the member whose code was on the link. Store no health data and no name of the installed person on the group row.
- Opening the app is the only signal. Setting a medicine is not required for the payout count.

## P6-04 — Stats in Settings

A signed-in member of a group sees one block in `src/components/SettingsScreen.tsx`. Someone in no group sees nothing new. Someone in Group B does not see Group A.

The block shows:

- The group name and the goal.
- Qualified installs, still inside 30 days, reached five days, and ended short.
- The same four numbers for that member’s own code, so the split of the work is visible.
- Their link and QR.

The block is counts and the link. It has no list of people, no add-member control, and no payment line.

The admin group screen shows the same four numbers for every group and every member, still without the installed person’s name.

## P6-05 — The payment ledger

On the admin group screen, you keep a ledger. The app does not pay anyone.

- A line has a date, an amount in rupees, a paid tick, and a note.
- The line can name one member of that group, for a note such as a payment to that person. A line with no member is a payment to the group as a whole.
- Several lines are allowed. An early amount and the amount after the 30 days are separate ticks.
- The screen shows what the rates and the five-day count have earned, the cap, and the total already marked paid.
- Ticking paid means you have already sent the money. Unticking is allowed if the tick was a mistake.
- Members do not see the ledger.
