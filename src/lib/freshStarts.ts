import { createSupabaseClient } from './supabase'
import type { FreshStartRange, WelcomeBackState } from './comeback'

const LOCAL_KEY = 'resuming-welcome-back'
const SHOW_KEY = 'resuming-show-everything'

export function loadWelcomeBackState(): WelcomeBackState {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return { lastGapStartedAt: null, dismissedUntil: null }
    const parsed = JSON.parse(raw) as Partial<WelcomeBackState>
    return {
      lastGapStartedAt: parsed.lastGapStartedAt ?? null,
      dismissedUntil: parsed.dismissedUntil ?? null,
    }
  } catch {
    return { lastGapStartedAt: null, dismissedUntil: null }
  }
}

export function saveWelcomeBackState(state: WelcomeBackState): void {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(state))
}

export function loadShowEverything(): boolean {
  return localStorage.getItem(SHOW_KEY) === '1'
}

export function saveShowEverything(on: boolean): void {
  localStorage.setItem(SHOW_KEY, on ? '1' : '0')
}

export async function listFreshStarts(userId: string): Promise<FreshStartRange[]> {
  const { data, error } = await createSupabaseClient()
    .from('fresh_starts')
    .select('id, started_on, covers_from, covers_to')
    .eq('user_id', userId)
    .order('started_on', { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    id: row.id,
    startedOn: row.started_on,
    coversFrom: row.covers_from,
    coversTo: row.covers_to,
  }))
}

export async function insertFreshStart(
  userId: string,
  range: Omit<FreshStartRange, 'id'>,
): Promise<FreshStartRange> {
  const { data, error } = await createSupabaseClient()
    .from('fresh_starts')
    .insert({
      user_id: userId,
      started_on: range.startedOn,
      covers_from: range.coversFrom,
      covers_to: range.coversTo,
    })
    .select('id, started_on, covers_from, covers_to')
    .single()
  if (error) throw error
  return {
    id: data.id,
    startedOn: data.started_on,
    coversFrom: data.covers_from,
    coversTo: data.covers_to,
  }
}

export async function deleteFreshStart(id: string): Promise<void> {
  const { error } = await createSupabaseClient().from('fresh_starts').delete().eq('id', id)
  if (error) throw error
}
