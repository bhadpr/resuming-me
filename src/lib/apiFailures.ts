/**
 * Notices a request to our own server that failed, so a bug such as a missing database column
 * shows up in the admin Errors panel the day it happens. Only the kind of request and the error's
 * own short message are kept. Never the address's query, the request body or anything the person typed.
 *
 * This file imports nothing from the analytics code, so the Supabase client can use it without a loop.
 * The analytics side plugs in with setApiFailureReporter().
 */

export interface ApiFailure {
  method: string
  /** "reminders", "rpc:get_shared_event", "storage:event-photos", "auth:token" or "fn:classify-habit". */
  target: string
  status: number
  /** The server's own error code, such as PGRST204 or 42703. */
  code: string | null
  message: string | null
}

type Reporter = (failure: ApiFailure) => void

let reporter: Reporter | null = null

export function setApiFailureReporter(next: Reporter | null): void {
  reporter = next
}

/** Our analytics tables. A failure to record an event must not record another event. */
const SILENT_TABLES = new Set(['events', 'page_views'])

/** The part of a Supabase address that says what was asked for. Null for anything else. */
export function describeRequest(url: string): string | null {
  let path: string[]
  try {
    path = new URL(url, 'https://placeholder.invalid').pathname.split('/').filter(Boolean)
  } catch {
    return null
  }
  const [service, version, first, second, third] = path
  if (version !== 'v1' || !first) return null
  if (service === 'rest') {
    if (first === 'rpc') return second ? `rpc:${second}` : null
    return SILENT_TABLES.has(first) ? null : first
  }
  if (service === 'storage') {
    if (first !== 'object' || !second) return null
    // /object/sign/<bucket>/..., /object/public/<bucket>/..., /object/<bucket>/...
    const bucket = second === 'sign' || second === 'public' || second === 'authenticated' ? third : second
    return bucket ? `storage:${bucket}` : null
  }
  if (service === 'auth') return `auth:${first}`
  if (service === 'functions') return `fn:${first}`
  return null
}

/** Duplicates are expected (a shared link's code is retried), and a missing photo is not a bug. */
export function isReportableStatus(target: string, status: number): boolean {
  if (!Number.isFinite(status) || status < 400) return false
  if (status === 409) return false
  if (target.startsWith('storage:') && status === 404) return false
  return true
}

function shortText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().slice(0, 200) : null
}

/** The error code and message the server sent back, whichever of its services answered. */
export function errorFromBody(body: unknown): { code: string | null; message: string | null } {
  if (!body || typeof body !== 'object') return { code: null, message: null }
  const record = body as Record<string, unknown>
  const code = shortText(record.code) ?? shortText(record.error_code) ?? shortText(record.error)
  const message = shortText(record.message) ?? shortText(record.msg) ?? shortText(record.error_description)
  return { code, message }
}

function methodOf(input: RequestInfo | URL, init?: RequestInit): string {
  const given = init?.method ?? (typeof Request !== 'undefined' && input instanceof Request ? input.method : 'GET')
  return given.toUpperCase()
}

function urlOf(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

async function inspect(input: RequestInfo | URL, init: RequestInit | undefined, response: Response): Promise<void> {
  try {
    if (!reporter) return
    const target = describeRequest(urlOf(input))
    if (!target || !isReportableStatus(target, response.status)) return
    let body: unknown = null
    try {
      body = await response.clone().json()
    } catch {
      body = null
    }
    const { code, message } = errorFromBody(body)
    reporter({ method: methodOf(input, init), target, status: response.status, code, message })
  } catch {
    /* looking at a failure must never cause one */
  }
}

/** fetch for the Supabase client: the same request and response, with failures noticed on the side. */
export function reportingFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const request = globalThis.fetch(input, init)
  void request.then(
    (response) => {
      if (response.status >= 400) void inspect(input, init, response)
    },
    () => {},
  )
  return request
}
