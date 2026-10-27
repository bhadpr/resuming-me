import { Capacitor } from '@capacitor/core'

/** Public contact inbox — change here only. */
export const CONTACT_EMAIL = 'resuming.me@gmail.com'

/**
 * Off in the Android app: Play only allows medication management from an
 * organization developer account. The website keeps medicines.
 */
export const MEDICINES_ENABLED = !Capacitor.isNativePlatform()

/** Pranayam stays in the app. It is off the first-run questions for now. */
export const ONBOARDING_PRANAYAM = false

/** Medicine stays on Health. It is off the first-run questions for now. */
export const ONBOARDING_MEDICINE = false

/** Sign in with Apple stays in the app. The button is hidden until the next Android build. */
export const APPLE_SIGN_IN = false
