import { describe, it, expect } from 'vitest'
import {
  parseMicroStepsJson,
  parseMicroStepsPayload,
  readStoredMicroSteps,
  requestMicroSteps,
} from './microSteps'

const three = [
  { text: 'Gather documents', minutes: 5 },
  { text: 'Fill out form', minutes: 8 },
  { text: 'Submit online', minutes: 7 },
]

describe('parseMicroStepsPayload', () => {
  it('accepts a steps array of strings', () => {
    expect(
      parseMicroStepsPayload({
        steps: ['A', 'B', 'C'],
      }),
    ).toEqual([{ text: 'A' }, { text: 'B' }, { text: 'C' }])
  })

  it('accepts a root array of step objects', () => {
    expect(parseMicroStepsPayload(three)).toEqual(three)
  })

  it('rejects wrong step count', () => {
    expect(parseMicroStepsPayload({ steps: ['Only one'] })).toBeNull()
  })

  it('rejects empty step text', () => {
    expect(parseMicroStepsPayload({ steps: ['A', '  ', 'C'] })).toBeNull()
  })
})

describe('parseMicroStepsJson', () => {
  it('parses fenced JSON from models', () => {
    const result = parseMicroStepsJson(
      '```json\n{"steps":["One","Two","Three"]}\n```',
    )
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.steps).toHaveLength(3)
    }
  })

  it('returns error for malformed JSON', () => {
    const result = parseMicroStepsJson('{not json')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/valid JSON/i)
    }
  })

  it('returns error for empty body', () => {
    const result = parseMicroStepsJson('   ')
    expect(result.ok).toBe(false)
  })
})

describe('readStoredMicroSteps', () => {
  it('returns empty array for corrupt stored data', () => {
    expect(readStoredMicroSteps({ steps: ['x'] })).toEqual([])
  })

  it('returns stored steps when valid', () => {
    expect(readStoredMicroSteps(three)).toEqual(three)
  })
})

describe('requestMicroSteps', () => {
  it('fails gracefully when API URL is not configured', async () => {
    const result = await requestMicroSteps('File taxes')
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/coming soon|not configured/i)
    }
  })
})
