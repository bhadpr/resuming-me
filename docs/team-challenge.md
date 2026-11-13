# Resuming — Team challenge

Status: ready to build, 4 Nov 2026. Nothing is built. Decisions below are settled. Sprints are at the end.

A challenge is either a race or a shared goal.

A race splits a WhatsApp group into 2, 3, or 4 teams for one week. The group sees which team walked more, or which team meditated more.

A shared goal is one team. Everyone adds to the same total, toward a number the organizer picks, by a date the organizer picks. A Heartfulness group can aim for a big number of hours before World Meditation Day. A family can try for a smaller total by Sunday.

People keep logging in Resuming. The morning after each day, a ready-made card is waiting for the organizer to post back into the group.

The group sees the team score only. A person sees their own number on their own screen.

## Decisions

- **One challenge, one measure.** The organizer picks Walking (steps) or Meditation (minutes). A challenge does not mix the two.
- **One team, or a race.** One team is a shared goal: a target and a last day. Two, three, or four teams is a race. The organizer chooses at the start.
- **The organizer picks the days.** The start is today, or a later day. Not a day in the past. The end is a day the organizer picks, from the start through 30 days later, counting the start. A race and a shared goal use the same span.
- **People can join before day 1.** The link works as soon as the challenge exists. Someone who joins early is a member from day 1. Someone who joins later counts from that day. There is no score before the start. The card before then shows the start date and how many have joined.
- **Walking uses the challenge clock.** The challenge stores the organizer’s timezone at creation. A walking day runs midnight to midnight on that clock. Health Connect can total steps over that window. The phone’s local midnight is not the walking day.
- **Meditation uses the log’s own date.** `log_entries.date` is the phone’s local date. Minutes typed by hand have no `started_at`, so the server cannot move a sitting onto another clock. A sitting counts on the date already stored on the log. Timer minutes and typed minutes both count.
- **Anyone signed in can start one.** This is their own group, not an admin list. Starting one does not put you on a team. An organizer can run a race for an office without walking in it, and can leave later if they did join. They stay the organizer either way.
- **Two different caps.** You can be a member of at most 5 challenges that have not ended. All 5 can be walking challenges with different groups, or mixed with meditation. Separately, you can have at most 5 challenges you created that are still open. An admin account can be in 50 and can have created 50 that are still open. Ending or deleting one frees a creator slot. The creator cap is what stops a signed-in account from minting link codes. It is separate from the membership cap.
- **The same log can count in each challenge.** Each challenge scores on its own. The same day’s steps count in every walking challenge you are in, up to all 5. The same minutes count in every meditation challenge you are in. Steps never count as minutes, and minutes never count as steps.
- **Joining takes an account.** The score needs a stable member. A guest can open the link and see the board, then sign in to join. On a race, a person joins one team and stays on it. On a shared goal, everyone who joins is on the only team.
- **A race scores averages.** Add up every joined member, then divide by how many joined. A team of 8 can beat a team of 15. A day with no log counts as zero, so missing members still sit in the average.
- **A shared goal scores a sum.** Add each person’s capped day. A missed day adds nothing. It does not pull the total down, because there is no average. More people make the target easier, which is the point of one team.
- **A member counts from the day they join.** On a race, earlier days keep the old denominator. On a shared goal, earlier days keep the old sum. Someone who arrives on day 4 does not change days 1 to 3.
- **The public number shows from the first member.** The pace or the running total appears on the group board and on a member’s own screen as soon as someone has joined.
- **A race day counts when that team had someone.** A day with nobody on the team stays out of the pace. A day with one or two people counts. A missed day is still 0.
- **A shared goal includes every day someone had joined.** The total is those days from the start. It shows as soon as one person has joined.
- **An empty race team has no score.** It is listed as waiting. It is left out of the order. It is not a zero. A shared goal has one team, so this only matters before anyone joins.
- **The server applies the cap.** Walking counts at most 10,000 steps, on a race and on a shared goal. Meditation counts at most 1 hour in one sitting. A race then counts at most 60 minutes in the day, so one long sitting cannot outrun a teammate’s short one. A shared goal counts at most 5 hours in the day. Past a cap, extra does not move the team.
- **A race board is pace.** For the days that count, average the team day scores. The share line uses that pace.
- **A shared-goal board is progress.** The running total, next to the target and the days left. The total is the sum of each frozen day’s saved team total, plus the day that is still open.
- **Public numbers are rounded.** A race compares the rounded numbers. Teams with the same rounded pace are even. The exact remainder does not pick a winner. Steps round to the nearest 100. A meditation race rounds to the nearest minute. A shared meditation goal of 100 hours or more rounds to the nearest hour. A smaller meditation goal shows hours to one decimal.
- **The group sees the team score.** On a race: name, how many joined, pace when it is visible, and order. On a shared goal: the title, how many joined, the total, the target, and the days left. No member list of numbers, no individual rank.
- **A person sees their own day in private.** What was logged, and what the cap passed through. The group still sees only the team score.
- **Steps are saved the next time the app is opened.** There is no background sync in this version. Each open sends the raw Health Connect total for every walking day that is not frozen yet. A later open replaces that raw total. It does not add to it. The server writes the capped value.
- **Walking freezes at 9:00 the next morning**, on the challenge clock. Everyone shares that one window, so 9:00 is after the day has ended for every member.
- **Meditation freezes later when the group is spread out.** A meditation date freezes at 9:00 the next morning on the challenge clock, or when that date has ended in every counting member’s `profiles.timezone`, whichever comes later. A member who joins after that date does not hold it open. A missing timezone uses the challenge timezone. The morning card waits for that freeze, so a group across India and the US gets the card a few hours after 9:00. A log that arrives after the freeze does not change the card.
- **The app does not post to WhatsApp.** The organizer taps share once. Any member can share that same card. The message has the team score only.
- **The card carries the join link.** Someone reading the group can open it, see the board, and join.
- **Walking sends the raw total only.** One number per challenge day. The step stream stays on the phone. The privacy page needs a line for the daily total.
- **Walking join is an iPhone or an Android phone.** A computer can view a walking board and cannot join. iPhone Safari can join; Apple Health steps are sent the next time the Resuming app is opened. Android sends Health Connect. A missed day still scores 0. Meditation can be joined from the web, Android, and iPhone.

