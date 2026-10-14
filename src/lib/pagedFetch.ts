/** The API returns at most this many rows per request. */
export const PAGE_SIZE = 1000
/** Past this many rows the browser should not be doing the counting. */
export const MAX_ROWS = 100_000

type Page<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

/**
 * Reads every row, one page at a time. The request must have a stable order (for example by time,
 * then id). Throws instead of returning a partial list, so a cut-off never shows up as a number.
 */
export async function fetchAllRows<T>(page: (from: number, to: number) => Page<T>): Promise<T[]> {
  const rows: T[] = []
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1)
    if (error) throw new Error(error.message)
    const batch = data ?? []
    rows.push(...batch)
    if (batch.length < PAGE_SIZE) return rows
  }
  throw new Error(`More than ${MAX_ROWS.toLocaleString()} rows in this window. Count them in the database instead.`)
}
