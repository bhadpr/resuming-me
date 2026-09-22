import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadThemeFonts } from './themeFonts'

describe('loadThemeFonts', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does nothing for the default dawn theme', () => {
    const appendChild = vi.fn()
    vi.stubGlobal('document', {
      querySelector: () => null,
      head: { appendChild },
    })
    loadThemeFonts('dawn')
    expect(appendChild).not.toHaveBeenCalled()
  })

  it('injects a stylesheet for a non-default theme once', () => {
    const links = new Map<string, { rel: string; href: string; setAttribute: ReturnType<typeof vi.fn> }>()
    const appendChild = vi.fn((el: { getAttribute?: (k: string) => string | null }) => {
      const id = el.getAttribute?.('data-resuming-theme-fonts')
      if (id) links.set(id, el as never)
    })
    const created: Array<Record<string, unknown>> = []

    vi.stubGlobal('document', {
      querySelector: (sel: string) => {
        if (sel.includes('data-resuming-fonts-preconnect')) {
          return links.size > 0 || created.some((c) => c.rel === 'preconnect')
            ? created[0]
            : null
        }
        const match = /data-resuming-theme-fonts="([^"]+)"/.exec(sel)
        if (match) return links.get(match[1]) ?? null
        return null
      },
      createElement: () => {
        const el: Record<string, unknown> = {
          rel: '',
          href: '',
          crossOrigin: '',
          setAttribute: vi.fn((k: string, v: string) => {
            el[`attr:${k}`] = v
          }),
          getAttribute: (k: string) => (el[`attr:${k}`] as string | undefined) ?? null,
        }
        created.push(el)
        return el
      },
      head: { appendChild },
    })

    loadThemeFonts('vault')
    expect(appendChild).toHaveBeenCalled()
    const stylesheet = created.find((c) => c.rel === 'stylesheet')
    expect(stylesheet?.href).toEqual(expect.stringContaining('fonts.googleapis.com'))
    expect(stylesheet?.href).toEqual(expect.stringContaining('Outfit'))

    const callsBefore = appendChild.mock.calls.length
    loadThemeFonts('vault')
    expect(appendChild.mock.calls.length).toBe(callsBefore)
  })
})
