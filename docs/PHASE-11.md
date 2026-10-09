# Resuming — Phase 11: Social accounts

Goal: Resuming has its own Facebook Page, Instagram account, YouTube channel, and WhatsApp Channel, all with the same name, picture, and tagline. The website footer links to them instead of the Cheerful Games placeholders.

TikTok is dropped because it is banned in India. The WhatsApp Channel takes its place.

## How to use this file

Milestone 0 first, then the accounts in order, then the footer. Facebook comes before Instagram because Instagram links to the Facebook Page. Milestones 1 to 4 are done by hand on the platforms, with no app code. Milestone 5 is the only code change and waits for the four links.

## Rules

- One shared brand email for every account, not a personal one. Use the Google account that owns Play Console, since YouTube needs a Google account anyway.
- The same handle everywhere, if it is free.
- The same name, picture, and tagline everywhere.
- Two-factor sign-in on every account, with recovery codes kept somewhere safe.
- Nothing is posted until all four exist and the footer points to them.

## Recommended order

| Milestone | Task | Size |
|-----------|------|------|
| M0 Before the accounts | P11-01 Email, handle, and files | S |
| M1 Facebook | P11-02 Facebook Page | S |
| M2 Instagram | P11-03 Instagram professional account | S |
| M3 YouTube | P11-04 YouTube channel | S |
| M4 WhatsApp | P11-05 WhatsApp Channel | S |
| M5 Website | P11-06 Footer links | S |

## Milestone 0 — Before the accounts

At the end of M0, the email, handle, and images are ready, so each account takes a few minutes.

### P11-01 — Email, handle, and files

- Email: the Google account that owns Play Console.
- Handle: try `resumingapp` first, then `resuming.me` (only Instagram allows the dot), then `getresuming`. Check it is free on all four before creating any.
- Name: **Resuming: Habits & Reminders**. Where the name must be short, use **Resuming**.
- Bio: "Track your day, gently. Missed a day? Just resume." and the link `https://resuming.me`.
- Images, all made in Phase 8:
  - Profile picture for every account: `play-listing/social/profile-1080.png`
  - Facebook cover: `play-listing/social/facebook-cover-1640x624.png`
  - YouTube banner: `play-listing/social/youtube-banner-2560x1440.png`
- The Play Store link to the app, for the places that take a second link.

## Milestone 1 — Facebook

At the end of M1, `facebook.com/<handle>` shows the Resuming Page with its picture, cover, and link.

### P11-02 — Facebook Page

- A Page, not a personal profile. The Page hangs off a personal Facebook account, but that person's name does not show on it.
- Log in to Facebook, then open [facebook.com/pages/create](https://www.facebook.com/pages/create).
- Page name: the name from P11-01. Category: **App Page**. Bio: the tagline.
- Add the profile picture and the cover photo.
- In the Page settings:
  - Set the username to the handle.
  - Add the website `https://resuming.me` and the contact email.
- Click **Add button**, choose **Learn more** or **Use app**, and paste the Play Store link.

## Milestone 2 — Instagram

At the end of M2, `instagram.com/<handle>` is a professional account linked to the Facebook Page.

### P11-03 — Instagram professional account

- In the Instagram app, choose **Create new account** and sign up with the shared email.
  - The Page's settings can also create one, under **Linked accounts**, then **Instagram**.
- Username: the handle. Name: the name from P11-01.
- Fill in the profile:
  - Add the profile picture.
  - Bio: the tagline.
  - Links: add `https://resuming.me`.
- Switch to a professional account:
  - Go to **Settings**, then **Account type and tools**, then **Switch to professional account**.
  - Choose **Business**, with the category **App Page**.
- When it asks, connect the account to the Facebook Page. [Meta Business Suite](https://business.facebook.com) can then post to both at once.

## Milestone 3 — YouTube

At the end of M3, `youtube.com/@<handle>` shows the channel with its picture, banner, and links.

### P11-04 — YouTube channel

- Sign in to YouTube with the shared Google account, then click the avatar, then **Create a channel**.
- If it offers a custom name, use **Resuming**. That makes it a Brand Account, so other managers can be added later without sharing a password.
- Open [YouTube Studio](https://studio.youtube.com), then **Customization**:
  - **Branding:** upload the profile picture and the banner. Use the crop preview to check the desktop strip.
  - **Basic info:**
    - Handle: `@` plus the handle.
    - Description: the tagline and a line about the app.
    - Links: add `https://resuming.me` and the Play Store link.
- Verify the channel by phone at [youtube.com/verify](https://www.youtube.com/verify). This unlocks custom thumbnails and longer videos.

## Milestone 4 — WhatsApp

At the end of M4, there is a `whatsapp.com/channel/...` link that opens the Resuming channel.

### P11-05 — WhatsApp Channel

- Use the WhatsApp account on the phone number the business will keep. The channel cannot be moved to another number later.
- In WhatsApp, open the **Updates** tab, tap **+**, then **Create channel**.
- Name: **Resuming**. Description: the tagline and `https://resuming.me`. Icon: the profile picture.
- Open the channel info, then **Share link**, and copy the link.

## Milestone 5 — Website

At the end of M5, the website footer shows Facebook, Instagram, YouTube, and WhatsApp icons, each opening the real account.

### P11-06 — Footer links

- In `src/lib/site.ts`, replace the placeholder `SOCIAL_LINKS` with the four real links.
- Replace `tiktok` with `whatsapp` in the `SocialLink` id type and the list.
- In `src/components/SiteFooter.tsx`, swap the TikTok icon for a WhatsApp icon.
- Check the footer on the landing page and on About, Privacy, Terms, and Feedback, on a phone width and a desktop width.
