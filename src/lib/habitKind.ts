import type { GuestActivity } from './guestDraft'
import type { TrackingMode } from '../types/database'

/** How a typed habit is measured. Catalog picks keep their own template. */
export type HabitMeasure =
  | 'minutes'
  | 'grams'
  | 'glasses'
  | 'hours'
  | 'sleep'
  | 'steps'
  | 'log'
  | 'count'

export type HabitKindPlan = {
  /** Something you do, or a number you log. */
  kind: 'activity' | 'vital'
  measure: HabitMeasure
  /** A local rule matched. Unknown names still get a timed plan; the start flow asks how to track them. */
  confident: boolean
  trackingMode: TrackingMode
  targetUnit: string | null
  /** Starting length for minutes and counts. Daily amounts stay empty until the next screen. */
  targetValue: number | null
  /** Common daily amount. The next screen says this out loud. */
  recommended: number | null
  goalSteps: number[]
  emoji: string
}

const MEASURES: readonly HabitMeasure[] = [
  'minutes',
  'grams',
  'glasses',
  'hours',
  'sleep',
  'steps',
  'log',
  'count',
]

let remoteDisabled = false

function includesWord(text: string, pattern: RegExp): boolean {
  return pattern.test(text)
}

function plan(input: {
  kind: HabitKindPlan['kind']
  measure: HabitMeasure
  confident: boolean
  recommended?: number | null
  goalSteps?: number[]
  emoji: string
}): HabitKindPlan {
  const daily =
    input.measure === 'grams' ||
    input.measure === 'glasses' ||
    input.measure === 'hours' ||
    input.measure === 'sleep' ||
    input.measure === 'steps'
  const trackingMode: TrackingMode =
    input.measure === 'minutes' ? 'timer' : input.measure === 'log' ? 'checkbox' : 'count'
  const targetUnit =
    input.measure === 'minutes'
      ? 'minutes'
      : input.measure === 'grams'
        ? 'g'
        : input.measure === 'glasses'
          ? 'glasses'
          : input.measure === 'hours'
            ? 'hours'
            : input.measure === 'sleep'
              ? 'hr'
              : input.measure === 'steps'
                ? 'steps'
                : null
  const recommended = input.recommended ?? null
  return {
    kind: input.kind,
    measure: input.measure,
    confident: input.confident,
    trackingMode,
    targetUnit,
    targetValue: daily ? null : recommended,
    recommended,
    goalSteps: input.goalSteps ?? [],
    emoji: input.emoji,
  }
}

/**
 * Decide activity vs vital from the words alone.
 * Carbs, protein, and the other gram measures get a common daily amount.
 * Anything unrecognized is a short timed activity.
 */
export function classifyHabitLocally(name: string): HabitKindPlan {
  const text = name.trim().toLowerCase()

  if (includesWord(text, /\bblood pressure\b|\bbp\b/)) {
    return plan({ kind: 'vital', measure: 'log', confident: true, emoji: '❤️' })
  }
  if (includesWord(text, /\bheart rate\b|\bpulse\b/)) {
    return plan({ kind: 'vital', measure: 'log', confident: true, emoji: '💓' })
  }
  if (includesWord(text, /\bweight\b|\bweigh\b/)) {
    return plan({ kind: 'vital', measure: 'log', confident: true, emoji: '⚖️' })
  }
  if (includesWord(text, /\bcarb(?:s|ohydrates?)?\b/)) {
    return plan({
      kind: 'vital',
      measure: 'grams',
      confident: true,
      recommended: 250,
      goalSteps: [100, 150, 200, 250, 300],
      emoji: '🍞',
    })
  }
  if (includesWord(text, /\bproteins?\b/)) {
    return plan({
      kind: 'vital',
      measure: 'grams',
      confident: true,
      recommended: 50,
      goalSteps: [20, 30, 40, 50, 60, 70],
      emoji: '🍽️',
    })
  }
  if (includesWord(text, /\bfibre\b|\bfiber\b/)) {
    return plan({
      kind: 'vital',
      measure: 'grams',
      confident: true,
      recommended: 25,
      goalSteps: [15, 20, 25, 30, 35],
      emoji: '🥦',
    })
  }
  if (includesWord(text, /\bblood sugar\b|\bsugar levels?\b|\bglucose\b/)) {
    return plan({ kind: 'vital', measure: 'log', confident: true, emoji: '🩸' })
  }
  if (includesWord(text, /\bsugars?\b/)) {
    return plan({
      kind: 'vital',
      measure: 'grams',
      confident: true,
      recommended: 25,
      goalSteps: [15, 25, 36, 50],
      emoji: '🍬',
    })
  }
  if (includesWord(text, /\bfasting\b|\bfast\b/)) {
    return plan({
      kind: 'vital',
      measure: 'hours',
      confident: true,
      recommended: 16,
      goalSteps: [8, 12, 16, 20],
      emoji: '🌙',
    })
  }
  if (includesWord(text, /\bfat\b/)) {
    return plan({
      kind: 'vital',
      measure: 'grams',
      confident: true,
      recommended: 65,
      goalSteps: [40, 55, 65, 80],
      emoji: '🥑',
    })
  }
  if (includesWord(text, /\bwater\b|\bhydration\b/)) {
    return plan({
      kind: 'vital',
      measure: 'glasses',
      confident: true,
      recommended: 8,
      goalSteps: [2, 4, 6, 8, 10],
      emoji: '💧',
    })
  }
  if (includesWord(text, /\bsleep\b/)) {
    return plan({
      kind: 'vital',
      measure: 'sleep',
      confident: true,
      recommended: 8,
      goalSteps: [6, 7, 8, 9],
      emoji: '😴',
    })
  }
  if (includesWord(text, /\bsteps?\b/)) {
    return plan({
      kind: 'vital',
      measure: 'steps',
      confident: true,
      recommended: 10000,
      goalSteps: [6000, 8000, 10000, 12000, 15000],
      emoji: '👣',
    })
  }
  if (
    includesWord(
      text,
      /\bwalk(?:ing)?\b|\bruns?\b|\brunning\b|\bexercis(?:e|ing)\b|\bread(?:ing)?\b|\bmeditat(?:e|ion|ing)\b|\bpranayam\b|\byoga\b|\bjournal(?:ing)?\b|\bstud(?:y|ying)\b|\bstretch(?:ing)?\b|\bmusic\b|\bpaint(?:ing)?\b|\bdanc(?:e|ing)\b/,
    )
  ) {
    return plan({
      kind: 'activity',
      measure: 'minutes',
      confident: true,
      recommended: 10,
      emoji: '📌',
    })
  }

  return plan({
    kind: 'activity',
    measure: 'minutes',
    confident: false,
    recommended: 10,
    emoji: '📌',
  })
}

