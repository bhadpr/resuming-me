import { COMMUNITY_PHOTO_BUCKET, isEventPhotoPath } from './eventPhotoUrl'
import { LOCALES, type Locale } from './i18n'
import {
  cleanReminderText,
  reminderKindOf,
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

/**
 * Shown when the admin list does not already include them. Dates are for 2026.
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
]

function festivalKey(name: string): string | null {
  const value = name.trim().toLowerCase()
  if (value.includes('diwali')) return 'diwali'
  if (value.includes('vijaya')) return 'vijaya'
  if (value.includes('halloween')) return 'halloween'
  if (value.includes('christmas')) return 'christmas'
  if (value.includes('nanak')) return 'nanak'
  if (value.includes('thank')) return 'thanksgiving'
  return null
}

function sameFestival(left: string, right: string): boolean {
  const a = festivalKey(left)
  const b = festivalKey(right)
  if (a && b) return a === b
  return left.trim().toLowerCase() === right.trim().toLowerCase()
}

/** Uses the familiar festival name when the saved English title is the same day under another spelling. */
function withSuggestedName(item: CommunityReminder): CommunityReminder {
  const suggested = SUGGESTED_COMMUNITY.find((row) => sameFestival(row.titles.en ?? '', item.titles.en ?? ''))
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

/** Admin days still ahead, plus Vijayadashmi and Diwali when the admin list does not already have them. */
export function communityToShow(fromServer: readonly CommunityReminder[], today: string): CommunityReminder[] {
  const upcoming = upcomingCommunity(fromServer, today).map(withSuggestedName)
  const extra = upcomingCommunity(SUGGESTED_COMMUNITY, today).filter(
    (item) => !upcoming.some((have) => sameFestival(have.titles.en ?? '', item.titles.en ?? '')),
  )
  return upcomingCommunity([...upcoming, ...extra], today).slice(0, 10)
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
export async function listCommunityReminders(today: string): Promise<CommunityReminder[]> {
  try {
    const { data, error } = await createSupabaseClient()
      .from('community_reminders')
      .select('*')
      .eq('active', true)
      .gte('day', today)
      .order('day', { ascending: true })
      .limit(50)
    if (error) throw error
    return communityToShow((data ?? []).map(fromRow), today)
  } catch {
    return communityToShow([], today)
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