## How a day is scored

The server scores the day. The app does not send a capped number.

For each member who counted that day:

1. Start from their log. No log is 0.
2. Apply the cap on the server.

Walking: the day is the challenge-clock window. The member writes one raw step total on their day row. A trigger sets capped to the raw total, or to 10,000, whichever is smaller. A capped value sent by the app is ignored.

Meditation: the day is `log_entries.date`. The app sends no total. The server sums `duration_seconds` on catalog habits for that member and that date. Each entry is one sitting and counts at most 1 hour. The sittings then count at most 60 minutes on a race, or 5 hours on a shared goal. The server writes raw (the sum before either cap) and capped (what counted) on the day row. The member does not write that row.

A trigger on `log_entries` runs after insert, update, and delete. It rescores that member’s day for the entry’s date, when that day is still open. Editing or deleting an entry from habit history does not change a frozen day. The saved team total stays as it was at the freeze.

On a race, the team day score is the sum of the capped values divided by the number of members in that count. Standing is the average of the public team day scores: frozen days on which that team had at least one member, plus the open day once that day has someone. The open day is the most recent date that has not frozen. On a meditation challenge that date can differ from a member’s own evening, so the standing does not say “today”. Rounded for display. Compared after rounding.

On a shared goal, the day adds the capped values to that day’s team total. There is no division. From the first member, standing is the sum of every frozen team day from the start, plus the open day. A meditation target is stored in minutes and shown in hours.

### Caps

One 90-minute sit counts as 60 minutes. On a race, that 60 minutes is the whole day. A second sit the same day adds nothing. On a shared goal, six separate 1-hour sits count as 5 hours. The sixth hour is over the day cap. Typing 5 hours in a single entry counts as 1 hour, because that entry is one sitting. On a race, that 1 hour is the whole day.

### Worked race day

Blue has 8 members. Seven walked 4,000. One walked 22,000.

- Seven people contribute 4,000 each.
- The long walk contributes 10,000. The rest of it is over the cap.
- Blue’s day = (7 × 4,000 + 10,000) / 8 = 4,750 steps.

