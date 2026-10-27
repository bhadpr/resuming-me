import { COMMUNITY_PHOTO_BUCKET, isEventPhotoPath, LIST_PHOTO_SIDE, reminderPhotoSrc } from './eventPhotoUrl'
import { LOCALES, type Locale } from './i18n'
import {
  cleanReminderText,
  reminderKindOf,
  reminderListKind,
  type Reminder,
  type ReminderInput,
  type ReminderKind,
} from './reminderSchedule'
import { createSupabaseClient } from './supabase'
import type { Database, Json } from '../types/database'

/**
 * Days many people keep, such as Diwali or Christmas. Only the admin makes them.
 * Picking one gives the person an ordinary reminder of their own.
 */
export interface CommunityReminder {
  id: string
  /** English is always there. A missing language shows English. */
  titles: Partial<Record<Locale, string>>
  /** YYYY-MM-DD. The admin enters each year's date. */
  day: string
  /** Also alert on the evening before. */
  remindBefore: boolean
  /** Also alert a week before. */
  remindWeekBefore: boolean
  kind: ReminderKind
  photoPath: string | null
  active: boolean
  /** Which picture and which list this day belongs to. A saved row can leave this empty. */
  festival?: string
}

type CommunityRow = Database['public']['Tables']['community_reminders']['Row']

/** Keeps the languages we have, trimmed, and drops the empty ones. */
export function cleanTitles(value: unknown): Partial<Record<Locale, string>> {
  const titles: Partial<Record<Locale, string>> = {}
  if (!value || typeof value !== 'object' || Array.isArray(value)) return titles
  for (const locale of LOCALES) {
    const raw = (value as Record<string, unknown>)[locale]
    if (typeof raw !== 'string') continue
    const text = cleanReminderText(raw)
    if (text) titles[locale] = text
  }
  return titles
}

/** The title in the person's language, else English. */
export function communityTitle(item: Pick<CommunityReminder, 'titles'>, locale: Locale): string {
  return item.titles[locale] || item.titles.en || ''
}

/** The reminder a person gets for picking this one. Any time that day, with the evening-before alert as set. */
export function communityReminderInput(
  item: Pick<CommunityReminder, 'id' | 'titles' | 'day' | 'remindBefore' | 'remindWeekBefore' | 'kind' | 'photoPath'>,
  locale: Locale,
): ReminderInput {
  return {
    text: communityTitle(item, locale),
    day: item.day,
    hour: null,
    minute: null,
    remindBefore: item.remindBefore,
    remindWeekBefore: item.remindWeekBefore,
    kind: item.kind,
    communityId: item.id,
    communityPhotoPath: isEventPhotoPath(item.photoPath) ? item.photoPath : null,
  }
}

/** Whether the person already has a reminder from this one, done or not. */
export function addedCommunityIds(reminders: readonly Pick<Reminder, 'communityId'>[]): string[] {
  return [...new Set(reminders.map((item) => item.communityId).filter((id): id is string => Boolean(id)))]
}

/** The ones still ahead and on, soonest first, and by name on the same day. A day that has passed is never shown. */
export function upcomingCommunity(list: readonly CommunityReminder[], today: string): CommunityReminder[] {
  return list
    .filter((item) => item.active && item.day >= today && Boolean(item.titles.en))
    .sort((a, b) => a.day.localeCompare(b.day) || (a.titles.en ?? '').localeCompare(b.titles.en ?? ''))
}

/** A suggested day. The id is local until an admin saves the same festival for that year. */
function suggestedDay(
  id: string,
  day: string,
  titles: Partial<Record<Locale, string>> & { en: string },
  festival?: string,
): CommunityReminder {
  return {
    id,
    titles,
    day,
    remindBefore: true,
    remindWeekBefore: true,
    kind: 'event',
    photoPath: null,
    active: true,
    festival: festival ?? festivalKey(titles.en) ?? undefined,
  }
}

function names(
  en: string,
  hi: string,
  te: string,
  gu: string,
  mr: string,
  ta: string,
  bn: string,
): Partial<Record<Locale, string>> & { en: string } {
  return { en, hi, te, gu, mr, ta, bn }
}

