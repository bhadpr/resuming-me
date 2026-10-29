import { describeMetric, type Metric } from '../lib/metrics'
import type { Activity } from '../lib/activities'
import { visibleName } from '../lib/catalogName'
import { useLocale } from '../hooks/useLocale'
import { ArchivedFilter } from './ArchivedFilter'
import { HabitMark } from './HabitMark'
import { Icon } from './Icon'
import { skipVitalKeys, uniqueByVitalKey, vitalKey } from '../lib/vitalKey'

interface MetricListProps {
  metrics: Metric[]
  /** Daily-goal habits added from Vitals (water, protein, fasting, steps). */
  goals?: Activity[]
  loading: boolean
  showArchived: boolean
  onToggleArchived: () => void
  onSelect: (metric: Metric) => void
  onSelectGoal?: (activity: Activity) => void
  onAdd: () => void
}

export function MetricList({
  metrics,
  goals = [],
  loading,
  showArchived,
  onToggleArchived,
  onSelect,
  onSelectGoal,
  onAdd,
}: MetricListProps) {
  const { locale, t } = useLocale()
  const visible = showArchived ? metrics : metrics.filter((m) => !m.archived)
  const archivedCount = metrics.filter((m) => m.archived).length
  const shownGoals = uniqueByVitalKey(goals)
  const shownMetrics = skipVitalKeys(
    visible,
    new Set(shownGoals.map((activity) => vitalKey(activity)).filter((key): key is string => key != null)),
  )

  return (
    <div className="activity-list-screen">
      <div className="screen-heading">
        <div>
          <h2>{t('list.vitalHeading')}</h2>
          <p className="screen-sub">{t('list.vitalSub')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          {t('list.add')}
        </button>
      </div>

      <ArchivedFilter
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggle={onToggleArchived}
        showLabel={t('list.showHiddenVitals')}
      />

      {loading ? (
        <p className="muted-center">{t('list.loading')}</p>
      ) : shownMetrics.length === 0 && shownGoals.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon"><Icon name="metrics" size={24} /></span>
          <h2>{t('list.empty')}</h2>
          <p>{t('list.vitalEmpty')}</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            {t('list.addVital')}
          </button>
        </section>
      ) : (
        <ul className="activity-list">
          {shownGoals.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                className="activity-row item-kind-vital"
                onClick={() => onSelectGoal?.(activity)}
              >
                <HabitMark name={visibleName(activity, locale)} templateId={activity.template_id} />
                <span className="activity-meta">
                  <span className="activity-name">{visibleName(activity, locale)}</span>
                  {(activity.why_matters?.trim() || activity.target_value != null) && (
                    <span className="activity-desc">
                      {activity.why_matters?.trim() ||
                        t('start.targetValue', {
                          value: String(activity.target_value),
                          unit: activity.target_unit ?? '',
                        })}
                    </span>
                  )}
                </span>
                <span className="activity-chevron" aria-hidden>
                  <Icon name="chevron" />
                </span>
              </button>
            </li>
          ))}
          {shownMetrics.map((metric) => (
            <li key={metric.id}>
              <button
                type="button"
                className={`activity-row item-kind-vital ${metric.archived ? 'activity-row-archived' : ''}`}
                onClick={() => onSelect(metric)}
              >
                <HabitMark name={visibleName(metric, locale)} templateId={metric.template_id} />
                <span className="activity-meta">
                  <span className="activity-name">
                    {visibleName(metric, locale)}
                    {metric.archived && <span className="badge">{t('list.archived')}</span>}
                  </span>
                  <span className="activity-desc">{describeMetric(metric)}</span>
                </span>
                <span className="activity-chevron" aria-hidden>
                  <Icon name="chevron" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
