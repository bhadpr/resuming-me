import { describe, expect, it } from 'vitest'
import { fetchAllRows, MAX_ROWS, PAGE_SIZE } from './pagedFetch'

function source(total: number) {
  const calls: Array<[number, number]> = []
  const page = (from: number, to: number) => {
    calls.push([from, to])
    const data = Array.from({ length: Math.max(0, Math.min(to + 1, total) - from) }, (_, i) => from + i)
    return Promise.resolve({ data, error: null })
  }
  return { page, calls }
}

describe('fetchAllRows', () => {
  it('reads every page until a short one, so nothing is cut off at the page size', async () => {
    const { page, calls } = source(PAGE_SIZE * 2 + 5)
    const rows = await fetchAllRows(page)
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 5)
    expect(rows[PAGE_SIZE * 2 + 4]).toBe(PAGE_SIZE * 2 + 4)
    expect(calls).toHaveLength(3)
  })

  it('stops after an exactly full page followed by an empty one', async () => {
    const { page, calls } = source(PAGE_SIZE)
    expect(await fetchAllRows(page)).toHaveLength(PAGE_SIZE)
    expect(calls).toHaveLength(2)
  })

  it('throws instead of returning a partial list', async () => {
    const { page } = source(MAX_ROWS + 10)
    await expect(fetchAllRows(page)).rejects.toThrow(/Count them in the database/)
  })

  it('passes a database error on', async () => {
    await expect(fetchAllRows(() => Promise.resolve({ data: null, error: { message: 'boom' } }))).rejects.toThrow('boom')
  })
})
