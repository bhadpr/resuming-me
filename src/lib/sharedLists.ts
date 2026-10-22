import { PLAY_PACKAGE } from './marketing'
import { hasWebLink, SHARED_EVENT_ORIGIN, type SharedReportReason } from './sharedEvents'
import { getOrCreateAnonId } from './track'
import { LIST_PHOTO_BUCKET, isEventPhotoPath } from './eventPhotoUrl'
import { cleanReminderText, REMINDER_TEXT_MAX } from './reminderSchedule'
import { createSupabaseClient } from './supabase'
import type { Database } from '../types/database'

export const SHARED_LIST_TITLE_MAX = 80
export const SHARED_LIST_MAX_ITEMS = 20

export type SharedListStatus = 'active' | 'off'

export interface SharedListItemDraft {
  text: string
  /** YYYY-MM-DD */
  day: string
  /** HH:MM, or empty when the reminder is for any time that day. */
  time: string
}

export interface SharedListItem {
  id: string
  text: string
  day: string
  hour: number | null
  minute: number | null
  sortOrder: number
}

export interface SharedList {
  id: string
  code: string
  title: string
  status: SharedListStatus
  createdAt: string
  /** School picture, or null. Anyone with the link can see it. */
  photoPath: string | null
  items: SharedListItem[]
}

type ListRow = Database['public']['Tables']['shared_lists']['Row']
type ItemRow = Database['public']['Tables']['shared_list_items']['Row']

export function sharedListUrl(code: string): string {
  return `${SHARED_EVENT_ORIGIN}/c/${code}`
}

export function isSharedListCode(value: string): boolean {
  return /^[a-z0-9]{6}$/.test(value)
}

/** The code from a resuming.me/c/<code> link that opened the app. */
export function sharedListCodeFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'https:') return null
    if (parsed.hostname !== 'resuming.me' && parsed.hostname !== 'www.resuming.me') return null
    const match = /^\/c\/([a-z0-9]+)\/?$/i.exec(parsed.pathname)
    const code = match?.[1].toLowerCase() ?? ''
    return isSharedListCode(code) ? code : null
  } catch {
    return null
  }
}

/** Play hands back the referrer query string. A list uses list=<code>, so it does not look like an event. */
export function listCodeFromReferrer(referrer: string): string | null {
  const code = new URLSearchParams(referrer).get('list')?.trim().toLowerCase() ?? ''
  return isSharedListCode(code) ? code : null
}

const INSTALL_LIST_CHECKED_KEY = 'resuming-install-list-checked'

/** The list code an install came with, once per install. */
export async function takeInstallListCode(
  read: () => Promise<{ referrer: string } | null>,
): Promise<string | null> {
  try {
    if (localStorage.getItem(INSTALL_LIST_CHECKED_KEY)) return null
  } catch {
    return null
  }
  const attribution = await read()
  if (!attribution) return null
  try {
    localStorage.setItem(INSTALL_LIST_CHECKED_KEY, '1')
  } catch {
    /* worst case the list shows again next start */
  }
  return listCodeFromReferrer(attribution.referrer)
}

/** The Play listing, with the list code in the install referrer. */
export function sharedListInstallLink(code: string): string {
  return `https://play.google.com/store/apps/details?id=${PLAY_PACKAGE}&referrer=${encodeURIComponent(`list=${code}`)}`
}

export function emptySharedListItem(): SharedListItemDraft {
  return { text: '', day: '', time: '' }
}

function isDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

/** Empty, or HH:MM on a real clock. */
export function parseSharedListTime(value: string): { hour: number; minute: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return { hour, minute }
}

const CSV_MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
}

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

function dayStamp(year: number, month: number, day: number): string | null {
  const stamp = `${year}-${pad2(month)}-${pad2(day)}`
  return isDay(stamp) ? stamp : null
}

