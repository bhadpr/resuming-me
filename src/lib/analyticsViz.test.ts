import { describe, expect, it } from 'vitest'
import {
  compactNumber,
  donutSegments,
  donutSlices,
  funnelRows,
  heatStrength,
  percentText,
  sparkHeights,
} from './analyticsViz'

const row = (key: string, count: number) => ({ key, label: key, count })

describe('donutSlices', () => {
  it('shares the total between the rows, biggest first', () => {
    const slices = donutSlices([row('a', 1), row('b', 3)])
    expect(slices.map((s) => s.key)).toEqual(['b', 'a'])
    expect(slices[0].share).toBeCloseTo(0.75)
    expect(slices[0].tone).toBe('blue')
    expect(slices[1].tone).toBe('green')
  })

  it('keeps a color the row asked for', () => {
    const slices = donutSlices([row('a', 1), { ...row('b', 3), tone: 'rose' }])
    expect(slices[0]).toMatchObject({ key: 'b', tone: 'rose' })
    expect(slices[1].tone).toBe('green')
  })

  it('leaves out empty rows and returns nothing for no data', () => {
    expect(donutSlices([row('a', 0)])).toEqual([])
    expect(donutSlices([])).toEqual([])
    expect(donutSlices([row('a', 0), row('b', 2)]).map((s) => s.key)).toEqual(['b'])
  })

  it('folds the small rows into one grey Other slice', () => {
    const rows = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((key, i) => row(key, 100 - i))
    const slices = donutSlices(rows, 4)
    expect(slices).toHaveLength(4)
    expect(slices[3]).toMatchObject({ key: '__other', tone: 'slate', label: 'Other (5)' })
    expect(slices.reduce((sum, s) => sum + s.share, 0)).toBeCloseTo(1)
  })

  it('does not fold when the rows fit', () => {
    expect(donutSlices([row('a', 1), row('b', 1), row('c', 1)], 3)).toHaveLength(3)
  })
})

describe('donutSegments', () => {
  it('places each part after the one before it', () => {
    const segments = donutSegments(donutSlices([row('a', 1), row('b', 3)]), 100)
    expect(segments[0]).toEqual({ dash: 75, gap: 25, offset: -0 })
    expect(segments[1].dash).toBeCloseTo(25)
    expect(segments[1].offset).toBeCloseTo(-75)
  })

  it('fills the ring with one slice', () => {
    expect(donutSegments(donutSlices([row('a', 5)]), 50)).toEqual([{ dash: 50, gap: 0, offset: -0 }])
  })
})

describe('funnelRows', () => {
  it('works out the share of the start, of the step before, and who was lost', () => {
    const rows = funnelRows([
      { label: 'Landing', value: 200 },
      { label: 'Setup', value: 50 },
      { label: 'Account', value: 10 },
    ])
    expect(rows[0]).toMatchObject({ ofFirst: 1, ofPrevious: null, lost: 0 })
    expect(rows[1]).toMatchObject({ ofFirst: 0.25, ofPrevious: 0.25, lost: 150 })
    expect(rows[2]).toMatchObject({ ofFirst: 0.05, ofPrevious: 0.2, lost: 40 })
  })

  it('has no shares when the start is empty and never reports a negative loss', () => {
    const rows = funnelRows([
      { label: 'a', value: 0 },
      { label: 'b', value: 3 },
    ])
    expect(rows[1]).toMatchObject({ ofFirst: null, ofPrevious: null, lost: 0 })
    expect(funnelRows([])).toEqual([])
  })
})

describe('percentText', () => {
  it('rounds, and shows a dash when there is nothing to compare', () => {
    expect(percentText(1, 3)).toBe('33%')
    expect(percentText(0, 5)).toBe('0%')
    expect(percentText(2, 0)).toBe('—')
  })
})

describe('heatStrength', () => {
  it('scales a rate up to full strength, and leaves a missing one uncolored', () => {
    expect(heatStrength(0.3)).toBe(50)
    expect(heatStrength(0.9)).toBe(100)
    expect(heatStrength(0)).toBe(0)
    expect(heatStrength(null)).toBe(0)
    expect(heatStrength(NaN)).toBe(0)
  })
})

describe('compactNumber', () => {
  it('shortens big numbers', () => {
    expect(compactNumber(7)).toBe('7')
    expect(compactNumber(1200)).toBe('1.2k')
    expect(compactNumber(2000)).toBe('2k')
    expect(compactNumber(15400)).toBe('15k')
    expect(compactNumber(2_500_000)).toBe('2.5M')
    expect(compactNumber(NaN)).toBe('—')
  })
})

describe('sparkHeights', () => {
  it('scales to the biggest point, and is flat when everything is zero', () => {
    expect(sparkHeights([1, 2, 4])).toEqual([25, 50, 100])
    expect(sparkHeights([0, 0])).toEqual([0, 0])
    expect(sparkHeights([])).toEqual([])
  })
})
