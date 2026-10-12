# Release 1.0.4 (version code 7)

## Release notes (en-IN, max 500)

New in this version:
• Share an event on WhatsApp, with a photo. Family and friends add it to their reminders in one tap.
• Add a description and a photo to any reminder. The photo shows in place of the icon.
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

Three answers change. Everything else stays as it is.

**Photos and videos → Photos** (new)
- Collected: yes. A person may add one photo, such as an invitation card, to a reminder. The app shrinks it and strips location details before upload. It stays private to their account unless they share the reminder as an event; then anyone with the event link sees it.
- Shared: no. Others see it only because the organizer chose to share the link, which Play does not count as sharing.
- Processed ephemerally: no. Required: no (optional). Purpose: App functionality.
- Deleted with the reminder, with the account, and (for the event's copy) when we switch an event off.

**App activity → Other user-generated content** (already declared for reminders in Phase 7)
- Collected: yes. Unchanged.
- Shared: no. A shared event's text is seen by others only when the user chooses to share its link. Play does not count a transfer the user starts and expects as sharing.
- Processed ephemerally: no. Required: no. Purpose: App functionality. Unchanged.

**Device or other IDs**
- Collected: yes. When someone adds or reports a shared event, an anonymous id for their device is stored so a guest's copy can be counted, told about a cancel, and moved to their account at sign-in.
- Shared: no. Processed ephemerally: no. Required: no.
- Purpose: App functionality. If this type is already declared for analytics, add App functionality to its purposes rather than adding a second entry.

**Not collected, no change**
- Contacts and phone numbers: the organizer never sees who added an event.

The privacy policy at https://resuming.me/privacy describes reminder photos, shared events, their description and photo, the From line, and the anonymous device id (updated October 9).
