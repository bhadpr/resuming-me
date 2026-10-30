/** Theme landing pages. English is the page source. Other languages are drafts in needsReview.ts. */

export type ThemeSlug =
  | 'diwali'
  | 'cricket'
  | 'pranayam'
  | 'steps'
  | 'meetup'
  | 'nfl'
  | 'school-holidays'
  | 'running'

export type ThemeSection = 'calendar' | 'sports' | 'habits' | 'steps' | 'meetup' | 'school' | 'insights'

export type ThemeCopy = {
  h1: string
  sub: string
  h1After?: string
  subAfter?: string
  /** Inclusive last day the first headline is shown. After this, h1After is used. */
  activeUntil?: string
  kicker: string
  heading: string
  body: string
  points: string[]
  items?: { name: string; meta: string }[]
  steps: { title: string; body: string }[]
  note?: string
  coverage?: string
}

export type Theme = {
  slug: ThemeSlug
  market: 'india' | 'us' | 'both'
  languages: 'all' | 'en'
  firstSection: ThemeSection
  showWellnessDisclaimer?: boolean
  showAndroidStepsNote?: boolean
  showSchoolWaitlist?: boolean
  showRunningNote?: boolean
  copy: ThemeCopy
}

const wellness = 'Resuming is a wellness and habit app. It does not give medical advice.'
const stepsNote = 'Steps need an Android phone with Health Connect. They stay on the phone.'

