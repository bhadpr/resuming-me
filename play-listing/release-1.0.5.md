# Release 1.0.5 (version code 8)

Signed bundle: `android/app/build/outputs/bundle/release/app-release.aab`

This build signs in through `https://api.resuming.me`. Phones still on 1.0.4 keep the old address until they install this one.

## Release notes (en-IN, max 500)

New in this version:
• Sign in with Google. The Google screen now says resuming.me.
• Today shows a short note when nothing is on the list yet.

## Play Console, in this order

1. **Main store listing → Phone screenshots.** Replace the images with the eight files in `screenshots/`, in this order:
   1. `01-today.png` — One list for your whole day
   2. `02-habits.png` — Small steps count
   3. `03-pranayam.png` — Follow along, one breath at a time
   4. `04-vitals.png` — Blood pressure, weight, and water
   5. `05-reminders.png` — Bills, visits, birthdays: never forget
   6. `06-diwali.png` — Add Diwali in one tap
   7. `07-mall.png` — Meet friends at Inorbit Mall
   8. `08-setup.png` — Set up in a minute
2. **Full description.** Change the sign-in line to: “Try it without an account. Sign in with Google to keep your data safe.” Also change the languages line to: “English, हिन्दी, ગુજરાતી, मराठी, తెలుగు, தமிழ் and বাংলা”. The app ships Bengali, and the site and posts say seven languages.
3. **Apply for production.** On Production, click **Apply for production** and answer the closed-test questions. The three checks are already green. Google reviews the answers before a production release can be created.
4. **Closed testing → Create new release** (do this now, so testers get the new sign-in address while production is in review). Upload the AAB above and paste the release notes.
5. **After production access is approved: Production → Create new release.** Upload the same AAB, paste the release notes, and roll out.

Data safety does not change in this version.
