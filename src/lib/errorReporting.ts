import { setApiFailureReporter, type ApiFailure } from './apiFailures'
import { track, type EventProps } from './track'

/** A person who hits the same bug in a loop would otherwise fill the table. Counted for each kind. */
export const MAX_ERRORS_PER_SESSION = 5
const MAX_MESSAGE = 160

/** A script error, a promise nobody waited for, or a request to our server that failed. */
export type AppErrorKind = 'error' | 'promise' | 'api'

/** The browser raises these for harmless reasons, so they say nothing about a bug. */
const IGNORED_MESSAGES = [/ResizeObserver loop/i]

const seen = new Set<string>()
const sentByKind = new Map<string, number>()
let installed = false

/**
 * The error text with anything personal taken out: web addresses, emails, long numbers, ids.
 * Only a short message is kept. The error's stack is never sent.
 */
export function scrubErrorMessage(value: unknown): string {
  const text = typeof value === 'string' ? value : value instanceof Error ? value.message : ''
  return text
    .replace(/https?:\/\/\S+/gi, '[url]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[email]')
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '[id]')
    .replace(/\d{6,}/g, '[n]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_MESSAGE)
}

/** "index-Dk3f.js" from a full script address. Null when it is not an address. */
export function errorSourceName(filename: string | null | undefined): string | null {
  if (!filename) return null
  try {
    const name = new URL(filename).pathname.split('/').filter(Boolean).pop() ?? ''
    return name ? name.slice(0, 80) : null
  } catch {
    return null
  }
}

export function buildErrorProps(
  kind: AppErrorKind,
  message: unknown,
  filename?: string | null,
  line?: number | null,
  column?: number | null,
): EventProps {
  const props: EventProps = {
    kind,
    message: scrubErrorMessage(message) || '(no message)',
    file: errorSourceName(filename),
    line: typeof line === 'number' && line > 0 ? line : null,
    col: typeof column === 'number' && column > 0 ? column : null,
  }
  return props
}

/**
 * A failed request to our server, such as "HTTP 400 PGRST204: Could not find the 'x' column of
 * 'reminders'". The `file` says which request: "POST reminders" or "GET rpc:get_shared_event".
 */
export function buildApiErrorProps(failure: ApiFailure): EventProps {
  const detail = failure.message ? `: ${failure.message}` : ''
  const code = failure.code ? ` ${failure.code}` : ''
  return {
    kind: 'api',
    message: scrubErrorMessage(`HTTP ${failure.status}${code}${detail}`),
    file: `${failure.method} ${failure.target}`.slice(0, 80),
    line: null,
    col: null,
  }
}

/** Sends one `app_error` event, once per distinct error and at most a few of each kind per session. */
export function reportAppError(props: EventProps): boolean {
  const message = String(props.message ?? '')
  const kind = String(props.kind ?? 'error')
  if (IGNORED_MESSAGES.some((pattern) => pattern.test(message))) return false
  if ((sentByKind.get(kind) ?? 0) >= MAX_ERRORS_PER_SESSION) return false
  const key = `${kind}|${message}|${props.file}|${props.line}`
  if (seen.has(key)) return false
  seen.add(key)
  sentByKind.set(kind, (sentByKind.get(kind) ?? 0) + 1)
  track('app_error', props)
  return true
}

/**
 * Report errors the app did not catch (a script error, a promise that failed with nobody waiting
 * for it) and requests to our server that failed. Call once at start. Never throws, so reporting
 * cannot make a bug worse.
 */
export function installErrorReporting(): void {
  if (installed || typeof window === 'undefined') return
  installed = true

  window.addEventListener('error', (event) => {
    try {
      reportAppError(buildErrorProps('error', event.message || event.error, event.filename, event.lineno, event.colno))
    } catch {
      /* reporting must never fail the app */
    }
  })

  window.addEventListener('unhandledrejection', (event) => {
    try {
      const reason: unknown = event.reason
      const text = reason instanceof Error ? reason.message : typeof reason === 'string' ? reason : 'Promise rejected'
      reportAppError(buildErrorProps('promise', text))
    } catch {
      /* reporting must never fail the app */
    }
  })

  setApiFailureReporter((failure) => {
    try {
      reportAppError(buildApiErrorProps(failure))
    } catch {
      /* reporting must never fail the app */
    }
  })
}

export function _resetErrorReportingForTests(): void {
  seen.clear()
  sentByKind.clear()
  installed = false
  setApiFailureReporter(null)
}