/** A calendar day from a spreadsheet cell. Month/day/year when the order is ambiguous. */
function parseCsvDay(value: string): string | null {
  const text = value.trim()
  let match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(text)
  if (match) return dayStamp(Number(match[1]), Number(match[2]), Number(match[3]))
  match = /^(\d{1,2})[/. -](\d{1,2})[/. -](\d{2,4})$/.exec(text)
  if (match) {
    let year = Number(match[3])
    if (year < 100) year += 2000
    const first = Number(match[1])
    const second = Number(match[2])
    if (first > 12) return dayStamp(year, second, first)
    if (second > 12) return dayStamp(year, first, second)
    return dayStamp(year, first, second)
  }
  match = /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/.exec(text)
  if (match) {
    const month = CSV_MONTHS[match[1].toLowerCase()]
    return month ? dayStamp(Number(match[3]), month, Number(match[2])) : null
  }
  match = /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(text)
  if (match) {
    const month = CSV_MONTHS[match[2].toLowerCase()]
    return month ? dayStamp(Number(match[3]), month, Number(match[1])) : null
  }
  return null
}

/** Blank, HH:MM, or a time with am/pm. Null when the cell is not a time. */
function parseCsvTime(value: string): string | null {
  const text = value.trim()
  if (!text) return ''
  const match = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*([AaPp][Mm])?$/.exec(text)
  if (!match) return null
  let hour = Number(match[1])
  const minute = Number(match[2])
  if (minute > 59) return null
  if (match[3]) {
    if (hour < 1 || hour > 12) return null
    const pm = match[3].toLowerCase() === 'pm'
    hour = hour === 12 ? (pm ? 12 : 0) : pm ? hour + 12 : hour
  }
  if (hour > 23) return null
  return `${pad2(hour)}:${pad2(minute)}`
}

function parseCsvRows(source: string): string[][] {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"'
          i += 1
        } else quoted = false
      } else cell += ch
      continue
    }
    if (ch === '"') quoted = true
    else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n') {
      row.push(cell.trim())
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell.trim())
    rows.push(row)
  }
  return rows.filter((cells) => cells.some((value) => value !== ''))
}

function headerKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z]/g, '')
}

function headerKind(value: string): 'name' | 'date' | 'time' | 'note' | null {
  const key = headerKey(value)
  if (!key) return null
  if (CSV_DATE.has(key) || key.endsWith('date')) return 'date'
  if (CSV_TIME.has(key) || key.endsWith('time')) return 'time'
  if (CSV_NOTE.has(key) || key.includes('half')) return 'note'
  if (CSV_NAME.has(key) || key.startsWith('holiday') || key.startsWith('name') || key.endsWith('name')) return 'name'
  return null
}

const CSV_NAME = new Set(['text', 'name', 'holiday', 'event', 'title', 'description', 'reminder', 'label'])
const CSV_DATE = new Set(['date', 'day', 'when'])
const CSV_TIME = new Set(['time', 'hour'])
const CSV_NOTE = new Set(['type', 'kind', 'note', 'notes', 'detail', 'halfday'])

export type SharedListCsvResult = { ok: true; items: SharedListItemDraft[] } | { ok: false; error: string }

/**
 * Rows for the admin form, not a saved list. The admin checks them, then saves.
 * A header is optional. Without one, a date column is found from the first row.
 */
export function sharedListItemsFromCsv(source: string): SharedListCsvResult {
  const rows = parseCsvRows(source)
  if (rows.length === 0) return { ok: false, error: 'That file has no reminders.' }

  const kinds = rows[0].map(headerKind)
  const named = {
    name: kinds.indexOf('name'),
    date: kinds.indexOf('date'),
    time: kinds.indexOf('time'),
    note: kinds.indexOf('note'),
  }
  const hasHeader = named.name >= 0 && named.date >= 0
  let columns = named
  let data = rows
  if (hasHeader) {
    data = rows.slice(1)
  } else {
    const sample = rows[0]
    const date = sample.findIndex((cell) => parseCsvDay(cell) != null)
    if (date < 0) {
      return {
        ok: false,
        error: 'The file needs a name and a date on each row. Use columns like name, date, and an optional time.',
      }
    }
    const time = sample.findIndex((cell, index) => index !== date && parseCsvTime(cell) != null && cell.trim() !== '')
    const name = sample.findIndex((_, index) => index !== date && index !== time)
    if (name < 0) {
      return { ok: false, error: 'Each row needs a name as well as a date.' }
    }
    const note = sample.findIndex((_, index) => index !== date && index !== time && index !== name)
    columns = { name, date, time, note }
  }

  if (data.length === 0) return { ok: false, error: 'That file has no reminders.' }
  if (data.length > SHARED_LIST_MAX_ITEMS) {
    return {
      ok: false,
      error: `A list can hold ${SHARED_LIST_MAX_ITEMS} reminders. This file has ${data.length}.`,
    }
  }

  const items: SharedListItemDraft[] = []
  for (let index = 0; index < data.length; index += 1) {
    const cells = data[index]
    const line = hasHeader ? index + 2 : index + 1
    const day = parseCsvDay(cells[columns.date] ?? '')
    if (!day) return { ok: false, error: `Row ${line} needs a real date.` }
    const rawName = (cells[columns.name] ?? '').replace(/\s+/g, ' ').trim()
    const note = columns.note >= 0 ? (cells[columns.note] ?? '').replace(/\s+/g, ' ').trim() : ''
    const text = note && !rawName.toLowerCase().includes(note.toLowerCase()) ? `${rawName} · ${note}`.trim() : rawName
    const cleaned = cleanReminderText(text.replace(/^·\s*/, ''))
    if (!cleaned) return { ok: false, error: `Row ${line} needs a name.` }
    if (hasWebLink(cleaned)) return { ok: false, error: `Row ${line} cannot contain a web link.` }
    let time = ''
    if (columns.time >= 0 && (cells[columns.time] ?? '').trim()) {
      const parsed = parseCsvTime(cells[columns.time] ?? '')
      if (!parsed) return { ok: false, error: `Row ${line} has a time the clock doesn't have.` }
      time = parsed
    }
    items.push({ text: cleaned, day, time })
  }
  return { ok: true, items }
}

