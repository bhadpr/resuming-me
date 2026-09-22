import { todayLocalDate } from './dates'
import { createSupabaseClient } from './supabase'
import { zipToBlob } from './zip'

export interface UserDataExport {
  exported_at: string
  profiles: unknown[]
  activities: unknown[]
  activity_target_history: unknown[]
  log_entries: unknown[]
  metrics: unknown[]
  metric_entries: unknown[]
  feedback: unknown[]
}

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const s = String(value)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

/** Convert log_entries rows to a spreadsheet-friendly CSV. */
export function logEntriesToCsv(rows: Array<Record<string, unknown>>): string {
  const headers = [
    'id',
    'activity_id',
    'user_id',
    'type',
    'source',
    'started_at',
    'duration_seconds',
    'date',
    'note',
    'created_at',
    'updated_at',
  ]
  const lines = [headers.join(',')]
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(','))
  }
  return lines.join('\n')
}

export function exportFilename(date = todayLocalDate()): string {
  return `resuming-export-${date}.zip`
}

async function fetchAllForUser(
  table:
    | 'profiles'
    | 'activities'
    | 'activity_target_history'
    | 'log_entries'
    | 'metrics'
    | 'metric_entries'
    | 'feedback',
  userId: string,
): Promise<unknown[]> {
  const client = createSupabaseClient()
  if (table === 'profiles') {
    const { data, error } = await client.from('profiles').select('*').eq('id', userId)
    if (error) throw error
    return data ?? []
  }
  const { data, error } = await client.from(table).select('*').eq('user_id', userId)
  if (error) throw error
  return data ?? []
}

/** Load every table row owned by the signed-in user (RLS-scoped). */
export async function fetchUserDataExport(userId: string): Promise<UserDataExport> {
  const [
    profiles,
    activities,
    activity_target_history,
    log_entries,
    metrics,
    metric_entries,
    feedback,
  ] = await Promise.all([
    fetchAllForUser('profiles', userId),
    fetchAllForUser('activities', userId),
    fetchAllForUser('activity_target_history', userId),
    fetchAllForUser('log_entries', userId),
    fetchAllForUser('metrics', userId),
    fetchAllForUser('metric_entries', userId),
    fetchAllForUser('feedback', userId),
  ])

  return {
    exported_at: new Date().toISOString(),
    profiles,
    activities,
    activity_target_history,
    log_entries,
    metrics,
    metric_entries,
    feedback,
  }
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/** Build and download resuming-export-YYYY-MM-DD.zip for the current user. */
export async function downloadUserDataExport(userId: string): Promise<string> {
  const payload = await fetchUserDataExport(userId)
  const encoder = new TextEncoder()
  const dataJson = encoder.encode(`${JSON.stringify(payload, null, 2)}\n`)
  const csv = encoder.encode(
    `${logEntriesToCsv(payload.log_entries as Array<Record<string, unknown>>)}\n`,
  )
  const filename = exportFilename()
  const blob = zipToBlob([
    { name: 'data.json', data: dataJson },
    { name: 'log_entries.csv', data: csv },
  ])
  downloadBlob(blob, filename)
  return filename
}