function isMeasure(value: unknown): value is HabitMeasure {
  return typeof value === 'string' && (MEASURES as readonly string[]).includes(value)
}

function cleanSteps(raw: unknown, recommended: number | null): number[] {
  if (!Array.isArray(raw)) return recommended != null ? [recommended] : []
  const steps = raw
    .filter((item): item is number => typeof item === 'number' && Number.isFinite(item) && item > 0)
    .slice(0, 8)
  if (recommended != null && !steps.includes(recommended)) steps.push(recommended)
  return [...new Set(steps)].sort((a, b) => a - b)
}

/** Turn an AI JSON body into a plan. Wrong shapes return null. */
export function parseHabitKindPayload(raw: unknown): HabitKindPlan | null {
  if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) return null
  const body = raw as Record<string, unknown>
  const measure = body.measure ?? body.input
  if (body.kind !== 'activity' && body.kind !== 'vital') return null
  if (!isMeasure(measure)) return null
  const recommended =
    typeof body.recommended === 'number' && body.recommended > 0 ? body.recommended : null
  return plan({
    kind: body.kind,
    measure,
    confident: true,
    recommended,
    goalSteps: cleanSteps(body.options ?? body.goalSteps, measure === 'minutes' || measure === 'log' ? null : recommended),
    emoji: emojiForMeasure(measure, recommended),
  })
}

function emojiForMeasure(measure: HabitMeasure, recommended: number | null): string {
  if (measure === 'grams') return recommended != null && recommended >= 100 ? '🍞' : '🍽️'
  if (measure === 'glasses') return '💧'
  if (measure === 'hours') return '🌙'
  if (measure === 'sleep') return '😴'
  if (measure === 'steps') return '👣'
  if (measure === 'log') return '⚖️'
  return '📌'
}

function classifyUrl(): string | null {
  const explicit = import.meta.env.VITE_HABIT_CLASSIFY_API_URL?.trim()
  if (explicit) return explicit
  const base = import.meta.env.VITE_SUPABASE_URL?.trim()
  if (!base || base.includes('YOUR_PROJECT_REF') || base.includes('abcdefghijklmnop')) return null
  return `${base.replace(/\/$/, '')}/functions/v1/classify-habit`
}

/**
 * Ask the classify-habit service what this name is and what a common day looks like.
 * Returns null when the service is unset, down, or the answer is unusable.
 */
export async function refineHabitKind(name: string): Promise<HabitKindPlan | null> {
  if (remoteDisabled) return null
  const url = classifyUrl()
  if (!url) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 4000)
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim()
    if (!import.meta.env.VITE_HABIT_CLASSIFY_API_URL?.trim() && anon) {
      headers.apikey = anon
      headers.Authorization = `Bearer ${anon}`
    }
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: name.trim() }),
      signal: controller.signal,
    })
    if (response.status === 404 || response.status === 401) {
      remoteDisabled = true
      return null
    }
    if (!response.ok) return null
    return parseHabitKindPayload(await response.json())
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export function applyHabitPlan(activity: GuestActivity, next: HabitKindPlan): GuestActivity {
  const daily =
    next.measure === 'grams' ||
    next.measure === 'glasses' ||
    next.measure === 'hours' ||
    next.measure === 'sleep' ||
    next.measure === 'steps'
  return {
    ...activity,
    emoji: next.emoji,
    type: 'daily',
    trackingMode: next.trackingMode,
    targetUnit: next.targetUnit,
    targetValue: daily ? null : next.targetValue,
    measure: next.measure,
    recommended: next.recommended,
    goalSteps:
      (next.measure === 'grams' ||
        next.measure === 'glasses' ||
        next.measure === 'hours' ||
        next.measure === 'sleep' ||
        next.measure === 'steps') &&
      next.goalSteps.length > 0
        ? next.goalSteps
        : null,
  }
}
