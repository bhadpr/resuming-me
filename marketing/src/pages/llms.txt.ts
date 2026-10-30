import type { APIRoute } from 'astro'
import { en } from '../i18n/en'
import { APP_URL, CONTACT_EMAIL, COMPANY, PLAY_LISTING_URL, PLAY_LIVE, SITE_URL, WEB_APP_URL } from '../site'
import { THEMES } from '../themes'

/** A plain summary for AI tools. It is built from the same copy and settings as the page, so it cannot drift. */
export const GET: APIRoute = () => {
  const faq = en.faq.items
    .map((item) => `- ${item.q} ${!PLAY_LIVE && 'aSoon' in item ? item.aSoon : item.a}`)
    .join('\n')

  const body = `# Resuming

> Resuming (by ${COMPANY}) is a free habit, health and reminder app. It keeps a day's small habits (walking, water, Pranayam), health numbers such as blood pressure, weight and steps, and the family's dates (bills, doctor visits, birthdays, weddings) in one list called Today. When someone misses a day, it offers a smaller step to start again instead of a broken streak. It is free, has no ads, does not sell data, and works in English, Hindi, Gujarati, Marathi, Telugu, Tamil and Bengali.

Resuming is a wellness and habit app. It is not a medical device and does not give medical advice.

## Key facts

- Name: Resuming (also written "Resuming app"). Maker: ${COMPANY}
- Price: free. No ads. Your data is not sold.
- Languages: English, Hindi, Gujarati, Marathi, Telugu, Tamil, Bengali.
- Works in any web browser at ${APP_URL}, with no account needed to try. ${PLAY_LIVE ? `The Android app (Android 7.0 or newer) is on Google Play: ${PLAY_LISTING_URL}` : 'The Android app (Android 7.0 or newer) is coming soon to Google Play.'}
- Habits can have a timer, a count, or a simple tick, with follow-along videos for Kapalabhati, Anulom Vilom and Bhramari, and any YouTube link can be added to a habit.
- Personal reminders (bills, doctor visits, birthdays, festivals) are private and wait on Today until done. Family and community events, such as a wedding or a puja, can be shared on WhatsApp so everyone who opens the link adds it to their own reminders; only the From line the sender types is shown, never their email or phone number.
- Insights shows each habit day by day over 7 or 30 days, including how often someone came back after a gap.
- Vitals (blood pressure, heart rate, weight, steps, water, protein, fasting, sleep) are charted over time. Steps are read from Health Connect on Android and stay on the phone.

## Pages

- [Home](${SITE_URL}/): what Resuming does, how it works, screenshots, and the questions below.
- [About](${SITE_URL}/about/): who makes it, the idea behind it, languages, and contact.
${THEMES.map((theme) => `- [${theme.copy.h1}](${SITE_URL}/${theme.slug}/): ${theme.copy.sub}`).join('\n')}
- [Try it in your browser](${WEB_APP_URL}): the web app, no account needed to try.
- [Privacy policy](${APP_URL}/privacy): what is collected and why.
- [Terms](${APP_URL}/terms)

## Questions

${faq}

## Contact

${CONTACT_EMAIL}
`

  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