const REPUBLIC = names('Republic Day', 'गणतंत्र दिवस', 'గణతంత్ర దినోత్సవం', 'પ્રજાસત્તાક દિવસ', 'प्रजासत्ताक दिन', 'குடியரசு நாள்', 'প্রজাতন্ত্র দিবস')
const HOLI = names('Holi', 'होली', 'హోళి', 'હોળી', 'होळी', 'ஹோலி', 'হোলি')
const FITR = names('Eid al-Fitr', 'ईद-उल-फितर', 'ఈద్-ఉల్-ఫితర్', 'ઈદ-ઉલ-ફિત્ર', 'ईद-उल-फित्र', 'ஈத்-உல்-பித்ர்', 'ঈদুল ফিতর')
const RAM = names('Ram Navami', 'राम नवमी', 'శ్రీ రామ నవమి', 'રામ નવમી', 'राम नवमी', 'ராம நவமி', 'রাম নবমী')
const MAHAVIR = names('Mahavir Jayanti', 'महावीर जयंती', 'మహావీర్ జయంతి', 'મહાવીર જયંતી', 'महावीर जयंती', 'மகாவீர் ஜெயந்தி', 'মহাবীর জয়ন্তী')
const FRIDAY = names('Good Friday', 'गुड फ्राइडे', 'గుడ్ ఫ్రైడే', 'ગુડ ફ્રાઈડે', 'गुड फ्रायडे', 'புனித வெள்ளி', 'গুড ফ্রাইডে')
const BUDDHA = names('Buddha Purnima', 'बुद्ध पूर्णिमा', 'బుద్ధ పూర్ణిమ', 'બુદ્ધ પૂર્ણિમા', 'बुद्ध पौर्णिमा', 'புத்த பூர்ணிமா', 'বুদ্ধ পূর্ণিমা')
const ADHA = names('Eid al-Adha', 'ईद-उल-अज़हा', 'బక్రీద్', 'બકરી ઈદ', 'बकरी ईद', 'பக்ரீத்', 'ঈদুল আজহা')
const MUHARRAM = names('Muharram', 'मुहर्रम', 'మొహర్రం', 'મોહરમ', 'मोहरम', 'முஹர்ரம்', 'মহরম')
const INDIA_INDEPENDENCE = names(
  'Independence Day',
  'स्वतंत्रता दिवस',
  'స్వాతంత్ర్య దినోత్సవం',
  'સ્વતંત્રતા દિવસ',
  'स्वातंत्र्य दिन',
  'சுதந்திர தினம்',
  'স্বাধীনতা দিবস',
)
const MILAD = names('Milad-un-Nabi', 'मिलाद-उन-नबी', 'మిలాద్-ఉన్-నబీ', 'મિલાદ-ઉન-નબી', 'मिलाद-उन-नबी', 'மீலாதுன் நபி', 'ঈদে মিলাদুন্নবী')
const JANMASHTAMI = names('Janmashtami', 'जन्माष्टमी', 'శ్రీకృష్ణ జన్మాష్టమి', 'જન્માષ્ટમી', 'जन्माष्टमी', 'கிருஷ்ண ஜெயந்தி', 'জন্মাষ্টমী')
const GANDHI = names('Gandhi Jayanti', 'गांधी जयंती', 'గాంధీ జయంతి', 'ગાંધી જયંતી', 'गांधी जयंती', 'காந்தி ஜெயந்தி', 'গান্ধী জয়ন্তী')
const VIJAYA = names('Vijayadashmi', 'विजयादशमी', 'విజయదశమి', 'વિજયાદશમી', 'विजयादशमी', 'விஜயதசமி', 'বিজয়াদশমী')
const DIWALI = names('Diwali', 'दिवाली', 'దీపావళి', 'દિવાળી', 'दिवाळी', 'தீபாவளி', 'দীপাবলি')
const NANAK = names('Guru Nanak Jayanti', 'गुरु नानक जयंती', 'గురు నానక్ జయంతి', 'ગુરુ નાનક જયંતી', 'गुरु नानक जयंती', 'குரு நானக் ஜயந்தி', 'গুরু নানক জয়ন্তী')

