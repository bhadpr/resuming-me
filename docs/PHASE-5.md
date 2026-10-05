# Resuming — Phase 5: Indian company and Mumbai database

Goal: after the Play launch, the same app is owned by the Indian company, and the production database moves from Canada to Mumbai so sign-in, Today, medicines, and photos are closer to people in India.

Prerequisite: the app already in Play review is approved and live in production. This phase does not start during that review.

The Android package stays `com.cheerfulgames.resuming`. People keep the app they installed. A new company and a new database region do not get a new package name.

## What actually gets faster

The app screen is already on the phone. Slowness from India is the round trip to Supabase in Canada: sign-in, loading Today, saving a log, and loading a bottle photo.

Mumbai does not speed Health Connect, the on-device reminders, or the website. The site stays on Cloudflare. Google sign-in still talks to Google. The win is the account database and the `medicine-photos` bucket in the same region.

Supabase cannot change a project’s region in place. Mumbai means a new project. The Canada project `resuming-me-prod` (`toeemvcvizpfcyknogph`) stays the source until cutover.

## How to use this file

One task per step, in the order below. P5-01 is the gate. P5-02 and P5-03 can be prepared on paper during the wait. P5-04 builds an empty Mumbai project. Data moves only in P5-05. The website and the Android app switch together in P5-06.

## Rules

- Do not upload a bundle, transfer the Play account, or point production at a new database while the first release is still in review.
- Do not change `applicationId` / `appId` `com.cheerfulgames.resuming`, the deep link `com.cheerfulgames.resuming://auth/callback`, or the Play signing key.
- Do not commit the new anon key, service role key, or function secrets. They go in `.env`, Cloudflare production variables, and the Supabase function secrets.
- The Canada project stays online until the Mumbai build has reached installed phones. An old install keeps calling Canada until that phone updates.
- Legal pages name the Indian company only after the registered name, office address, and grievance contact exist. Do not invent them.

## Recommended order

| Order | Task | Size |
|-------|------|------|
| 1 | P5-01 Production is live | S |
| 2 | P5-02 The Indian company owns the accounts | M |
| 3 | P5-03 Privacy, terms, and the Play listing | S |
| 4 | P5-04 Empty Mumbai project | M |
| 5 | P5-05 Copy production data | M |
| 6 | P5-06 Cut over the site and the Android app | M |
| 7 | P5-07 Retire Canada | S |

## P5-01 — Production is live

Nothing in this phase runs until the reviewed bundle is approved and available on Play.

- Confirm the live listing, version code, and that sign-in, Today, and account delete work on a real phone against `resuming-me-prod`.
- Leave that release as the production app until P5-06.
- Write down the company details needed later: legal name, CIN, registered office address, grievance officer name, and a contact email. A mailbox on `resuming.me` is the address the notice should use. `resuming.me@gmail.com` can stay as a second contact until that mailbox exists.

## P5-02 — The Indian company owns the accounts

Cheerful Games, Inc. assigns the app, the domain, and the code to the Indian company. The platform then shows that company as the owner. This step changes accounts, not the Android package.

- **Play Console.** After launch, move the existing listing to an organization account for the Indian company. Google will ask for identity verification and a D-U-N-S number for an organization. Transfer the app. Do not create a second app. The upload key and Play App Signing stay with the listing.
- **Google Cloud sign-in.** Move the project that holds the OAuth client. Keep that same client. Add the new Supabase callback in P5-04. Do not delete `https://toeemvcvizpfcyknogph.supabase.co/auth/v1/callback` until P5-07.
- **Supabase.** Move organization billing and the owner email to the company. The Canada project stays until P5-07.
- **Cloudflare and the registrar.** Put the account, billing, and the `resuming.me` registrant in the company’s name. DNS and the Pages project stay. The site URL stays `https://resuming.me`.
- **Brand.** `@cheerfulgames` social links can stay. The Play “offered by” line and the copyright line change to the Indian company in P5-03.

## P5-03 — Privacy, terms, and the Play listing

Update the operator from Cheerful Games, Inc. to the Indian company. Washington law stops being the contract law. A consumer in the United States still keeps that state’s mandatory protections. The Washington My Health My Data notice stays for as long as someone in Washington can use the app.

Ship the website when the text is ready. The copy inside the app waits for the P5-06 release, so the store build and the site match.

