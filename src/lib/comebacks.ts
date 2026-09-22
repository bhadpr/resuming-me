import type { Activity } from './activities'
import type { LogEntry } from './logs'
import { addDays, todayLocalDate } from './dates'
import { getDayStatus, showedUp } from './dayStatus'

/**
 * Count times in the last `windowDays` the person showed up (done or partial)
 * after 2+ consecutive missed days.
 */
export function countComebacks(
  activity: Activity,
  entries: LogEntry[],
  today = todayLocalDate(),
  windowDays = 30,
): number {
  if (activity.type === 'deadline') return 0

  const mine = entries.filter((e) => e.activity_id === activity.id)
  const created = activity.created_at.slice(0, 10)
  const windowStart = addDays(today, -(windowDays - 1))
  const from = created > windowStart ? created : windowStart
  if (from > today) return 0

  let comebacks = 0
  let missedStreak = 0

  for (let date = from; date <= today; date = addDays(date, 1)) {
    const { status } = getDayStatus({
      activity,
      entriesForDay: mine,
      date,
      today,
      timezone: 'UTC',
    })

    if (status === 'missed') {
      missedStreak += 1
      continue
    }

    if (showedUp(status)) {
      if (missedStreak >= 2) comebacks += 1
      missedStreak = 0
      continue
    }

    // skipped / rest / paused / open — do not extend the missed streak
    if (status !== 'open') missedStreak = 0
  }

  return comebacks
}