/** Central government gazetted holidays. Islamic dates follow the notified list and can move with the moon. */
const INDIA_GAZETTED: readonly CommunityReminder[] = [
  suggestedDay('f1010126-2026-4111-8001-000000000021', '2026-01-26', REPUBLIC, 'republic'),
  suggestedDay('f1030404-2026-4111-8001-000000000022', '2026-03-04', HOLI, 'holi'),
  suggestedDay('f1030321-2026-4111-8001-000000000023', '2026-03-21', FITR, 'fitr'),
  suggestedDay('f1030326-2026-4111-8001-000000000024', '2026-03-26', RAM, 'ramnavami'),
  suggestedDay('f1030331-2026-4111-8001-000000000025', '2026-03-31', MAHAVIR, 'mahavir'),
  suggestedDay('f1040403-2026-4111-8001-000000000026', '2026-04-03', FRIDAY, 'goodfriday'),
  suggestedDay('f1050501-2026-4111-8001-000000000027', '2026-05-01', BUDDHA, 'buddha'),
  suggestedDay('f1050527-2026-4111-8001-000000000028', '2026-05-27', ADHA, 'adha'),
  suggestedDay('f1060626-2026-4111-8001-000000000029', '2026-06-26', MUHARRAM, 'muharram'),
  suggestedDay('f1080815-2026-4111-8001-000000000030', '2026-08-15', INDIA_INDEPENDENCE, 'in-independence'),
  suggestedDay('f1080826-2026-4111-8001-000000000031', '2026-08-26', MILAD, 'milad'),
  suggestedDay('f1090904-2026-4111-8001-000000000032', '2026-09-04', JANMASHTAMI, 'janmashtami'),
  suggestedDay('f1101002-2026-4111-8001-000000000033', '2026-10-02', GANDHI, 'gandhi'),
  suggestedDay('f2010126-2027-4111-8001-000000000041', '2027-01-26', REPUBLIC, 'republic'),
  suggestedDay('f2030310-2027-4111-8001-000000000042', '2027-03-10', FITR, 'fitr'),
  suggestedDay('f2030323-2027-4111-8001-000000000043', '2027-03-23', HOLI, 'holi'),
  suggestedDay('f2030326-2027-4111-8001-000000000044', '2027-03-26', FRIDAY, 'goodfriday'),
  suggestedDay('f2040415-2027-4111-8001-000000000045', '2027-04-15', RAM, 'ramnavami'),
  suggestedDay('f2040419-2027-4111-8001-000000000046', '2027-04-19', MAHAVIR, 'mahavir'),
  suggestedDay('f2050517-2027-4111-8001-000000000047', '2027-05-17', ADHA, 'adha'),
  suggestedDay('f2050520-2027-4111-8001-000000000048', '2027-05-20', BUDDHA, 'buddha'),
  suggestedDay('f2060616-2027-4111-8001-000000000049', '2027-06-16', MUHARRAM, 'muharram'),
  suggestedDay('f2080815-2027-4111-8001-000000000050', '2027-08-15', INDIA_INDEPENDENCE, 'in-independence'),
  suggestedDay('f2080816-2027-4111-8001-000000000051', '2027-08-15', MILAD, 'milad'),
  suggestedDay('f2080825-2027-4111-8001-000000000052', '2027-08-25', JANMASHTAMI, 'janmashtami'),
  suggestedDay('f2101002-2027-4111-8001-000000000053', '2027-10-02', GANDHI, 'gandhi'),
  suggestedDay('f2101009-2027-4111-8001-000000000054', '2027-10-09', VIJAYA, 'vijaya'),
  suggestedDay('f2101029-2027-4111-8001-000000000055', '2027-10-29', DIWALI, 'diwali'),
  suggestedDay('f2111114-2027-4111-8001-000000000056', '2027-11-14', NANAK, 'nanak'),
]

/**
 * Shown when the admin list does not already include them for that year.
 */
