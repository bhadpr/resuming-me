import { describe, expect, it } from 'vitest'
import {
  capMeditationMinutes,
  capWalkingSteps,
  challengeDayWindow,
  roundSteps,
  walkingFreezeAt,
  walkingShareLines,
  walkingShareMessage,
} from './challengeScore'

describe('walking cap and rounding', () => {
  it('caps a day at 10,000 and ignores empty numbers', () => {
    expect(capWalkingSteps(22_000)).toBe(10_000)
    expect(capWalkingSteps(4_000)).toBe(4_000)
    expect(capWalkingSteps(0)).toBe(0)
    expect(capWalkingSteps(-3)).toBe(0)
  })

  it('rounds a public number to the nearest 100', () => {
    expect(roundSteps(4_750)).toBe(4_800)
    expect(roundSteps(4_000)).toBe(4_000)
    expect(roundSteps(150)).toBe(200)
  })
})

describe('meditation caps', () => {
  it('caps each sitting at an hour, then the day', () => {
    expect(capMeditationMinutes([90 * 60], 'race')).toEqual({ raw: 90, capped: 60 })
    expect(capMeditationMinutes([40 * 60, 40 * 60], 'race')).toEqual({ raw: 80, capped: 60 })
    expect(capMeditationMinutes([60 * 60, 60 * 60, 60 * 60, 60 * 60, 60 * 60, 60 * 60], 'together')).toEqual({
      raw: 360,
      capped: 300,
    })
    expect(capMeditationMinutes([45 * 60], 'together')).toEqual({ raw: 45, capped: 45 })
    expect(capMeditationMinutes([30, 30], 'race')).toEqual({ raw: 0, capped: 0 })
  })
})

describe('challenge clock', () => {
  it('reads a day from midnight to midnight in that timezone', () => {
    const india = challengeDayWindow('2026-11-05', 'Asia/Kolkata')
    expect(india.start.toISOString()).toBe('2026-11-04T18:30:00.000Z')
    expect(india.end.toISOString()).toBe('2026-11-05T18:30:00.000Z')
  })

  it('freezes at 9:00 the next morning, which is 22:30 in India for a Seattle challenge', () => {
    const freeze = walkingFreezeAt('2026-11-05', 'America/Los_Angeles')
    expect(freeze.toISOString()).toBe('2026-11-06T17:00:00.000Z')
    const india = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(freeze)
    expect(india).toBe('22:30')
  })
})

