# Release 1.0.6 (version code 9)

Signed bundle: `android/app/build/outputs/bundle/release/app-release.aab`

Same sign-in address as 1.0.5 (`https://api.resuming.me`). This build is the one to send to production.

## Release notes (en-IN, max 500)

New in this version:
• Pick several community days, then add them together.
• Open a habit to see its history before you sign in.
• A short guide explains the four buttons at the bottom.
• Editing a habit uses the same simple choices as when you added it.

## Play Console, in this order

1. **Main store listing → Phone screenshots.** Replace the images with the eight files in `screenshots/`, in this order:
   1. `01-today.png` — One list for your whole day
   2. `02-habits.png` — Small steps count
   3. `03-pranayam.png` — Follow along, one breath at a time
   4. `04-vitals.png` — Blood pressure, weight, and water
   5. `05-reminders.png` — Bills, visits, birthdays: never forget
   6. `06-diwali.png` — Pick the days you want to remember
   7. `07-mall.png` — Meet friends at Inorbit Mall
   8. `08-setup.png` — Set up in a minute
2. **Closed testing → Create new release.** Upload the AAB above and paste the release notes.
3. **Production.** After Google approves production access, create the production release with this same AAB and these notes. Do not send 1.0.5.

Data safety does not change in this version.