Green has 15 members. Ten walked 6,000. Five did not log.

- Green’s day = (10 × 6,000) / 15 = 4,000 steps.

Blue leads that day by 750 steps a person. The morning card uses the pace across the public days so far, rounded to the nearest 100, and says “a day”.

### Worked shared goal

The target is a number of hours the organizer chose. Three or more people have joined, so earlier days are in the total. On this day, 40 people each sat one hour. The rest did not log.

- Each sitter contributes 60 minutes. 40 × 60 = 2,400 minutes = 40 hours.
- Those 40 hours are added to that day’s saved team total. People who missed the day add nothing.
- The morning card shows the sum of the saved days, the target, and the days left.

## When the steps are saved

Health Connect is read while Resuming is open. The read for a walking challenge is the sum from midnight to the next midnight on the challenge clock.

Each open, before 9:00 the next morning, sends that raw sum for the open day and for any earlier walking day in the challenge that is not frozen. The saved raw value is the latest read. The server sets the cap.

At 9:00 on the challenge clock, yesterday freezes. The server writes one saved total for each team: the capped sum, and how many members counted that day. The official card reads those saved rows. It does not add up every member’s every day. The day that is still open is the only one computed from member rows, so a daytime “so far” card stays current.

A person who opens after the freeze still sees their own steps, with a note that the day’s card already closed.

Each walking member gets one nudge 2 hours before the freeze, on their own clock. With a Seattle organizer, an India member’s freeze is 22:30 IST, so the nudge is at 20:30 IST. The nudge says to open Resuming so today’s walk is in the score. Background sync can come later if those late opens keep missing the freeze. It is not part of this version.

A daytime share is allowed, and its line says “so far”. Those numbers can still change until the freeze. The morning card is the record.

## When a meditation day freezes

A sitting is stored on the member’s own date. The freeze still has to wait until that date is over for the member furthest west.

The date freezes at the later of these two:

- 9:00 the next morning on the challenge clock.
- The moment that date has ended in every timezone of members who counted that day. The server reads `profiles.timezone`. A member who was not on the team that day does not count. A missing timezone uses the challenge timezone.

The organizer is in India. A member is in Seattle. The Seattle member’s 5 November ends at midnight Pacific, which is 13:30 in India on 6 November. That is later than 9:00 in India, so 5 November stays open through the Seattle evening. The sit at 8 pm in Seattle still counts. The morning card goes out after that midnight, a few hours after 9:00 in India.

When every member is on the challenge clock, or east of it, their local date is already over by 9:00. The card goes out at 9:00.

Walking does not use this rule. Walking is one window on the challenge clock, and it freezes at 9:00.

## The morning card

Ready at the freeze. On a phone, one local nudge tells the organizer the card is ready. On the web there is no nudge, so Today says “Card ready, share” until they share it. The same words show on the phone, next to the nudge. If they belong to the challenge, the words are on that challenge’s line. If they only run it, the words are on the “Challenges you run” line.

The message is what the group reads. The preview image is not the scoreboard.

A race:

> Day 4: Blue leads. Green is 300 steps a day behind, Red 800, Yellow 1,200.
> https://resuming.me/t/k7mhp3wq9rtd

A two-team week names the leader and the gap only. “Day 4: Blue leads, Green is 300 steps a day behind.” A tie on the rounded pace says the named teams are even.

The morning after day 7, the race card names the winner. “Final: Blue wins. Green finished 300 steps a day behind.” A rounded tie says they finish even.

A shared goal:

> Day 40: 420 of 1,000 hours. 580 hours to go, 20 days left.
> https://resuming.me/t/k7mhp3wq9rtd

If the total reaches the target before the last day, the card says so and the count keeps going. “Goal reached: 1,000 hours, with 20 days left.”

The morning after the last day, the card closes the goal. “Final: 1,040 of 1,000 hours. Goal reached.” Or “Final: 880 of 1,000 hours.”

A daytime share uses the same shape with “so far” in the first line.

Before the start date, the card names the day it begins and how many have joined. It shows no score.