describe('walking share lines', () => {
  const url = 'https://resuming.me/t/k7mhp3wq9rtd'

  it('names the leader and one gap', () => {
    const lines = walkingShareLines({
      shape: 'race',
      phase: 'morning',
      dayNumber: 4,
      frozenDayNumber: 4,
      teams: [
        { name: 'Blue', pace: 4_750 },
        { name: 'Green', pace: 4_450 },
      ],
      total: null,
      target: null,
      daysLeft: null,
      joined: 8,
      startsLabel: '4 Nov',
    })
    expect(lines.current).toBe('Day 4: Blue leads, Green is 300 steps a day behind.')
    expect(walkingShareMessage(lines.current, url)).toBe(
      'Day 4: Blue leads, Green is 300 steps a day behind.\nhttps://resuming.me/t/k7mhp3wq9rtd',
    )
  })

  it('lists the other teams after the first gap', () => {
    const lines = walkingShareLines({
      shape: 'race',
      phase: 'so_far',
      dayNumber: 4,
      frozenDayNumber: 3,
      teams: [
        { name: 'Blue', pace: 5_000 },
        { name: 'Green', pace: 4_700 },
        { name: 'Red', pace: 4_200 },
        { name: 'Yellow', pace: 3_800 },
      ],
      recordTeams: [
        { name: 'Blue', pace: 4_800 },
        { name: 'Green', pace: 4_500 },
        { name: 'Red', pace: 4_000 },
        { name: 'Yellow', pace: 3_600 },
      ],
      total: null,
      target: null,
      daysLeft: null,
      joined: 20,
      startsLabel: '4 Nov',
    })
    expect(lines.current).toBe(
      'So far, Day 4: Blue leads. Green is 300 steps a day behind, Red 800, Yellow 1,200',
    )
    expect(lines.record).toBe(
      'Day 3: Blue leads. Green is 300 steps a day behind, Red 800, Yellow 1,200',
    )
  })

  it('calls a rounded tie even', () => {
    const lines = walkingShareLines({
      shape: 'race',
      phase: 'final',
      dayNumber: 7,
      frozenDayNumber: 7,
      teams: [
        { name: 'Blue', pace: 4_040 },
        { name: 'Green', pace: 3_980 },
      ],
      total: null,
      target: null,
      daysLeft: null,
      joined: 6,
      startsLabel: '4 Nov',
    })
    expect(lines.current).toBe('Final: Blue and Green finish even.')
  })

  it('names the only scored team with the pace', () => {
    const lines = walkingShareLines({
      shape: 'race',
      phase: 'so_far',
      dayNumber: 5,
      frozenDayNumber: null,
      teams: [
        { name: 'Night owls', pace: 6_575 },
        { name: 'Early birds', pace: null },
      ],
      total: null,
      target: null,
      daysLeft: null,
      joined: 5,
      startsLabel: '6 Nov',
    })
    expect(lines.current).toBe('So far, Day 5: Night owls leads at 6,600 steps a day.')
  })

  it('hides the pace while fewer than three people are in', () => {
    const lines = walkingShareLines({
      shape: 'race',
      phase: 'so_far',
      dayNumber: 2,
      frozenDayNumber: null,
      teams: [
        { name: 'Blue', pace: null },
        { name: 'Green', pace: null },
      ],
      total: null,
      target: null,
      daysLeft: null,
      joined: 2,
      startsLabel: '4 Nov',
    })
    expect(lines.current).toBe('So far, Day 2: 2 joined.')
    expect(lines.record).toBeNull()
  })

  it('states a shared goal in steps, and says when it is reached', () => {
    const open = walkingShareLines({
      shape: 'together',
      phase: 'so_far',
      dayNumber: 4,
      frozenDayNumber: 3,
      teams: [{ name: 'Everyone', pace: null }],
      total: 420_040,
      recordTotal: 300_000,
      target: 1_000_000,
      daysLeft: 3,
      recordDaysLeft: 4,
      joined: 12,
      startsLabel: '4 Nov',
    })
    expect(open.current).toBe('So far, Day 4: 4,20,000 of 10,00,000 steps. 5,80,000 steps to go, 3 days left.')
    expect(open.record).toBe('Day 3: 3,00,000 of 10,00,000 steps. 7,00,000 steps to go, 4 days left.')

    const reached = walkingShareLines({
      shape: 'together',
      phase: 'final',
      dayNumber: 10,
      frozenDayNumber: 10,
      teams: [{ name: 'Everyone', pace: null }],
      total: 1_040_000,
      target: 1_000_000,
      daysLeft: 0,
      joined: 12,
      startsLabel: '4 Nov',
    })
    expect(reached.current).toBe('Final: 10,40,000 of 10,00,000 steps. Goal reached.')
  })

  it('says minutes for a race and hours for a shared meditation goal', () => {
    const race = walkingShareLines({
      shape: 'race',
      phase: 'so_far',
      dayNumber: 2,
      frozenDayNumber: null,
      teams: [
        { name: 'Blue', pace: 45.4 },
        { name: 'Green', pace: 30 },
      ],
      total: null,
      target: null,
      daysLeft: 5,
      joined: 6,
      startsLabel: '4 Nov',
      measure: 'minutes',
    })
    expect(race.current).toBe('So far, Day 2: Blue leads, Green is 15 minutes a day behind.')

    const goal = walkingShareLines({
      shape: 'together',
      phase: 'so_far',
      dayNumber: 3,
      frozenDayNumber: null,
      teams: [{ name: 'Everyone', pace: null }],
      total: 9_030,
      target: 60_000,
      daysLeft: 4,
      joined: 6,
      startsLabel: '4 Nov',
      measure: 'minutes',
    })
    expect(goal.current).toBe('So far, Day 3: 151 of 1,000 hours. 850 hours to go, 4 days left.')

    const small = walkingShareLines({
      shape: 'together',
      phase: 'so_far',
      dayNumber: 3,
      frozenDayNumber: null,
      teams: [{ name: 'Everyone', pace: null }],
      total: 90,
      target: 2_400,
      daysLeft: 4,
      joined: 6,
      startsLabel: '4 Nov',
      measure: 'minutes',
    })
    expect(small.current).toBe('So far, Day 3: 1.5 of 40 hours. 38.5 hours to go, 4 days left.')
  })

  it('names the start before day 1', () => {
    const lines = walkingShareLines({
      shape: 'race',
      phase: 'before',
      dayNumber: null,
      frozenDayNumber: null,
      teams: [],
      total: null,
      target: null,
      daysLeft: null,
      joined: 4,
      startsLabel: '12 Nov',
    })
    expect(lines.current).toBe('Starts 12 Nov. 4 joined.')
  })
})
