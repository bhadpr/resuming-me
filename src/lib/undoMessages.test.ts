import { describe, expect, it } from 'vitest'
import {
  formatCompletedUndoMessage,
  formatCountUndoMessage,
  formatMetricUndoMessage,
  formatSessionUndoMessage,
} from './undoMessages'

describe('undoMessages', () => {
  it('formats session minutes', () => {
    expect(formatSessionUndoMessage('Meditate', 120)).toBe(
      'Logged 2 min of Meditate',
    )
  })

  it('formats checkbox / deadline completions', () => {
    expect(formatCompletedUndoMessage('Floss')).toBe('Logged Floss')
  })

  it('formats count increments', () => {
    expect(formatCountUndoMessage('Push-ups')).toBe('Logged +1 of Push-ups')
  })

  it('formats metric logs', () => {
    expect(formatMetricUndoMessage('Weight', 72.5, 'kg')).toBe(
      'Logged 72.5 kg · Weight',
    )
  })
})