export const THEMES: Theme[] = [
  {
    slug: 'diwali',
    market: 'india',
    languages: 'all',
    firstSection: 'calendar',
    copy: {
      h1: 'Diwali is Sunday, Nov 8.',
      sub: 'Add Dhanteras, Diwali and Bhai Dooj to your Today in one tap.',
      h1After: 'Chhath is Sunday, Nov 15. Dev Diwali is Wednesday, Nov 25.',
      subAfter: 'Keep every festival on your Today.',
      activeUntil: '2026-11-10',
      kicker: 'Diwali 2026',
      heading: 'Five days of Diwali, already on your Today',
      body: 'Dhanteras on Friday, Nov 6. Diwali on Sunday, Nov 8. Bhai Dooj on Tuesday, Nov 10. Tap Add once and they wait on Today like any reminder you typed.',
      points: [
        'Add the festival dates in one tap',
        'Share your puja or Diwali party with the family on WhatsApp; each person adds it to their own Today',
        'A day-before alert on Android',
      ],
      items: [
        { name: 'Dhanteras', meta: 'Fri, Nov 6' },
        { name: 'Diwali', meta: 'Sun, Nov 8' },
        { name: 'Bhai Dooj', meta: 'Tue, Nov 10' },
      ],
      steps: [
        { title: 'Open Resuming', body: 'No account needed to try.' },
        { title: 'Tap Add', body: 'Add Dhanteras, Diwali and Bhai Dooj.' },
        { title: 'Send one link', body: 'Plan the Diwali party and send one link to the family group.' },
      ],
    },
  },
  {
    slug: 'cricket',
    market: 'india',
    languages: 'all',
    firstSection: 'sports',
    copy: {
      h1: 'Never miss a Team India match.',
      sub: 'Add the whole series to your Today in one tap, then plan the match night with friends.',
      kicker: 'Cricket',
      heading: 'Every match, waiting on your Today',
      body: 'Pick Team India and every match of the series becomes a reminder. Tests, ODIs and T20s, all in one list.',
      points: ['Add the whole series in one tap', 'Plan a match night with friends in one link', 'Free, no ads'],
      items: [
        { name: 'India vs New Zealand', meta: 'ODI' },
        { name: 'India vs Australia', meta: 'T20' },
      ],
      steps: [
        { title: 'Open Sports', body: 'Open Resuming and go to Sports.' },
        { title: 'Pick Team India', body: 'Pick Team India and tap Add.' },
        { title: 'Plan the match night', body: 'Plan the match night and share the link with friends.' },
      ],
    },
  },
  {
    slug: 'pranayam',
    market: 'india',
    languages: 'all',
    firstSection: 'habits',
    showWellnessDisclaimer: true,
    copy: {
      h1: '5 minutes of Anulom Vilom, with the video inside the habit.',
      sub: 'Follow along with Kapalabhati, Anulom Vilom and Bhramari. Missed a day? Just resume.',
      kicker: 'Pranayam',
      heading: 'Press start. The video plays with the timer.',
      body: 'Start Kapalabhati, Anulom Vilom or Bhramari and a follow-along video plays with the timer. Prefer your own teacher? Add any YouTube link to any habit.',
      points: ['Five minutes counts', 'Short sessions add up through the day', 'Missed a day? Just resume; no broken streaks'],
      steps: [
        { title: 'Pick a pranayam habit', body: 'Kapalabhati, Anulom Vilom or Bhramari.' },
        { title: 'Press start', body: 'Press start and follow the video.' },
        { title: 'Missed a day?', body: 'Tap Resume and carry on.' },
      ],
      note: wellness,
    },
  },
  {
    slug: 'steps',
    market: 'india',
    languages: 'all',
    firstSection: 'steps',
    showWellnessDisclaimer: true,
    showAndroidStepsNote: true,
    copy: {
      h1: 'Your steps, next to a goal you pick.',
      sub: 'On Android, Resuming reads your steps from Health Connect and shows the days you met your goal.',
      kicker: 'Steps',
      heading: "Today's steps, next to your goal",
      body: "Pick a daily goal. Resuming shows today's steps and the last 7 days, and how often you met your goal.",
      points: ["Today's steps next to your daily goal", 'The last 7 days at a glance', 'Your steps stay on your phone'],
      steps: [
        { title: 'Install Resuming on Android', body: 'Get it from Google Play.' },
        { title: 'Allow Health Connect', body: 'Allow Health Connect and pick a goal.' },
        { title: 'Walk', body: 'Missed a day? Just resume tomorrow.' },
      ],
      note: `${stepsNote} ${wellness}`,
    },
  },
  {
    slug: 'meetup',
    market: 'both',
    languages: 'all',
    firstSection: 'meetup',
    copy: {
      h1: "Chai, match night or Diwali party: one link, everyone's in.",
      sub: 'Plan a meetup, share it on WhatsApp, and each person adds it to their own Today.',
      kicker: 'Plan a meetup',
      heading: "One link, everyone's in",
      body: 'Planning a puja, a wedding, a match night or chai with friends? Send it to the group, photo and all. Everyone who opens the link adds it to their own Today in one tap.',
      points: [
        'One link for the whole group',
        "If it's cancelled, everyone who added it sees that",
        'Only the “From” line you type is shown, never your email or phone number',
      ],
      steps: [
        { title: 'Plan a meetup', body: 'Add the time, place and a photo.' },
        { title: 'Share it on WhatsApp', body: 'Send it to the group.' },
        { title: 'Everyone taps Add', body: "They each get their own reminder. If it's cancelled, they all see it." },
      ],
    },
  },
  {
    slug: 'nfl',
    market: 'us',
    languages: 'en',
    firstSection: 'sports',
    copy: {
      h1: "Your team's whole season on your Today.",
      sub: 'Pick your team and every game becomes a reminder. Plan the watch party with one link.',
      kicker: 'NFL and more',
      heading: 'Never miss kickoff',
      body: 'Pick your team and every game of the season lands on Today. Works for NFL, NBA, NHL, MLB and MLS.',
      points: ['The whole season in one tap', 'Plan the watch party with one link', 'Team names only; no sign-up needed to try'],
      items: [
        { name: 'Seattle vs Dallas', meta: 'Sun 1:05 pm' },
        { name: 'Green Bay vs Chicago', meta: 'Sun 5:20 pm' },
      ],
      steps: [
        { title: 'Open Sports', body: 'Open Resuming and go to Sports.' },
        { title: 'Pick your team', body: 'Pick your team and tap Add.' },
        { title: 'Plan the watch party', body: 'Plan the watch party and share the link.' },
      ],
    },
  },
  {
    slug: 'school-holidays',
    market: 'us',
    languages: 'en',
    firstSection: 'school',
    showSchoolWaitlist: true,
    copy: {
      h1: 'Every day off this school year, on your phone.',
      sub: 'Find your school district by ZIP and add all its days off in one tap.',
      coverage: 'Covers the 50 largest US school districts and every district in Washington state. More states coming soon.',
      kicker: 'School holidays',
      heading: 'Every day off, before the school email arrives',
      body: 'Find your school district by ZIP and add all its days off for the year in one tap. They wait on Today like any other reminder.',
      points: [
        'Breaks, holidays and early dismissals in one list',
        'Plan ahead for winter break and long weekends',
        'Covers the 50 largest US school districts and every district in Washington state; more coming soon',
      ],
      items: [
        { name: 'No school', meta: 'Veterans Day' },
        { name: 'Winter break starts', meta: 'All day' },
      ],
      steps: [
        { title: 'Enter your ZIP', body: 'Enter your ZIP and pick your district.' },
        { title: 'Tap Add', body: 'Put every day off on your Today.' },
        { title: 'Plan ahead', body: 'Plan ahead for winter break and long weekends.' },
      ],
    },
  },
  {
    slug: 'running',
    market: 'us',
    languages: 'en',
    firstSection: 'insights',
    showRunningNote: true,
    copy: {
      h1: 'Missed a run? Just resume.',
      sub: 'Time your runs, see your comebacks, and stop worrying about broken streaks.',
      kicker: 'Running',
      heading: 'Count your comebacks, not your streaks',
      body: 'Time every run with a habit timer. Insights shows the days you ran, your usual time of day, and how often you came back after a break.',
      points: ['A timer for every run or workout', 'Your best day and time of day', "Comebacks count; missed days don't break anything"],
      steps: [
        { title: 'Add a Running habit', body: 'Add a Running habit with a timer.' },
        { title: 'Tap start', body: 'Tap start when you run.' },
        { title: 'Missed a run?', body: 'Tap Resume next time.' },
      ],
      note: 'On Android, Resuming can also show your daily steps from Health Connect.',
    },
  },
]

export function themeBySlug(slug: string): Theme | undefined {
  return THEMES.find((theme) => theme.slug === slug)
}

/** Local calendar date, compared with activeUntil (inclusive). */
export function pastActiveUntil(activeUntil: string, now = new Date()): boolean {
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}` > activeUntil
}
