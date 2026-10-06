import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { useLocale } from '../hooks/useLocale'
import { groupByPeriod, isPeriodPast, type TimedItem } from '../lib/dayPeriod'
import { TodayDoneFold } from './TodayDoneFold'

export interface TodayTimedItem extends TimedItem {
  key: string
  done: boolean
  /** One `<li>` row. */
  node: ReactNode
}

/** Re-renders each minute so a part of the day turns late on time. */
function useMinuteClock(): Date {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])
  return now
}

/**
 * Today in Morning, Afternoon, Evening, Anytime. Finished rows fold into a Done line per part.
 * Unfinished rows in a part of the day that is already over get a soft red tint.
 */
export function TodayByTime({
  items,
  listClassName = 'today-list',
}: {
  items: readonly TodayTimedItem[]
  listClassName?: string
}) {
  const { t } = useLocale()
  const now = useMinuteClock()
  return (
    <>
      {groupByPeriod(items).map(({ period, items: inPeriod }) => {
        const open = inPeriod.filter((item) => !item.done)
        const done = inPeriod.filter((item) => item.done)
        const late = isPeriodPast(period, now)
        return (
          <section
            key={period}
            className={`today-section today-period ${late ? 'today-period-late' : ''}`.trim()}
            aria-label={t(`today.${period}`)}
          >
            <h3 className="today-period-title">{t(`today.${period}`)}</h3>
            {open.length > 0 && (
              <ul className={listClassName}>
                {open.map((item) => (
                  <Fragment key={item.key}>{item.node}</Fragment>
                ))}
              </ul>
            )}
            {done.length > 0 && (
              <TodayDoneFold label={t('today.doneCount', { count: done.length })} listClassName={listClassName}>
                {done.map((item) => (
                  <Fragment key={item.key}>{item.node}</Fragment>
                ))}
              </TodayDoneFold>
            )}
          </section>
        )
      })}
    </>
  )
}
