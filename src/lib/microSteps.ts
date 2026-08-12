/** One AI-suggested micro-step for a deadline activity (<10 min each in v2). */
export interface MicroStep {
  text: string
  minutes?: number
}

export type MicroStepsRequestResult =
  | { ok: true; steps: MicroStep[] }
  | { ok: false; error: string }

const STEP_COUNT = 3

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeStep(raw: unknown): MicroStep | null {
  if (typeof raw === 'string') {
    const text = raw.trim()
    return text ? { text } : null
  }
  if (isRecord(raw) && typeof raw.text === 'string') {
    const text = raw.text.trim()
    if (!text) return null
    const minutes =
      typeof raw.minutes === 'number' && raw.minutes > 0 ? raw.minutes : undefined
    return { text, minutes }
  }
  return null
}

function normalizeStepsArray(raw: unknown): MicroStep[] | null {
  if (!Array.isArray(raw)) return null
  const steps = raw.map(normalizeStep).filter((s): s is MicroStep => s !== null)
  if (steps.length !== STEP_COUNT) return null
  return steps
}

/**
 * Validate parsed JSON into exactly three micro-steps.
 * Returns null when shape or count is wrong — never throws.
 */
export function parseMicroStepsPayload(raw: unknown): MicroStep[] | null {
  if (Array.isArray(raw)) {
    return normalizeStepsArray(raw)
  }
  if (!isRecord(raw)) return null

  if ('steps' in raw) {
    return normalizeStepsArray(raw.steps)
  }
  if ('microSteps' in raw) {
    return normalizeStepsArray(raw.microSteps)
  }
  return null
}

/** Parse a JSON string; strips optional ```json fences from model output. */
export function parseMicroStepsJson(text: string): MicroStepsRequestResult {
  const trimmed = text.trim()
  if (!trimmed) {
    return { ok: false, error: 'Breakdown came back empty. Try again later.' }
  }

  let body = trimmed
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i)
  if (fenced) {
    body = fenced[1].trim()
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(body)
  } catch {
    return {
      ok: false,
      error: 'Breakdown was not valid JSON. Try again later.',
    }
  }

  const steps = parseMicroStepsPayload(parsed)
  if (!steps) {
    return {
      ok: false,
      error: `Breakdown needs exactly ${STEP_COUNT} steps. Try again later.`,
    }
  }

  return { ok: true, steps }
}

/** Read persisted micro_steps from Supabase jsonb without throwing. */
export function readStoredMicroSteps(raw: unknown): MicroStep[] {
  const steps = parseMicroStepsPayload(raw)
  return steps ?? []
}

function microStepsApiUrl(): string | null {
  const url = import.meta.env.VITE_MICRO_STEPS_API_URL?.trim()
  return url || null
}

/**
 * Request micro-steps from the configured API (v2).
 * When unset or the response is bad, returns a user-safe error — never throws.
 */
export async function requestMicroSteps(
  taskName: string,
): Promise<MicroStepsRequestResult> {
  const url = microStepsApiUrl()
  if (!url) {
    return {
      ok: false,
      error:
        'AI breakdown is coming soon. Wire VITE_MICRO_STEPS_API_URL when the micro-step service is ready.',
    }
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskName: taskName.trim() }),
    })
  } catch {
    return {
      ok: false,
      error: 'Could not reach the breakdown service. Check your connection and try again.',
    }
  }

  const text = await response.text()
  if (!response.ok) {
    return {
      ok: false,
      error: text.trim()
        ? `Breakdown failed (${response.status}). Try again later.`
        : `Breakdown failed (${response.status}). Try again later.`,
    }
  }

  return parseMicroStepsJson(text)
}
