import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({
  isSupabaseConfigured: () => false,
  createSupabaseClient: () => ({}),
}))

import {
  MAX_ERRORS_PER_SESSION,
  _resetErrorReportingForTests,
  buildApiErrorProps,
  buildErrorProps,
  errorSourceName,
  reportAppError,
  scrubErrorMessage,
} from './errorReporting'
import { _peekQueueForTests, _resetTrackStateForTests, trackAppOpened } from './track'

describe('scrubErrorMessage', () => {
  it('removes web addresses, emails, long numbers and ids', () => {
    expect(scrubErrorMessage('Failed to fetch https://x.supabase.co/rest/v1/reminders?id=1')).toBe('Failed to fetch [url]')
    expect(scrubErrorMessage('Bad user ana.k@example.com here')).toBe('Bad user [email] here')
    expect(scrubErrorMessage('row 1234567 missing')).toBe('row [n] missing')
    expect(scrubErrorMessage('no 3f2b8a10-1c2d-4e5f-9a8b-0c1d2e3f4a5b')).toBe('no [id]')
  })

  it('keeps short numbers, collapses spaces and cuts long text', () => {
    expect(scrubErrorMessage('  line   42  ')).toBe('line 42')
    expect(scrubErrorMessage('x'.repeat(500))).toHaveLength(160)
  })

  it('takes the message from an Error and ignores other values', () => {
    expect(scrubErrorMessage(new TypeError('boom'))).toBe('boom')
    expect(scrubErrorMessage(42)).toBe('')
    expect(scrubErrorMessage(null)).toBe('')
  })
})

describe('errorSourceName', () => {
  it('keeps only the file name', () => {
    expect(errorSourceName('https://resuming.me/assets/index-Dk3f.js')).toBe('index-Dk3f.js')
    expect(errorSourceName('capacitor://localhost/assets/index-ab12.js?x=1')).toBe('index-ab12.js')
  })

  it('returns null for nothing or a non-address', () => {
    expect(errorSourceName('')).toBeNull()
    expect(errorSourceName(undefined)).toBeNull()
    expect(errorSourceName('not a url')).toBeNull()
  })
})

describe('buildErrorProps', () => {
  it('builds the props with scalar values only', () => {
    expect(buildErrorProps('error', 'oops', 'https://resuming.me/a/index.js', 12, 5)).toEqual({
      kind: 'error',
      message: 'oops',
      file: 'index.js',
      line: 12,
      col: 5,
    })
  })

  it('fills a missing message and drops bad positions', () => {
    expect(buildErrorProps('promise', '', null, 0, undefined)).toEqual({
      kind: 'promise',
      message: '(no message)',
      file: null,
      line: null,
      col: null,
    })
  })
})

describe('buildApiErrorProps', () => {
  it('says which request failed and what the server answered', () => {
    expect(
      buildApiErrorProps({
        method: 'POST',
        target: 'reminders',
        status: 400,
        code: 'PGRST204',
        message: "Could not find the 'week_before' column of 'reminders'",
      }),
    ).toEqual({
      kind: 'api',
      message: "HTTP 400 PGRST204: Could not find the 'week_before' column of 'reminders'",
      file: 'POST reminders',
      line: null,
      col: null,
    })
  })

  it('works with no code or message, and scrubs what the server said', () => {
    expect(buildApiErrorProps({ method: 'GET', target: 'rpc:get_shared_event', status: 500, code: null, message: null }).message).toBe(
      'HTTP 500',
    )
    expect(
      buildApiErrorProps({ method: 'GET', target: 'x', status: 403, code: null, message: 'no access for ana@example.com' }).message,
    ).toBe('HTTP 403: no access for [email]')
  })
})

describe('reportAppError', () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    const storage = {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, String(value)),
      removeItem: (key: string) => void store.delete(key),
    }
    vi.stubGlobal('localStorage', storage)
    vi.stubGlobal('window', {
      localStorage: storage,
      location: { pathname: '/today' },
      addEventListener: () => {},
      setTimeout: globalThis.setTimeout.bind(globalThis),
      clearTimeout: globalThis.clearTimeout.bind(globalThis),
    })
    vi.stubGlobal('document', { addEventListener: () => {}, visibilityState: 'visible' })
    vi.stubGlobal('navigator', { onLine: false })
    _resetErrorReportingForTests()
    _resetTrackStateForTests()
  })

  afterEach(() => {
    _resetTrackStateForTests()
    vi.unstubAllGlobals()
  })

  it('sends one app_error event', () => {
    expect(reportAppError(buildErrorProps('error', 'first'))).toBe(true)
    const queued = _peekQueueForTests().filter((event) => event.name === 'app_error')
    expect(queued).toHaveLength(1)
    expect(queued[0].props).toMatchObject({ kind: 'error', message: 'first' })
  })

  it('sends the app language with app_opened, for the installs card', () => {
    trackAppOpened()
    const opened = _peekQueueForTests().find((event) => event.name === 'app_opened')
    expect(opened?.props.locale).toBe('en')
  })

  it('sends the same error only once', () => {
    expect(reportAppError(buildErrorProps('error', 'same', 'https://a.b/i.js', 3))).toBe(true)
    expect(reportAppError(buildErrorProps('error', 'same', 'https://a.b/i.js', 3))).toBe(false)
  })

  it('stops after a few errors in one session', () => {
    for (let i = 0; i < MAX_ERRORS_PER_SESSION; i += 1) {
      expect(reportAppError(buildErrorProps('error', `distinct ${i}`))).toBe(true)
    }
    expect(reportAppError(buildErrorProps('error', 'one too many'))).toBe(false)
  })

  it('counts each kind on its own, so server failures do not use up the script-error budget', () => {
    for (let i = 0; i < MAX_ERRORS_PER_SESSION; i += 1) {
      expect(reportAppError(buildErrorProps('error', `distinct ${i}`))).toBe(true)
    }
    expect(
      reportAppError(buildApiErrorProps({ method: 'POST', target: 'reminders', status: 400, code: 'PGRST204', message: 'nope' })),
    ).toBe(true)
  })

  it('ignores the harmless resize observer message', () => {
    expect(reportAppError(buildErrorProps('error', 'ResizeObserver loop completed with undelivered notifications.'))).toBe(false)
  })
})
