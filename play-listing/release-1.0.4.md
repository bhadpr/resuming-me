# Release 1.0.4 (version code 7)

## Release notes (en-IN, max 500)

New in this version:
• Share an event on WhatsApp. Family and friends add it to their reminders in one tap.
• Reminders have their own tab. The tabs are now Today, Activity, Reminders and Health.
• Insights moved to the chart icon at the top, next to Settings.
• A clearer reminder page: see it, edit it, share it.
• Past reminders no longer clutter the list.

## Play Console, in this order

Do these after the website is deployed, so shared links work when the app goes live.

1. **Main store listing**
   - App name: `Resuming: Habits & Reminders`
   - Short description: `Track your day, gently. Missed a day? Just resume.`
   - Full description: copy from `listing-en.md`.
   - Feature graphic: `feature-graphic.png`
   - Phone screenshots: remove the old five, upload the six in `screenshots/` in file order.
2. **App content → Data safety** (changes below).
3. **Production → Create new release**: upload `android/app/build/outputs/bundle/release/app-release.aab`, paste the release notes above, roll out.

## Data safety changes

Only two answers change. Everything else stays as it is.

**App activity → Other user-generated content** (already declared for reminders in Phase 7)
- Collected: yes. Unchanged.
- Shared: no. A shared event's text is seen by others only when the user chooses to share its link. Play does not count a transfer the user starts and expects as sharing.
- Processed ephemerally: no. Required: no. Purpose: App functionality. Unchanged.

**Device or other IDs**
- Collected: yes. When someone adds or reports a shared event, an anonymous id for their device is stored so a guest's copy can be counted, told about a cancel, and moved to their account at sign-in.
- Shared: no. Processed ephemerally: no. Required: no.
- Purpose: App functionality. If this type is already declared for analytics, add App functionality to its purposes rather than adding a second entry.

**Not collected, no change**
- Photos: a photo added to a share goes from the phone straight to WhatsApp. It is never uploaded.
- Contacts and phone numbers: the organizer never sees who added an event.

The privacy policy at https://resuming.me/privacy already describes shared events, the From line, and the anonymous device id.