From the first member, a race card shows the pace and a shared-goal card shows the total. A day with nobody on a race team stays off that team’s pace.

### WhatsApp preview

The app page is the same HTML for every link, so WhatsApp would show one generic card. `resuming.me/t/<code>` is handled by the same Cloudflare worker that already rewrites `resuming.me/e/<code>` for events. That only happens if `wrangler.toml` lists the path. Today `run_worker_first` is `["/e/*", "/c/*"]`. Add `"/t/*"`.

The worker loads that code’s board and rewrites the title and description, the same way it already rewrites them per event. The score lives in that text. “Day 4: Blue leads. Green is 300 steps a day behind.”

The image is fixed. One image for walking, one for meditation, the same kind of file as `og-nfl.jpg`. Nothing in the app draws a picture today, and event previews use a photo or one of those fixed images. A scoreboard drawn when the day freezes is not part of this version.

## Who can join a walking team

- **Android, Health Connect, steps already there.** They join. The phone sends one raw total per challenge day.
- **Android, Health Connect, no step source yet.** Many phones only have steps after Google Fit or Samsung Health is writing them. They may join after the screen says empty days score 0 until that app is connected. They confirm, then they count.
- **A computer, and Android without Health Connect.** They can open the board. A computer cannot join. They can still start a walking challenge and run it without joining. An iPhone can join. Steps from Apple Health arrive when the Resuming app is opened.

## What counts as meditation

Only catalog habits. The server knows them by `template_id`: Meditation, Bhastrika, Kapalabhati, Anuloma Viloma, Bhramari, Prayer, and Rejuvenation. Rejuvenation is Heartfulness cleaning. Renaming the habit does not matter. The catalog id does.

A custom habit someone named “Meditation” has no catalog id, so it does not count.

Timer minutes and minutes typed by hand both count. Each entry is one sitting, dated with `log_entries.date`. Reading, study, and other timers do not count. Relaxation does not count, because it is a checkbox and has no minutes.

A Heartfulness group can sit together and type the minutes afterward. One typed entry still counts at most 1 hour. A race day still counts at most 60 minutes. A shared-goal day still counts at most 5 hours.

## What a person sees

On their own screen, for the current day:

- The full count from the phone or the log.
- The amount that counted after the cap. For a long sit, this can be 1 hour of a longer entry. On a race, the day stops at 60 minutes. On a shared goal, the day stops at 5 hours.
- The team board, from the first member. Same numbers as the group. A race shows pace. A shared goal shows the running total, the target, and the days left.
- The freeze time. Walking shows the challenge clock and the person’s own clock. Meditation shows the log’s date, and the time that date actually freezes, which can be later than 9:00 on the challenge clock.

The group page, the share message, and the link preview show the team board only.

## Where it shows

No new tab. The bottom bar stays Today, Habits, Reminders, and Health.

- **Today.** One line for each challenge you belong to, at most three, including three walking challenges with different groups. A race shows the pace. A shared goal shows the total, the target, and the days left. Under that, a private line shows your own day: what you logged, and what counted after the cap. The line shows the score from the first person who joins. Before anyone joins, it says how many have joined. Challenges you organize and do not belong to fold into one line, “Challenges you run”. That line names the challenge when there is only one. When there are several, it shows the count, and “Card ready, share” when any card is waiting. Tap it to open the list, with the ready one marked. Today never shows a separate line per challenge you only run, so the screen stays at most those three lines plus this one. Tap a membership line to open that challenge. The Steps card on Today stays your own steps against your own goal. The challenge does not replace it.
- **The challenge screen.** The same board the group sees. Your own day, on this screen only, and only if you are a member. Share, which opens the WhatsApp sheet with the message. Leave, if you are a member. For the organizer: edit the name, the pictures, the team names, the WhatsApp groups, and the end date. The end stays within 30 days of the start, counting the start. Copy the link, switch the link off, end the challenge, and delete it before anyone else has joined. Leaving does not remove you as the organizer.
- **Starting a walking challenge.** On the Steps habit, and on the Steps card. Steps are the `steps` template. The Walking habit is a timer in minutes, so it does not start a walking challenge. The form asks race or shared goal, then the team names or the target, then the start and, for a goal, the last day. Each team, including Everyone, can have a WhatsApp group link. The link is optional. Joining the challenge does not join the group. Joining is a separate choice. On a race, that choice asks which team. An organizer on a computer can start it and skip joining. An iPhone organizer can join too.
- **Starting a meditation challenge.** On Meditation, a pranayam, Prayer, or Rejuvenation. The same form. Joining is a separate choice. On a race, that choice asks which team.
- **The join page.** `resuming.me/t/<code>`, in the browser and in the app, the same way an event opens from `resuming.me/e/<code>`. The board, the start date, and a join button. A guest can read it. Joining asks for an account, then a team on a race. This page has no private numbers.
- **WhatsApp.** The message carries the score. The preview image is the fixed walking or meditation image. That post is not a screen in the app.
- **Two nudges, on the phone.** A nudge to each walking member 2 hours before the freeze, on that member’s clock. A morning nudge to the organizer when the card is ready. The web has no nudge. The Today line carries “Card ready, share” in both places.