const SUGGESTED_COMMUNITY: readonly CommunityReminder[] = [
  {
    id: 'c3a1d0e2-7b64-4a11-9c2e-111111111111',
    titles: {
      en: 'Vijayadashmi',
      hi: 'विजयादशमी',
      te: 'విజయదశమి',
      gu: 'વિજયાદશમી',
      mr: 'विजयादशमी',
      ta: 'விஜயதசமி',
      bn: 'বিজয়াদশমী',
    },
    day: '2026-10-20',
    remindBefore: true,
    remindWeekBefore: true,
    kind: 'event',
    photoPath: null,
    active: true,
  },
  {
    id: 'e5c3f204-9d86-4c33-9e40-333333333333',
    titles: {
      en: 'Halloween',
      hi: 'हैलोवीन',
      te: 'హాలోవీన్',
      gu: 'હેલોવીન',
      mr: 'हॅलोवीन',
      ta: 'ஹாலோவீன்',
      bn: 'হ্যালোউইন',
    },
    day: '2026-10-31',
    remindBefore: true,
    remindWeekBefore: true,
    kind: 'event',
    photoPath: null,
    active: true,
  },
  {
    id: 'd4b2e1f3-8c75-4b22-8d3f-222222222222',
    titles: {
      en: 'Diwali',
      hi: 'दिवाली',
      te: 'దీపావళి',
      gu: 'દિવાળી',
      mr: 'दिवाळी',
      ta: 'தீபாவளி',
      bn: 'দীপাবলি',
    },
    day: '2026-11-08',
    remindBefore: true,
    remindWeekBefore: true,
    kind: 'event',
    photoPath: null,
    active: true,
  },
  {
    id: 'f6d4a315-ae97-4d44-8f51-444444444444',
    titles: {
      en: 'Guru Nanak Jayanti',
      hi: 'गुरु नानक जयंती',
      te: 'గురు నానక్ జయంతి',
      gu: 'ગુરુ નાનક જયંતી',
      mr: 'गुरु नानक जयंती',
      ta: 'குரு நானக் ஜயந்தி',
      bn: 'গুরু নানক জয়ন্তী',
    },
    day: '2026-11-24',
    remindBefore: true,
    remindWeekBefore: true,
    kind: 'event',
    photoPath: null,
    active: true,
  },
  {
    id: 'b8f6c537-c019-4f66-a163-666666666666',
    titles: {
      en: 'Thanksgiving',
      hi: 'थैंक्सगिविंग',
      te: 'థాంక్స్‌గివింగ్',
      gu: 'થેન્ક્સગિવિંગ',
      mr: 'थँक्सगिव्हिंग',
      ta: 'தாங்க்ஸ்கிவிங்',
      bn: 'থ্যাঙ্কসগিভিং',
    },
    day: '2026-11-26',
    remindBefore: true,
    remindWeekBefore: true,
    kind: 'event',
    photoPath: null,
    active: true,
  },
  {
    id: 'a7e5b426-bf08-4e55-9052-555555555555',
    titles: {
      en: 'Christmas',
      hi: 'क्रिसमस',
      te: 'క్రిస్మస్',
      gu: 'નાતાલ',
      mr: 'नाताळ',
      ta: 'கிறிஸ்துமஸ்',
      bn: 'বড়দিন',
    },
    day: '2026-12-25',
    remindBefore: true,
    remindWeekBefore: true,
    kind: 'event',
    photoPath: null,
    active: true,
  },
  suggestedDay('e1ec1103-2026-4111-8001-000000000001', '2026-11-03', {
    en: 'Election Day',
    hi: 'चुनाव दिवस',
    te: 'ఎన్నికల రోజు',
    gu: 'ચૂંટણી દિવસ',
    mr: 'निवडणूक दिन',
    ta: 'தேர்தல் நாள்',
    bn: 'নির্বাচনের দিন',
  }),
  suggestedDay('e1ec1111-2026-4111-8001-000000000002', '2026-11-11', {
    en: 'Veterans Day',
    hi: 'वेटरन्स डे',
    te: 'వెటరన్స్ డే',
    gu: 'વેટરન્સ ડે',
    mr: 'व्हेटेरन्स डे',
    ta: 'வெட்டரன்கள் தினம்',
    bn: 'ভেটেরান্স ডে',
  }),
  suggestedDay('e1ec0101-2027-4111-8001-000000000003', '2027-01-01', {
    en: "New Year's Day",
    hi: 'नव वर्ष',
    te: 'నూతన సంవత్సరం',
    gu: 'નૂતન વર્ષ',
    mr: 'नववर्ष',
    ta: 'புத்தாண்டு',
    bn: 'নববর্ষ',
  }),
  suggestedDay('e1ec0118-2027-4111-8001-000000000004', '2027-01-18', {
    en: 'Martin Luther King Jr. Day',
    hi: 'मार्टिन लूथर किंग जूनियर दिवस',
    te: 'మార్టిన్ లూథర్ కింగ్ జూనియర్ దినం',
    gu: 'માર્ટિન લ્યુથર કિંગ જુનિયર દિવસ',
    mr: 'मार्टिन ल्यूथर किंग ज्युनियर दिन',
    ta: 'மார்ட்டின் லூதர் கிங் ஜூனியர் நாள்',
    bn: 'মার্টিন লুথার কিং জুনিয়র দিবস',
  }),
  suggestedDay('e1ec0215-2027-4111-8001-000000000005', '2027-02-15', {
    en: 'Presidents Day',
    hi: 'प्रेसिडेंट्स डे',
    te: 'ప్రెసిడెంట్స్ డే',
    gu: 'પ્રેસિડેન્ટ્સ ડે',
    mr: 'प्रेसिडेन्ट्स डे',
    ta: 'அதிபர்கள் தினம்',
    bn: 'প্রেসিডেন্টস ডে',
  }),
  suggestedDay('e1ec0531-2027-4111-8001-000000000006', '2027-05-31', {
    en: 'Memorial Day',
    hi: 'मेमोरियल डे',
    te: 'మెమోరియల్ డే',
    gu: 'મેમોરિયલ ડે',
    mr: 'मेमोरियल डे',
    ta: 'நினைவு நாள்',
    bn: 'মেমোরিয়াল ডে',
  }),
  suggestedDay('e1ec0619-2027-4111-8001-000000000007', '2027-06-19', {
    en: 'Juneteenth',
    hi: 'जूनटीन्थ',
    te: 'జూన్టీన్త్',
    gu: 'જુનટીન્થ',
    mr: 'जुनटीन्थ',
    ta: 'ஜூன்டீன்த்',
    bn: 'জুনটিনথ',
  }),
  suggestedDay('e1ec0704-2027-4111-8001-000000000008', '2027-07-04', {
    en: 'Independence Day',
    hi: 'इंडिपेंडेंस डे',
    te: 'ఇండిపెండెన్స్ డే',
    gu: 'ઇન્ડિપેન્ડન્સ ડે',
    mr: 'इंडिपेंडन्स डे',
    ta: 'இன்டிபெண்டன்ஸ் டே',
    bn: 'ইনডিপেন্ডেন্স ডে',
  }),
  suggestedDay('e1ec0906-2027-4111-8001-000000000009', '2027-09-06', {
    en: 'Labor Day',
    hi: 'लेबर डे',
    te: 'లేబర్ డే',
    gu: 'લેબર ડે',
    mr: 'लेबर डे',
    ta: 'லேபர் டே',
    bn: 'লেবার ডে',
  }),
  suggestedDay('e1ec1011-2027-4111-8001-000000000010', '2027-10-11', {
    en: 'Columbus Day',
    hi: 'कोलंबस डे',
    te: 'కొలంబస్ డే',
    gu: 'કોલંબસ ડે',
    mr: 'कोलंबस डे',
    ta: 'கொலம்பஸ் தினம்',
    bn: 'কলম্বাস ডে',
  }),
  suggestedDay('e1ec1031-2027-4111-8001-000000000011', '2027-10-31', {
    en: 'Halloween',
    hi: 'हैलोवीन',
    te: 'హాలోవీన్',
    gu: 'હેલોવીન',
    mr: 'हॅलोवीन',
    ta: 'ஹாலோவீன்',
    bn: 'হ্যালোউইন',
  }),
  suggestedDay('e1ec1102-2027-4111-8001-000000000012', '2027-11-02', {
    en: 'Election Day',
    hi: 'चुनाव दिवस',
    te: 'ఎన్నికల రోజు',
    gu: 'ચૂંટણી દિવસ',
    mr: 'निवडणूक दिन',
    ta: 'தேர்தல் நாள்',
    bn: 'নির্বাচনের দিন',
  }),
  suggestedDay('e1ec1111-2027-4111-8001-000000000013', '2027-11-11', {
    en: 'Veterans Day',
    hi: 'वेटरन्स डे',
    te: 'వెటరన్స్ డే',
    gu: 'વેટરન્સ ડે',
    mr: 'व्हेटेरन्स डे',
    ta: 'வெட்டரன்கள் தினம்',
    bn: 'ভেটেরান্স ডে',
  }),
  suggestedDay('e1ec1125-2027-4111-8001-000000000014', '2027-11-25', {
    en: 'Thanksgiving',
    hi: 'थैंक्सगिविंग',
    te: 'థాంక్స్‌గివింగ్',
    gu: 'થેન્ક્સગિવિંગ',
    mr: 'थँक्सगिव्हिंग',
    ta: 'தாங்க்ஸ்கிவிங்',
    bn: 'থ্যাঙ্কসগিভিং',
  }),
  suggestedDay('e1ec1225-2027-4111-8001-000000000015', '2027-12-25', {
    en: 'Christmas',
    hi: 'क्रिसमस',
    te: 'క్రిస్మస్',
    gu: 'નાતાલ',
    mr: 'नाताळ',
    ta: 'கிறிஸ்துமஸ்',
    bn: 'বড়দিন',
  }),
  ...INDIA_GAZETTED,
]

