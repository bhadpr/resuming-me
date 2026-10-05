import { describe, expect, it } from 'vitest'
import { birthdayEmailCopy } from './birthdayEmail'

describe('birthdayEmailCopy', () => {
  it('stays a short comeback note', () => {
    expect(birthdayEmailCopy()).toEqual({
      subject: 'Happy birthday',
      text: 'Happy birthday. One small thing today is enough.',
    })
  })
})
