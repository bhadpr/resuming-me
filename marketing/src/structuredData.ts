import { COMPANY, CONTACT_EMAIL, LANGUAGES, PLAY_LISTING_URL, PLAY_LIVE, SITE_NAME, SITE_URL, WEB_APP_URL } from './site'
import type { Copy } from './i18n/en'

/** Stable ids so the pieces point at each other. */
const ORG_ID = `${SITE_URL}/#organization`
const SITE_ID = `${SITE_URL}/#website`
const APP_ID = `${SITE_URL}/#app`

type JsonLd = Record<string, unknown>

/** Everything here repeats what the page already says. Do not add ratings, reviews or claims the page does not make. */
export function organization(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: COMPANY,
    url: SITE_URL,
    logo: `${SITE_URL}/icon-512.png`,
    brand: { '@type': 'Brand', name: SITE_NAME },
    email: CONTACT_EMAIL,
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: CONTACT_EMAIL,
      availableLanguage: 'English',
    },
    ...(PLAY_LIVE ? { sameAs: [PLAY_LISTING_URL] } : {}),
  }
}

export function webSite(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': SITE_ID,
    name: SITE_NAME,
    alternateName: `${SITE_NAME} app`,
    url: SITE_URL,
    inLanguage: 'en',
    publisher: { '@id': ORG_ID },
  }
}

export function softwareApplication(copy: Copy): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'MobileApplication',
    '@id': APP_ID,
    name: SITE_NAME,
    alternateName: `${SITE_NAME} app`,
    description: copy.meta.description,
    url: SITE_URL,
    image: `${SITE_URL}/og.jpg`,
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Android 7.0 or newer, and web browsers',
    inLanguage: LANGUAGES.map((language) => language.code),
    isAccessibleForFree: true,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: { '@id': ORG_ID },
    ...(PLAY_LIVE ? { downloadUrl: PLAY_LISTING_URL, installUrl: PLAY_LISTING_URL } : { installUrl: WEB_APP_URL }),
  }
}

/** The same answers the page shows, including the "coming soon" wording until Play is live. */
export function faqPage(copy: Copy): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: copy.faq.items.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: !PLAY_LIVE && 'aSoon' in item ? item.aSoon : item.a,
      },
    })),
  }
}

export function homeStructuredData(copy: Copy): JsonLd[] {
  return [organization(), webSite(), softwareApplication(copy), faqPage(copy)]
}
