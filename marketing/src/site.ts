export const SITE_URL = 'https://resuming.app'
export const APP_URL = 'https://resuming.me'
export const CONTACT_EMAIL = 'resuming.me@gmail.com'
export const PLAY_PACKAGE = 'com.cheerfulgames.resuming'
export const SITE_NAME = 'Resuming'
export const COMPANY = 'Cheerful Games, Inc.'
/** The plain Play listing, with no tracking, for structured data and llms.txt. */
export const PLAY_LISTING_URL = `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}`
/** Shown in the sitemap as the last change. Bump it when the page content really changes. */
export const CONTENT_UPDATED = '2026-10-13'
/**
 * Search engine ownership tokens. Leave empty to add no tag.
 * Verifying the domain by DNS (a TXT record in Cloudflare) works too and needs no code.
 */
export const GOOGLE_SITE_VERIFICATION = 'odLz01oXyB_uXalQLKIyBSPEPTFeBMG0QY95fWZYLfA'
export const BING_SITE_VERIFICATION = ''
/**
 * Turns on every Google Play link, the QR code and the "on Google Play" wording.
 * Turned on ahead of the public listing (launch is due within a day or two), so the
 * Play links land on "not found" until the listing goes public.
 */
export const PLAY_LIVE = true

/** The app reads utm_source plus utm_campaign as a marketing group's code, so site links never set utm_campaign. */
export function playUrl(where: string): string {
  const referrer = `utm_source=resuming.app&utm_medium=website&utm_content=${where}`
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(referrer)}`
}

export const WEB_APP_URL = `${APP_URL}/start`

export const SOCIAL_LINKS = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/resumingme' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/resumingme/' },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@resumingme' },
] as const

/** Shown in the language section in each language's own script. */
export const LANGUAGES = [
  { code: 'en', name: 'English', line: 'Get back to what you put off.' },
  { code: 'hi', name: 'हिन्दी', line: 'जो टल गया, वहीं से फिर शुरू।' },
  { code: 'gu', name: 'ગુજરાતી', line: 'મુલતવી રાખ્યું હોય, ત્યાંથી ફરી શરૂ.' },
  { code: 'mr', name: 'मराठी', line: 'जे राहिले, तिथून पुन्हा सुरू.' },
  { code: 'te', name: 'తెలుగు', line: 'వాయిదా వేసిన దాన్ని మళ్లీ చేపట్టు.' },
  { code: 'ta', name: 'தமிழ்', line: 'தள்ளிப்போட்டதை அங்கிருந்து மீண்டும் தொடங்கு.' },
  { code: 'bn', name: 'বাংলা', line: 'যা পিছিয়ে গেছে, সেখান থেকেই আবার শুরু।' },
] as const

/** Hero loop scene lengths in seconds, matching the captions. */
export const HERO_SCENES = [6, 5, 5, 7]