Insights stays personal. A challenge score does not appear there. Settings does not get a new page. Leave and the organizer’s controls live on the challenge screen.

## Ending

- **Before anyone other than the organizer is a member,** the organizer can delete the challenge. The link dies. The organizer does not count as a member unless they joined, so a challenge they only run can be deleted until the first person joins. If they joined and are still the only member, they can delete it too.
- **After someone else has joined,** the organizer can end it early and can switch the join link off. Ending freezes the last finished day and drops the unfinished day. A final card is ready. Members do not lose the challenge to a hard delete.
- **Leaving starts the next day.** Today still counts, including a zero if they have not logged. Frozen days stay as posted. From tomorrow they are out of the team, so a zero from leaving does not come off today’s average.
- **A race cannot be rejoined.** Leaving a race is for the rest of that challenge. Coming back the next day would drop a zero out of the average.
- **A shared goal can be rejoined.** They come back to the same team on a day after the leave has taken effect, and they count again from that day. The days in between add nothing. There is no average to protect. They cannot move to another team. If they cancel the leave before the next midnight on the challenge clock, they never left.

If a leave leaves a race team empty, later days stay off that team’s pace. A shared goal keeps the total while someone is still in it. Saved days stay as they were.

## Server

Row Level Security lets a person read their own logs only. The group board cannot be a client query over other people’s rows.

A `security definer` function, `get_challenge_board(code)`, returns the public score and no user ids. For a race: team name, member count, and rounded pace. Pace is null while that team has nobody. For a shared goal: title, member count, rounded total, target, and days left. The total is null until someone has joined. A second function returns the caller’s own day, and only that row.

Walking: the member can write their day row, and only the raw total, until that day is frozen. The server sets capped. The server does not check that raw total against Health Connect. A member who writes a made-up number through the API can fill their own day up to the 10,000 cap. That is an accepted limit of this version, not a bug. The cap is what keeps the made-up number from carrying the team.

Meditation: the member does not write a day row. A trigger on `log_entries` calls the scoring function for that member and that entry’s `date`, if the day is still open. The function keeps catalog `template_id`s, applies the sitting cap and the day cap, and writes raw and capped. A frozen day is left alone.

When the day freezes, the server saves one row per team for that day: capped sum, and member count. The board reads those rows for every finished day. It recomputes only the day that is still open. A long goal with hundreds of members does not sum every member-day on each view.

Suggested tables: the challenge (code, owner, kind, shape, timezone, start, end, target, status), teams, one row per stretch of membership (user, team, joined on, left on), one row per member per challenge day (raw, capped), and one saved row per team per frozen day (capped sum, member count). A shared goal can have several stretches for the same person, so a return counts again from the new joined-on date and the days in between add nothing. A race has one stretch per person, because a race cannot be rejoined. A shared goal has one team row. Its target is required. A race has two to four team rows and no target. The owner is not a stretch unless they joined.

