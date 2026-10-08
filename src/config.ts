import { Capacitor } from '@capacitor/core'

/** Public contact inbox — change here only. */
export const CONTACT_EMAIL = 'resuming.me@gmail.com'

/**
 * Off in the Android app: Play only allows medication management from an
 * organization developer account. The website keeps medicines.
 */
export const MEDICINES_ENABLED = !Capacitor.isNativePlatform()