function festivalKey(name: string): string | null {
  const value = name.trim().toLowerCase()
  if (value.includes('diwali')) return 'diwali'
  if (value.includes('vijaya')) return 'vijaya'
  if (value.includes('halloween')) return 'halloween'
  if (value.includes('christmas')) return 'christmas'
  if (value.includes('nanak')) return 'nanak'
  if (value.includes('thank')) return 'thanksgiving'
  if (value.includes('election')) return 'election'
  if (value.includes('veteran')) return 'veteran'
  if (value.includes('new year')) return 'newyear'
  if (value.includes('martin luther')) return 'mlk'
  if (value.includes('president')) return 'presidents'
  if (value.includes('memorial')) return 'memorial'
  if (value.includes('juneteenth')) return 'juneteenth'
  if (value.includes('independence')) return 'independence'
  if (value.includes('labor')) return 'labor'
  if (value.includes('columbus')) return 'columbus'
  if (value.includes('eid al-adha') || value.includes('bakrid') || value.includes('zuha')) return 'adha'
  if (value.includes('eid al-fitr') || value.includes('fitr')) return 'fitr'
  if (value.includes('ram navami')) return 'ramnavami'
  if (value.includes('mahavir')) return 'mahavir'
  if (value.includes('good friday')) return 'goodfriday'
  if (value.includes('buddha') || value.includes('budha')) return 'buddha'
  if (value.includes('muharram')) return 'muharram'
  if (value.includes('milad')) return 'milad'
  if (value.includes('janmashtami') || value.includes('janamashtami')) return 'janmashtami'
  if (value.includes('gandhi')) return 'gandhi'
  if (value.includes('republic')) return 'republic'
  if (value.includes('holi')) return 'holi'
  return null
}

