import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  describeRequest,
  errorFromBody,
  isReportableStatus,
  reportingFetch,
  setApiFailureReporter,
  type ApiFailure,
} from './apiFailures'

const BASE = 'https://abc.supabase.co'

describe('describeRequest', () => {
  it('names the table, function, bucket or service and nothing else', () => {
    expect(describeRequest(`${BASE}/rest/v1/reminders?select=*&user_id=eq.1234`)).toBe('reminders')
    expect(describeRequest(`${BASE}/rest/v1/rpc/get_shared_event`)).toBe('rpc:get_shared_event')
    expect(describeRequest(`${BASE}/storage/v1/object/event-photos/abc/1.jpg`)).toBe('storage:event-photos')
    expect(describeRequest(`${BASE}/storage/v1/object/sign/event-photos/abc/1.jpg?token=x`)).toBe('storage:event-photos')
    expect(describeRequest(`${BASE}/auth/v1/token?grant_type=refresh_token`)).toBe('auth:token')
    expect(describeRequest(`${BASE}/functions/v1/classify-habit`)).toBe('fn:classify-habit')
  })

  it('ignores analytics tables, other hosts and odd paths', () => {
    expect(describeRequest(`${BASE}/rest/v1/events`)).toBeNull()
    expect(describeRequest(`${BASE}/rest/v1/page_views`)).toBeNull()
    expect(describeRequest('https://example.com/api/thing')).toBeNull()
    expect(describeRequest(`${BASE}/rest/v1/`)).toBeNull()
    expect(describeRequest('not a url at all')).toBeNull()
  })
})

describe('isReportableStatus', () => {
  it('reports client and server errors', () => {
    expect(isReportableStatus('reminders', 400)).toBe(true)
    expect(isReportableStatus('reminders', 401)).toBe(true)
    expect(isReportableStatus('rpc:x', 500)).toBe(true)
  })

  it('skips success, duplicates and a photo that is not there', () => {
    expect(isReportableStatus('reminders', 200)).toBe(false)
    expect(isReportableStatus('reminders', 304)).toBe(false)
    expect(isReportableStatus('reminders', 409)).toBe(false)
    expect(isReportableStatus('storage:event-photos', 404)).toBe(false)
    expect(isReportableStatus('reminders', 404)).toBe(true)
  })
})

describe('errorFromBody', () => {
  it('reads a PostgREST error', () => {
    expect(errorFromBody({ code: 'PGRST204', message: "Could not find the 'x' column", details: null })).toEqual({
      code: 'PGRST204',
      message: "Could not find the 'x' column",
    })
  })

  it('reads an auth error and a storage error', () => {
    expect(errorFromBody({ code: 400, error_code: 'bad_jwt', msg: 'invalid JWT' })).toEqual({
      code: 'bad_jwt',
      message: 'invalid JWT',
    })
    expect(errorFromBody({ statusCode: '404', error: 'not_found', message: 'Object not found' })).toEqual({
      code: 'not_found',
      message: 'Object not found',
    })
  })

  it('survives anything else', () => {
    expect(errorFromBody(null)).toEqual({ code: null, message: null })
    expect(errorFromBody('text')).toEqual({ code: null, message: null })
  })
})

describe('reportingFetch', () => {
  afterEach(() => {
    setApiFailureReporter(null)
    vi.unstubAllGlobals()
  })

  async function settle() {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  it('returns the response untouched and reports a failed request', async () => {
    const reports: ApiFailure[] = []
    setApiFailureReporter((failure) => reports.push(failure))
    const response = new Response(JSON.stringify({ code: '42703', message: 'column does not exist' }), { status: 400 })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))

    const result = await reportingFetch(`${BASE}/rest/v1/reminders?select=*`, { method: 'post' })
    await settle()

    expect(result).toBe(response)
    expect(reports).toEqual([
      { method: 'POST', target: 'reminders', status: 400, code: '42703', message: 'column does not exist' },
    ])
    // The caller can still read the body.
    expect(await result.json()).toMatchObject({ code: '42703' })
  })

  it('reports nothing for a good response, a duplicate, or our own analytics', async () => {
    const reports: ApiFailure[] = []
    setApiFailureReporter((failure) => reports.push(failure))
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('[]', { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 409 }))
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await reportingFetch(`${BASE}/rest/v1/reminders`)
    await reportingFetch(`${BASE}/rest/v1/reminders`, { method: 'POST' })
    await reportingFetch(`${BASE}/rest/v1/events`, { method: 'POST' })
    await settle()

    expect(reports).toEqual([])
  })

  it('lets a network failure through and reports nothing', async () => {
    const reports: ApiFailure[] = []
    setApiFailureReporter((failure) => reports.push(failure))
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')))

    await expect(reportingFetch(`${BASE}/rest/v1/reminders`)).rejects.toThrow('Failed to fetch')
    await settle()

    expect(reports).toEqual([])
  })

  it('does nothing without a reporter, and a failing reporter does not break the request', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })))
    await expect(reportingFetch(`${BASE}/rest/v1/reminders`)).resolves.toBeInstanceOf(Response)

    setApiFailureReporter(() => {
      throw new Error('reporter broke')
    })
    await expect(reportingFetch(`${BASE}/rest/v1/reminders`)).resolves.toBeInstanceOf(Response)
    await settle()
  })
})
