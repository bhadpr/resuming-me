import type { ReactNode } from 'react'
import { useLocale } from '../hooks/useLocale'
import { reminderListKind, type Reminder } from '../lib/reminderSchedule'
import { scheduleSourceKey } from '../lib/scheduleTag'

export type TodayKind = 'habit' | 'reminder' | 'meetup' | 'holiday' | 'community' | 'vital' | 'medicine'

const TAG_KEY: Record<TodayKind, string> = {
  habit: 'list.tileHabit',
  reminder: 'reminders.sourcePersonal',
  meetup: 'reminders.sourceMeetup',
  holiday: 'reminders.sourceHoliday',
  community: 'reminders.sourceSchedule',
  vital: 'list.tileVital',
  medicine: 'medicines.tag',
}

/** Habit, Reminder, Meetup, Holiday, Community, Vital, or Medicine. */
export function todayKindForReminder(
  reminder: Pick<Reminder, 'meetup' | 'communityId' | 'sharedListItemId' | 'sharedListId'>,
): TodayKind {
  const kind = reminderListKind(reminder)
  if (kind === 'schedule') return 'community'
  return kind ?? 'reminder'
}

export function TodayKindTag({ kind, text }: { kind: TodayKind; text?: string }) {
  const { t } = useLocale()
  const key = kind === 'community' ? scheduleSourceKey(text ?? '') : TAG_KEY[kind]
  return <span className={`badge today-kind-tag today-kind-${kind}`}>{t(key)}</span>
}

/** The row name, with its type tag beside it. */
export function TaggedName({
  kind,
  text,
  className = 'activity-name',
  children,
}: {
  kind: TodayKind
  /** The reminder line, so a followed calendar can say School, NFL, or Cricket. */
  text?: string
  className?: string
  children: ReactNode
}) {
  return (
    <span className={className}>
      <span className="today-kind-label">{children}</span>
      <TodayKindTag kind={kind} text={text} />
    </span>
  )
}