/** The picture name for a day. A saved row uses its English title. */
export function festivalOf(item: Pick<CommunityReminder, 'titles' | 'festival'>): string | null {
  return item.festival || festivalKey(item.titles.en ?? '')
}

/** The festival for a list day, so India and US Independence Day keep their own pictures. */
export function holidayFestival(text: string, day: string): string | null {
  const exact = SUGGESTED_COMMUNITY.find(
    (item) => item.day === day && Object.values(item.titles).some((title) => title === text),
  )
  if (exact) return exact.festival ?? festivalKey(exact.titles.en ?? '')
  return festivalOf({ titles: { en: text } })
}

/** The small clay picture for a holiday row. Null when this day has no picture. */
export function holidayArtUrl(text: string, day: string): string | null {
  const key = holidayFestival(text, day)
  return key ? `/community/sm/${key}.jpg` : null
}

/** A row picture: the person's own photo, then the holiday's clay picture, then the list logo. */
export function reminderShownPhoto(reminder: Reminder, width = LIST_PHOTO_SIDE): string | null {
  const own = reminderPhotoSrc(
    {
      photoData: reminder.photoData,
      photoUrl: reminder.photoUrl,
      sharedPhotoPath: reminder.sharedPhotoPath,
    },
    width,
  )
  if (own) return own
  if (reminderListKind(reminder) === 'holiday') {
    const art = holidayArtUrl(reminder.text, reminder.day)
    if (art) return art
  }
  return reminderPhotoSrc(reminder, width)
}

