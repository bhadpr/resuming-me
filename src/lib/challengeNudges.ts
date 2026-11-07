import { Capacitor } from '@capacitor/core'
import { LocalNotifications } from '@capacitor/local-notifications'
import { walkingFreezeAt } from './challengeScore'
import { getChallengeBoard, myChallengeIndex, type ChallengeBoard } from './challenges'
import { addDays } from './dates'
import { t } from './i18n'

const MEMBER_BASE = 6000
const ORGANIZER_BASE = 6050
const SLOT_COUNT = 8

function ids(base: number): { id: number }[] {
  return Array.from({ length: SLOT_COUNT }, (_, index) => ({ id: base + index }))
}

/**
 * One nudge two hours before the freeze for each walking team, and one for the
 * organizer when the morning card will be ready. Only if notifications are already allowed.
 */
export async function scheduleWalkingNudges(now = new Date()): Promise<void> {
  if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('LocalNotifications')) return
  const permission = await LocalNotifications.checkPermissions()
  if (permission.display !== 'granted') return

  const index = await myChallengeIndex()
  const boards = (
    await Promise.all(index.map(async (row) => ({ row, board: await getChallengeBoard(row.code) })))
  ).filter((item): item is { row: (typeof index)[number]; board: ChallengeBoard } => item.board != null)

  const notifications: {
    id: number
    title: string
    body: string
    at: Date
  }[] = []

  boards.forEach(({ row, board }, slot) => {
    if (slot >= SLOT_COUNT || !board.scorePhase || board.scorePhase === 'final' || board.scorePhase === 'before') {
      return
    }
    const openDay = boardOpenDay(board)
    if (!openDay) return
    const freeze = walkingFreezeAt(openDay, board.timeZone)
    if (row.role === 'member') {
      const at = new Date(freeze.getTime() - 2 * 60 * 60 * 1000)
      if (at > now) {
        notifications.push({
          id: MEMBER_BASE + slot,
          title: 'Resuming',
          body: t('challenge.nudgeWalk'),
          at,
        })
      }
    }
    if (board.isOwner && freeze > now) {
      notifications.push({
        id: ORGANIZER_BASE + slot,
        title: 'Resuming',
        body: t('challenge.nudgeCard'),
        at: freeze,
      })
    }
  })

  await LocalNotifications.cancel({ notifications: [...ids(MEMBER_BASE), ...ids(ORGANIZER_BASE)] })
  if (notifications.length === 0) return
  await LocalNotifications.schedule({
    notifications: notifications.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      schedule: { at: item.at, allowWhileIdle: true },
      extra: { dest: 'today' },
      channelId: 'daily-digest',
      autoCancel: true,
    })),
  })
}

/** The open challenge day, from the day number the board already computed. */
function boardOpenDay(board: ChallengeBoard): string | null {
  if (board.scorePhase !== 'so_far' || board.dayNumber == null) return null
  return addDays(board.startsOn, board.dayNumber - 1)
}