The link is `resuming.me/t/<code>`, on the same path shape as Phase 8’s `resuming.me/e/<code>`: a public page, the WhatsApp share sheet, and Android App Links. The Cloudflare worker rewrites the title and description for that code, the same way it rewrites `/e/`. `run_worker_first` in `wrangler.toml` gains `"/t/*"`. The preview image is a fixed walking image or a fixed meditation image. The code is 12 characters from the shared-event alphabet (no 0, o, 1, l, or i). A six-character code is too easy to guess. The Play install referrer from Phase 6 carries `challenge=<code>`, the same way an event carries `event=<code>`. Both can travel together. Unknown codes are rate-limited.

## Not in this version

- A comeback bonus. Coming back is still the idea of the app. This challenge does not pay extra for it yet.
- Individual rankings, even inside a team.
- Badges, levels, or a streak to protect.
- A challenge that mixes steps and minutes.
- The app posting into WhatsApp by itself.
- Changing team mid-week, or rejoining a race.
- A member’s name next to a score.
- Background step sync. Opening the app is what saves the day.
- Computer members on a walking challenge.
- A shared goal with no target, or a one-team race.
- A start date in the past.
- A drawn scoreboard image. The preview uses a fixed image, and the score is in the text.
- Checking a walking total against Health Connect. The server trusts the raw number the member writes, then caps it.

## How to use this file

Two phases. Phase 1 is walking, and it launches on its own. Phase 2 is meditation, and it starts only after Phase 1 is live.

Finish each sprint before the next. Every new string ships in all seven languages in the sprint that adds it. The challenge table has a kind from the start, and Phase 1 only offers Walking.

## Phase 1 — Steps

| Sprint | Done when | Size |
|--------|-----------|------|
| 1. Create and join | An organizer can start a walking challenge without joining, share one link, and three people can join | L |
| 2. Steps score | Opening the Android app updates the team total, and the group still cannot see a person’s steps | L |
| 3. Freeze and the morning line | The total stops changing at 9:00, and the organizer can paste the line into WhatsApp | L |
| 4. Leave and come back | A shared goal records a gap, and a race leave is final | M |
| 5. The link in WhatsApp | The preview shows that challenge’s step score, and a new install can land on the join page | M |

Phase 1 launches when Sprint 5 is done. A group can race on steps, or add steps toward one target, for a week or until a chosen date.

### Sprint 1 — Create and join

The roster works. Nothing is scored yet. The form offers Walking only.

- Tables: the challenge (including kind), its teams, and one row per stretch of membership (user, team, joined on, left on). The owner is not a stretch unless they join.
- A 12-character code from the shared-event alphabet. Unknown codes are rate-limited.
- Row Level Security: a person reads their own stretch only. `get_challenge_board(code)` returns team names and member counts. No user ids.
- The start form, from the Steps habit and the Steps card: race or shared goal, team names or a step target and last day, start date today or later. The Walking timer habit does not start a challenge. Joining is a separate choice. On a race, that choice asks which team.
- Caps: at most 5 challenges as a member, at most 5 open challenges created. An admin account can do 50 of each. A person on a computer can start a walking challenge and cannot join it. An iPhone can join.
- The join page at `resuming.me/t/<code>` shows the board with counts only, the start date, and Join. A guest can read it. Joining asks for an account. An iPhone and an Android phone with Health Connect can join. A computer can view and cannot join. A phone with no step source can join only after the warning that empty days score 0.
- The organizer can copy the link, switch it off, and delete the challenge before anyone other than them is a member.

### Sprint 2 — Steps score

The number is still live. The screen says “so far” until Sprint 3 freezes it.

- On open, the app sends the raw total for each walking day that is not frozen. The window is midnight to midnight on the challenge clock. A later open replaces the raw total. The server caps it at 10,000. It does not check the number against Health Connect. The member sends raw only.
- A race score is the average of joined members. A missed day is zero. A shared goal is a sum of capped steps. A missed day adds nothing.
- The public number shows from the first member. A race counts a day when that team had someone. A shared goal includes every day from the start.
- The challenge screen shows the same board the group sees, plus that person’s own day only on their own screen.
- The same day’s steps can count in each walking challenge they belong to, up to three.

### Sprint 3 — Freeze and the morning line

This is the post that brings people back. Walking freezes at 9:00 the next morning on the challenge clock. Opening after that still shows the person’s own steps, and the team total stays as posted.

