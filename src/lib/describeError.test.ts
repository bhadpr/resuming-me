import { describe, expect, it } from 'vitest'
import { describeError } from './describeError'

describe('describeError', () => {
  it('uses an Error message', () => {
    expect(describeError(new Error('Target value must be greater than 0'), 'Save failed')).toBe(
      'Target value must be greater than 0',
    )
  })

  it('uses the message on a database error object', () => {
    expect(
      describeError(
        { message: 'new row violates row-level security policy', code: '42501' },
        'Save failed',
      ),
    ).toBe('new row violates row-level security policy')
  })

  it('falls back when the thrown value has no message', () => {
    expect(describeError({ code: '42501' }, 'Save failed')).toBe('Save failed')
    expect(describeError(null, 'Save failed')).toBe('Save failed')
  })
})
