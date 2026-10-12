import { describe, expect, it } from 'vitest'
import {
  formatCompletedUndoMessage,
  formatCountUndoMessage,
  formatMetricUndoMessage,
  formatRestDayUndoMessage,
  formatSessionUndoMessage,
  formatSkipUndoMessage,
} from './undoMessages'
import { bindLocale } from './i18n'

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

  it('formats skip and rest day', () => {
    expect(formatSkipUndoMessage('Meditate')).toBe('Skipped Meditate')
    expect(formatRestDayUndoMessage()).toBe('Rest day marked')
  })

  it('follows the app language', () => {
    bindLocale('hi')
    try {
      expect(formatCountUndoMessage('पानी')).toBe('पानी: +1 दर्ज किया')
      expect(formatSessionUndoMessage('चलना', 300)).toBe('चलना: 5 मि. दर्ज किए')
    } finally {
      bindLocale('en')
    }
  })
})
