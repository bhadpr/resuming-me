import { Fragment, type ReactNode } from 'react'
import { useLocale } from '../hooks/useLocale'
import { groupByPeriod, type TimedItem } from '../lib/dayPeriod'
import { TodayDoneFold } from './TodayDoneFold'

export interface TodayTimedItem extends TimedItem {
  key: string
  done: boolean
  /** One `<li>` row. */
  node: ReactNode
}

/** Today in Morning, Afternoon, Evening, Anytime. Finished rows fold into a Done line per part. */
export function TodayByTime({
  items,
  listClassName = 'today-list',
}: {
  items: readonly TodayTimedItem[]
  listClassName?: string
}) {
  const { t } = useLocale()
  return (
    <>
      {groupByPeriod(items).map(({ period, items: inPeriod }) => {
        const open = inPeriod.filter((item) => !item.done)
        const done = inPeriod.filter((item) => item.done)
        return (
          <section key={period} className="today-section today-period" aria-label={t(`today.${period}`)}>
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