/** Why a draft cannot be saved. Null when it can. */
export function sharedListFormIssue(form: {
  title: string
  items: readonly SharedListItemDraft[]
}): 'title' | 'links' | 'empty' | 'tooMany' | 'item' | null {
  const title = form.title.replace(/\s+/g, ' ').trim()
  if (!title || title.length > SHARED_LIST_TITLE_MAX) return 'title'
  if (hasWebLink(title)) return 'links'
  const filled = form.items.filter((item) => item.text.trim() || item.day || item.time)
  if (filled.length === 0) return 'empty'
  if (filled.length > SHARED_LIST_MAX_ITEMS) return 'tooMany'
  for (const item of filled) {
    const text = cleanReminderText(item.text)
    if (!text || text.length > REMINDER_TEXT_MAX) return 'item'
    if (hasWebLink(text)) return 'links'
    if (!isDay(item.day)) return 'item'
    if (item.time && !parseSharedListTime(item.time)) return 'item'
  }
  return null
}

function fromItem(row: ItemRow): SharedListItem {
  return {
    id: row.id,
    text: row.text,
    day: row.day,
    hour: row.hour,
    minute: row.minute,
    sortOrder: row.sort_order,
  }
}

function fromList(row: ListRow, items: ItemRow[]): SharedList {
  return {
    id: row.id,
    code: row.code,
    title: row.title,
    status: row.status === 'off' ? 'off' : 'active',
    createdAt: row.created_at,
    photoPath: isEventPhotoPath(row.photo_path) ? row.photo_path : null,
    items: items
      .filter((item) => item.list_id === row.id)
      .map(fromItem)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }
}

export async function listSharedListsForAdmin(): Promise<SharedList[]> {
  const client = createSupabaseClient()
  const [{ data: lists, error: listError }, { data: items, error: itemError }] = await Promise.all([
    client.from('shared_lists').select('*').order('created_at', { ascending: false }),
    client.from('shared_list_items').select('*'),
  ])
  if (listError) throw listError
  if (itemError) throw itemError
  return (lists ?? []).map((row) => fromList(row, items ?? []))
}

export async function createSharedList(
  form: {
    title: string
    items: readonly SharedListItemDraft[]
  },
  photo: Blob | null = null,
): Promise<SharedList> {
  if (sharedListFormIssue(form)) throw new Error('That list is not complete')
  const client = createSupabaseClient()
  const title = form.title.replace(/\s+/g, ' ').trim()
  const { data: list, error } = await client.from('shared_lists').insert({ title }).select('*').single()
  if (error) throw error
  const rows = form.items
    .filter((item) => item.text.trim() || item.day || item.time)
    .map((item, index) => {
      const time = item.time ? parseSharedListTime(item.time) : null
      return {
        list_id: list.id,
        text: cleanReminderText(item.text),
        day: item.day,
        hour: time?.hour ?? null,
        minute: time?.minute ?? null,
        sort_order: index,
      }
    })
  const { data: savedItems, error: itemError } = await client.from('shared_list_items').insert(rows).select('*')
  if (itemError) {
    await client.from('shared_lists').delete().eq('id', list.id)
    throw itemError
  }
  const saved = fromList(list, savedItems ?? [])
  if (!photo) return saved
  try {
    saved.photoPath = await setSharedListPhoto(saved.id, photo, null)
  } catch {
    /* the list is saved; the admin can add the picture from the list */
  }
  return saved
}