- `COMPANY_NAME` and `GOVERNING_LAW` in `src/lib/site.ts`. Governing law becomes the laws of India, with disputes at the city of the registered office.
- In-app pages: `src/components/LegalPage.tsx`, `src/components/DeleteAccountPage.tsx`.
- Public pages, which are what `https://resuming.me/privacy` and `https://resuming.me/terms` serve: `public/privacy.html`, `public/privacy/index.html`, `public/terms/index.html`, `public/about/index.html`, `public/delete-account.html`, `public/feedback/index.html`.
- Name the company, the registered office, and a person as the grievance contact for the Digital Personal Data Protection Act, 2023.
- Say where data sits after cutover: Mumbai for the account, medicines, and bottle photos. Google sign-in stays with Google. Say Canada only while the old project is still in use.
- Play Console developer name, address, and Data safety stay aligned with that page. The privacy URL stays `https://resuming.me/privacy`.
- Deploy the site. Do not upload an Android bundle in this task.

## P5-04 — Empty Mumbai project

Create a new Supabase project in Mumbai (`ap-south-1`). Confirm Mumbai is offered in the region list on the day the project is created. Name it so it cannot be confused with Canada, and link the CLI to it only for this phase.

Apply the schema from `supabase/migrations/` in order, including medicines and the `mr` / `ta` locale check. That creates tables, RLS, and the private `medicine-photos` bucket. It does not copy users or rows.

Copy auth settings onto the empty project:

- Google provider, using the same OAuth client.
- Site URL `https://resuming.me`.
- Redirect URLs: `http://localhost:5173/**`, the Pages preview URL, `https://resuming.me/**`, `https://www.resuming.me/**`, and `com.cheerfulgames.resuming://auth/callback`.
- In Google Cloud, add `https://<mumbai-ref>.supabase.co/auth/v1/callback`. Leave the Canada callback in place until P5-07.

Deploy the functions in `supabase/functions/`:

- `delete-account`
- `rollover`
- `send-check-ins`
- `send-weekly-review`
- `classify-habit`

Set `RESEND_API_KEY`, `RESEND_FROM`, and `OPENAI_API_KEY` on the Mumbai project. `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided by Supabase on that project. Re-create the rollover cron from `supabase/migrations/20260812000000_rollover_cron.sql` only after the function URL is the Mumbai one.

Check the empty project with a test user: Google sign-in on the web, a row that only that user can read, and a bottle-photo upload to `medicine-photos`. Then delete the test user. Production phones still use Canada.

## P5-05 — Copy production data

Copy Canada into Mumbai while both projects exist. Do this at a quiet hour, soon after launch, while the install base is still small.

Include:

- `auth.users` and related auth rows, so existing Google and email sessions still belong to the same people. A schema push does not do this.
- Public tables: profiles, activities, logs, metrics, metric entries, feedback, product events, medicines, medicine times, medicine doses, and the other tables created by `supabase/migrations/`.
- Every object in `medicine-photos`, same path `{userId}/{medicineId}.jpg`.
- Auth email templates and any Resend SMTP settings that Canada uses.

Keep user ids stable. Storage paths and foreign keys depend on them.

After the copy, check a real account on Mumbai only (not the production app): the person can sign in, Today matches Canada, a medicine photo opens, and delete-account is deployed. Production is still Canada until P5-06.

## P5-06 — Cut over the site and the Android app

`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are baked in at build time. Changing Cloudflare env vars updates the website on the next deploy. The Play app updates only when a new bundle is installed. Do both on the same day.

- Freeze the window. Take a final copy from Canada of any rows and photos written after P5-05.
- Set Cloudflare production `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to Mumbai. Deploy. Check `https://resuming.me` sign-in, Today, and a medicine photo.
- Rebuild the Android app with those same values (`npm run build:android`), with a new version code. Upload that bundle only after P5-01’s release is already live. The in-app privacy and terms from P5-03 go out in this same build.
- Smoke-test on a phone that installed the new build: Google sign-in through `com.cheerfulgames.resuming://auth/callback`, Today, a medicine reminder still scheduled on the device, a bottle photo, and account export.
- Leave Canada running. Phones that have not updated still read and write Canada. Each day, copy new Canada rows and new `medicine-photos` objects into Mumbai until Play’s rollout has covered the installs you care about. Then stop accepting that drift: anyone still on the old build is told to update, and Canada becomes read-only.

Local reminders and the Health Connect step count never lived in Supabase. They stay on the phone across this cutover.

## P5-07 — Retire Canada

When new writes are landing in Mumbai and the old build is no longer in real use:

- Remove `https://toeemvcvizpfcyknogph.supabase.co/auth/v1/callback` from the Google OAuth client after a last sign-in check on Mumbai.
- Keep a final Canada backup, then pause or delete the Canada project so it cannot drift from Mumbai.
- Point the README project name and the Supabase CLI link at the Mumbai project.
- Privacy text should name Mumbai only, once Canada is no longer serving the app.
