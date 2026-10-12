export const SITE_URL = 'https://resuming.app'
export const APP_URL = 'https://resuming.me'
export const CONTACT_EMAIL = 'resuming.me@gmail.com'
export const PLAY_PACKAGE = 'com.cheerfulgames.resuming'
/** Turn on once the Play listing is public; until then Play links would land on "not found". */
export const PLAY_LIVE = false

/** The app reads utm_source plus utm_campaign as a marketing group's code, so site links never set utm_campaign. */
export function playUrl(where: string): string {
  const referrer = `utm_source=resuming.app&utm_medium=website&utm_content=${where}`
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(referrer)}`
}

export const WEB_APP_URL = `${APP_URL}/start`

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
