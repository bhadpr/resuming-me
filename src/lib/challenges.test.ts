import { describe, expect, it } from 'vitest'
import {
  challengeCodeFromUrl,
  challengeHasEnded,
  defaultChallengeShare,
  challengeIssue,
  challengeUrl,
  goalSpanOk,
  isChallengeCode,
  raceLastDay,
  stepTargetOk,
  teamNamesOk,
  walkingJoinGate,
} from './challenges'

describe('challenge link', () => {
  it('adds a new version when the card picture changes', () => {
    expect(challengeUrl('k7mhp3wq9rtd')).toBe('https://resuming.me/t/k7mhp3wq9rtd')
    expect(challengeCodeFromUrl('com.cheerfulgames.resuming:///t/k7mhp3wq9rtd')).toBe('k7mhp3wq9rtd')
    expect(challengeUrl('k7mhp3wq9rtd', '85fa4b05-7820-4dbb-aded-24a6148ee9fe/f3fdb14f-0667-42ea-8243-2c63c844110e.jpg')).toBe(
      'https://resuming.me/t/k7mhp3wq9rtd?v=f3fdb14f',
    )
  })

  it('starts a group and a team from different sentences', () => {
    expect(
      defaultChallengeShare({ title: 'Friend walk', shape: 'together', kind: 'walk', locale: 'en' }),
    ).toBe('Friend walk. Join the group. Everyone adds toward one number.')
    expect(defaultChallengeShare({ title: 'Friend walk', shape: 'race', kind: 'walk', locale: 'en' })).toBe(
      'Friend walk. Join a team and walk this week.',
    )
    expect(
      defaultChallengeShare({ title: 'Morning sit', shape: 'together', kind: 'meditate', locale: 'en' }),
    ).toBe('Morning sit. Join the group. Everyone adds their minutes.')
  })
})

describe('challenge codes', () => {
  it('accepts a 12-character code from the shared-event alphabet', () => {
    expect(isChallengeCode('k7mhp3wq9rtd')).toBe(true)
    expect(isChallengeCode('k7mhp3wq9rt')).toBe(false)
    expect(isChallengeCode('k7mhp3wq9rtdd')).toBe(false)
    expect(isChallengeCode('o0il1abcdefg')).toBe(false)
  })
})

describe('a finished challenge', () => {
  const noon = new Date('2026-11-07T20:00:00Z')

  it('closes the day after the last day, and when the result is final', () => {
    expect(
      challengeHasEnded(
        { status: 'active', scorePhase: 'so_far', endsOn: '2026-11-04', timeZone: 'America/Los_Angeles' },
        noon,
      ),
    ).toBe(true)
    expect(
      challengeHasEnded(
        { status: 'active', scorePhase: 'final', endsOn: '2026-11-10', timeZone: 'America/Los_Angeles' },
        noon,
      ),
    ).toBe(true)
    expect(
      challengeHasEnded(
        { status: 'ended', scorePhase: 'so_far', endsOn: '2026-11-10', timeZone: 'America/Los_Angeles' },
        noon,
      ),
    ).toBe(true)
    expect(
      challengeHasEnded(
        { status: 'active', scorePhase: 'so_far', endsOn: '2026-11-10', timeZone: 'America/Los_Angeles' },
        noon,
      ),
    ).toBe(false)
  })
})

describe('challenge dates', () => {
  it('makes a race seven days long', () => {
    expect(raceLastDay('2026-11-04')).toBe('2026-11-10')
  })

  it('accepts a shared goal of 7 to 366 days', () => {
    expect(goalSpanOk('2026-11-04', '2026-11-10')).toBe(true)
    expect(goalSpanOk('2026-11-04', '2027-11-04')).toBe(true)
    expect(goalSpanOk('2026-11-04', '2026-11-09')).toBe(false)
    expect(goalSpanOk('2026-11-04', '2027-11-05')).toBe(false)
  })
})

describe('team names and targets', () => {
  it('requires two to four different names for a race', () => {
    expect(teamNamesOk('race', ['Blue', 'Green'])).toBe(true)
    expect(teamNamesOk('race', ['Blue', ' blue '])).toBe(false)
    expect(teamNamesOk('race', ['Blue'])).toBe(false)
    expect(teamNamesOk('race', ['A', 'B', 'C', 'D', 'E'])).toBe(false)
  })

  it('requires one name for a shared goal', () => {
    expect(teamNamesOk('together', ['Everyone'])).toBe(true)
    expect(teamNamesOk('together', ['Everyone', 'Else'])).toBe(false)
  })

  it('reads a step target', () => {
    expect(stepTargetOk('1,000,000')).toBe(1_000_000)
    expect(stepTargetOk('0')).toBeNull()
    expect(stepTargetOk('12 steps')).toBeNull()
  })
})

describe('walking join gate', () => {
  it('blocks the web and iPhone', () => {
    expect(walkingJoinGate('web', { status: 'count', steps: 4000 })).toBe('blocked')
    expect(walkingJoinGate('ios', { status: 'count', steps: 4000 })).toBe('blocked')
  })

  it('asks Android to connect, confirm an empty source, or join', () => {
    expect(walkingJoinGate('android', { status: 'unavailable' })).toBe('blocked')
    expect(walkingJoinGate('android', { status: 'needs-permission' })).toBe('connect')
    expect(walkingJoinGate('android', { status: 'denied' })).toBe('connect')
    expect(walkingJoinGate('android', { status: 'count', steps: 0 })).toBe('confirm-empty')
    expect(walkingJoinGate('android', { status: 'count', steps: 1200 })).toBe('join')
  })
})

describe('challenge errors', () => {
  it('maps server exceptions', () => {
    expect(challengeIssue({ message: 'challenge_creator_cap' })).toBe('creatorCap')
    expect(challengeIssue({ message: 'challenge_not_android' })).toBe('notAndroid')
    expect(challengeIssue({ message: 'something else' })).toBe('failed')
  })
})