/** The name a phone keeps. A known holiday uses the person's language. Anything else stays as written. */
export function holidayCopyText(text: string, day: string, locale: Locale): string {
  const exact = SUGGESTED_COMMUNITY.find((item) => item.day === day && item.titles.en === text)
  return exact ? communityTitle(exact, locale) : text
}

const US_HOLIDAYS = new Set([
  'halloween',
  'thanksgiving',
  'christmas',
  'election',
  'veteran',
  'newyear',
  'mlk',
  'presidents',
  'memorial',
  'juneteenth',
  'independence',
  'labor',
  'columbus',
])
const INDIA_HOLIDAYS = new Set([
  'diwali',
  'vijaya',
  'nanak',
  'christmas',
  'republic',
  'holi',
  'fitr',
  'ramnavami',
  'mahavir',
  'goodfriday',
  'buddha',
  'adha',
  'muharram',
  'in-independence',
  'milad',
  'janmashtami',
  'gandhi',
])

/** A known holiday belongs on that region's list. Christmas is kept in both. */
export function holidayInRegion(item: Pick<CommunityReminder, 'titles' | 'festival'>, region: 'us' | 'in'): boolean {
  const key = festivalOf(item)
  if (!key) return false
  return region === 'us' ? US_HOLIDAYS.has(key) : INDIA_HOLIDAYS.has(key)
}

function sameFestival(
  left: Pick<CommunityReminder, 'titles' | 'festival'>,
  right: Pick<CommunityReminder, 'titles' | 'festival'>,
): boolean {
  const a = festivalOf(left)
  const b = festivalOf(right)
  if (a && b) return a === b
  return (left.titles.en ?? '').trim().toLowerCase() === (right.titles.en ?? '').trim().toLowerCase()
}

/** Uses the familiar festival name when the saved English title is the same day under another spelling. */
function withSuggestedName(item: CommunityReminder): CommunityReminder {
  const year = item.day.slice(0, 4)
  const suggested =
    SUGGESTED_COMMUNITY.find((row) => sameFestival(row, item) && row.day.slice(0, 4) === year) ??
    SUGGESTED_COMMUNITY.find((row) => sameFestival(row, item))
  if (!suggested) return item
  const titles = { ...suggested.titles }
  for (const [locale, text] of Object.entries(item.titles)) {
    if (locale === 'en' || !text) continue
    if (text.trim().toLowerCase() === (item.titles.en ?? '').trim().toLowerCase()) continue
    titles[locale as keyof typeof titles] = text
  }
  titles.en = suggested.titles.en
  return { ...item, titles }
}

/** How many days the setup list shows. The community page asks for the whole two-year catalog. */
export const COMMUNITY_LIST_MAX = 10
export const COMMUNITY_PAGE_MAX = 80

/** Admin days still ahead, plus a suggested day when that festival is not already listed for the same year. */
export function communityToShow(
  fromServer: readonly CommunityReminder[],
  today: string,
  limit = COMMUNITY_LIST_MAX,
): CommunityReminder[] {
  const upcoming = upcomingCommunity(fromServer, today).map(withSuggestedName)
  const extra = upcomingCommunity(SUGGESTED_COMMUNITY, today).filter(
    (item) =>
      !upcoming.some(
        (have) => sameFestival(have, item) && have.day.slice(0, 4) === item.day.slice(0, 4),
      ),
  )
  return upcomingCommunity([...upcoming, ...extra], today).slice(0, limit)
}