/** One picture for the whole list. Replaces the previous picture. */
export async function setSharedListPhoto(listId: string, photo: Blob, previous: string | null): Promise<string> {
  const client = createSupabaseClient()
  const path = `${listId}/${crypto.randomUUID()}.jpg`
  const { error: uploadError } = await client.storage.from(LIST_PHOTO_BUCKET).upload(path, photo, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert: false,
  })
  if (uploadError) throw uploadError
  const { error } = await client.from('shared_lists').update({ photo_path: path }).eq('id', listId)
  if (error) {
    void client.storage.from(LIST_PHOTO_BUCKET).remove([path])
    throw error
  }
  if (previous) void client.storage.from(LIST_PHOTO_BUCKET).remove([previous])
  return path
}

export async function setSharedListOff(id: string, off: boolean): Promise<void> {
  const { error } = await createSupabaseClient()
    .from('shared_lists')
    .update({ status: off ? 'off' : 'active' })
    .eq('id', id)
  if (error) throw error
}

/** The active list for this code, or null when the code is wrong or the list is off. */
export async function getSharedList(code: string): Promise<SharedList | null> {
  if (!isSharedListCode(code)) return null
  const client = createSupabaseClient()
  const { data: list, error } = await client.from('shared_lists').select('*').eq('code', code).maybeSingle()
  if (error) throw error
  if (!list || list.status !== 'active') return null
  const { data: items, error: itemError } = await client
    .from('shared_list_items')
    .select('*')
    .eq('list_id', list.id)
  if (itemError) throw itemError
  return fromList(list, items ?? [])
}

/** Item ids this signed-in person has already accepted. */
export async function acceptedSharedListItemIds(ids: readonly string[]): Promise<string[]> {
  if (ids.length === 0) return []
  const { data, error } = await createSupabaseClient()
    .from('reminders')
    .select('shared_list_item_id')
    .in('shared_list_item_id', [...ids])
  if (error) throw error
  return (data ?? [])
    .map((row) => row.shared_list_item_id)
    .filter((id): id is string => typeof id === 'string')
}

/** Counts this account or this guest device once. A later sign-in keeps that one count. */
export async function acceptSharedList(listId: string): Promise<void> {
  const { error } = await createSupabaseClient().rpc('accept_shared_list', {
    p_list_id: listId,
    p_device_id: getOrCreateAnonId(),
  })
  if (error) throw error
}

/** Move this device's guest accepts onto the signed-in account. */
export async function claimSharedListAccepts(): Promise<void> {
  const { error } = await createSupabaseClient().rpc('claim_shared_list_accepts', {
    p_device_id: getOrCreateAnonId(),
  })
  if (error) throw error
}

/** One report per account or device. Reporting again changes nothing. */
export async function reportSharedList(listId: string, reason: SharedReportReason): Promise<void> {
  const { error } = await createSupabaseClient().rpc('report_shared_list', {
    p_list_id: listId,
    p_reason: reason,
    p_device_id: getOrCreateAnonId(),
  })
  if (error) throw error
}

export interface SharedListAdminStats {
  accepts: number
  reports: { total: number; spam: number; harmful: number; other: number }
}

/** Accept and report counts for the admin screen. No names. */
export async function sharedListStatsForAdmin(): Promise<Record<string, SharedListAdminStats>> {
  const { data, error } = await createSupabaseClient().rpc('admin_shared_list_stats')
  if (error) throw error
  const stats: Record<string, SharedListAdminStats> = {}
  for (const row of data ?? []) {
    stats[row.list_id] = {
      accepts: Number(row.accepts) || 0,
      reports: {
        total: Number(row.reports) || 0,
        spam: Number(row.spam) || 0,
        harmful: Number(row.harmful) || 0,
        other: Number(row.other) || 0,
      },
    }
  }
  return stats
}