- At the freeze, save one row per team: capped sum and member count. The board reads those rows. It recomputes only the open day, the most recent date that has not frozen.
- Share opens the WhatsApp sheet with the message. A race: “Day 4: Blue leads. Green is 300 steps a day behind.” A shared goal: “Day 4: 420,000 of 1,000,000 steps. 580,000 steps to go, 3 days left.” A daytime share says “so far”. The morning after the last day names the winner, or says whether the goal was reached.
- Today shows one line per walking challenge you belong to, at most three. Challenges you only run fold into one “Challenges you run” line. When the card is ready, that line says “Card ready, share” on the web and on the phone. A phone also nudges the organizer.
- Each walking member gets one nudge 2 hours before the freeze, on their own clock.

### Sprint 4 — Leave and come back

- Leaving starts the next midnight on the challenge clock. Today still counts, including a zero. Canceling the leave before that midnight means they never left.
- A shared goal can be rejoined. That is a new stretch. The days in between add nothing.
- A race cannot be rejoined.
- They cannot move to another team. The organizer can leave and stays the organizer.
- After someone else has joined, the organizer can end the challenge early or switch the link off. Ending freezes the last finished day and drops the unfinished one. A final message is ready.
- If a race team becomes empty, later days stay off its pace. A shared goal keeps showing the total while someone remains. Saved days stay as posted.

### Sprint 5 — The link in WhatsApp

Phase 1 launches at the end of this sprint.

- Add `"/t/*"` to `run_worker_first` in `wrangler.toml`. The worker rewrites the title and description for that code, the same way it rewrites `/e/`. The step score is in that text.
- One fixed preview image for walking. No drawn scoreboard.
- The Play install referrer carries `challenge=<code>`, the same way an event carries `event=<code>`. An Android phone without the app goes to Play and opens the join page on the first open.
- Android App Links for `resuming.me/t/*` open the app on that challenge. This ships in a new Android version code.
- iPhone universal links open the app on that challenge. An iPhone can start a walking challenge, view the board, and join. Apple Health steps are sent when the app is opened.

## Phase 2 — Meditation

Starts after Phase 1 is live. The tables, the join page, Today, leave, and the WhatsApp link already exist. This phase adds minutes.

| Sprint | Done when | Size |
|--------|-----------|------|
| 6. Meditation score | A sit updates the team total, and the group still cannot see a person’s minutes | L |
| 7. Meditation freeze and the hours line | A sitting after 9:00 still counts for a member further west, and the morning line is in hours | M |

### Sprint 6 — Meditation score

- The start form offers Meditation as well as Walking, from Meditation, a pranayam, Prayer, or Rejuvenation.
- The server sums `duration_seconds` from `log_entries` for that member and that log date. Catalog ids only: Meditation, Bhastrika, Kapalabhati, Anuloma Viloma, Bhramari, Prayer, Rejuvenation. A custom habit named Meditation does not count. Timer minutes and typed minutes both count.
- Each sitting counts at most 1 hour. A race day counts at most 60 minutes. A shared-goal day counts at most 5 hours. The server writes raw and capped. The member does not send a total.
- A trigger on insert, update, and delete rescores that member’s open day. The number says “so far” until Sprint 7 freezes it.
- The same public rules as steps: the score shows from the first member, a race average counts days that had someone, and a shared-goal sum includes every day from the start.
- The same minutes can count in each meditation challenge the person belongs to. Membership is at most 5 challenges of either kind.

### Sprint 7 — Meditation freeze and the hours line

- A meditation date freezes at 9:00 the next morning on the challenge clock, or when that date has ended in every counting member’s `profiles.timezone`, whichever is later. A missing timezone uses the challenge timezone. A member who was not on the team that day does not hold it open.
- Editing an old log does not change a frozen day.
- The morning line uses hours. “Day 40: 420 of 1,000 hours. 580 hours to go, 20 days left.” The walking line does not change.
- A second fixed preview image, for meditation. The worker picks it from the challenge kind.

## Not in these sprints

The list in “Not in this version” stays out. In particular: a comeback bonus, a drawn scoreboard, background step sync, and checking steps against Health Connect. Meditation is Phase 2, not a cut.