function fromRow(row: CommunityRow): CommunityReminder {
  return {
    id: row.id,
    titles: cleanTitles(row.titles),
    day: row.day,
    remindBefore: row.remind_before,
    remindWeekBefore: row.remind_week_before,
    kind: reminderKindOf(row.kind),
    photoPath: isEventPhotoPath(row.photo_path) ? row.photo_path : null,
    active: row.active,
  }
}

/** What anyone can see: the ones ahead, with Vijayadashmi and Diwali included. */
export async function listCommunityReminders(today: string, limit = COMMUNITY_LIST_MAX): Promise<CommunityReminder[]> {
  try {
    const { data, error } = await createSupabaseClient()
      .from('community_reminders')
      .select('*')
      .eq('active', true)
      .gte('day', today)
      .order('day', { ascending: true })
      .limit(50)
    if (error) throw error
    return communityToShow((data ?? []).map(fromRow), today, limit)
  } catch {
    return communityToShow([], today, limit)
  }
}

/** Admin only: every one, including those switched off or past. */
export async function listCommunityRemindersForAdmin(): Promise<CommunityReminder[]> {
  const { data, error } = await createSupabaseClient()
    .from('community_reminders')
    .select('*')
    .order('day', { ascending: false })
    .limit(500)
  if (error) throw error
  return (data ?? []).map(fromRow)
}

export interface CommunityIssue {
  field: 'title' | 'day'
}

/** The first thing wrong with the form, or null. */
export function communityFormIssue(form: { titles: Partial<Record<Locale, string>>; day: string }): CommunityIssue | null {
  const titles = cleanTitles(form.titles)
  if (!titles.en) return { field: 'title' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.day) || Number.isNaN(Date.parse(form.day))) return { field: 'day' }
  return null
}

export interface CommunityForm {
  /** Missing for a new one. */
  id?: string
  titles: Partial<Record<Locale, string>>
  day: string
  remindBefore: boolean
  remindWeekBefore: boolean
  active: boolean
  /** The photo already stored, if any. */
  photoPath: string | null
  /** A new photo, already shrunk. */
  newPhoto?: Blob | null
  /** Drop the stored photo without a new one. */
  removePhoto?: boolean
}

/** Admin only. Saves, and replaces or removes the picture when asked. Returns the saved one. */
export async function saveCommunityReminder(form: CommunityForm): Promise<CommunityReminder> {
  if (communityFormIssue(form)) throw new Error('That reminder is not complete')
  const client = createSupabaseClient()
  const id = form.id ?? crypto.randomUUID()
  let photoPath = form.removePhoto ? null : form.photoPath
  let uploaded: string | null = null
  if (form.newPhoto) {
    uploaded = `${id}/${crypto.randomUUID()}.jpg`
    const { error } = await client.storage.from(COMMUNITY_PHOTO_BUCKET).upload(uploaded, form.newPhoto, {
      contentType: 'image/jpeg',
      cacheControl: '31536000',
      upsert: false,
    })
    if (error) throw error
    photoPath = uploaded
  }
  const row = {
    titles: cleanTitles(form.titles) as Json,
    day: form.day,
    remind_before: form.remindBefore,
    remind_week_before: form.remindWeekBefore,
    kind: 'event',
    photo_path: photoPath,
    active: form.active,
  }
  const { data, error } = form.id
    ? await client.from('community_reminders').update(row).eq('id', id).select('*').single()
    : await client.from('community_reminders').insert({ id, ...row }).select('*').single()
  if (error) {
    if (uploaded) void client.storage.from(COMMUNITY_PHOTO_BUCKET).remove([uploaded])
    throw error
  }
  // The old picture stays in storage: reminders already picked keep showing it.
  return fromRow(data)
}

/** Admin only. People who already picked it keep their reminder, and its picture stays in storage. */
export async function deleteCommunityReminder(id: string): Promise<void> {
  const { error } = await createSupabaseClient().from('community_reminders').delete().eq('id', id)
  if (error) throw error
}
