import { describeMetric, type Metric } from '../lib/metrics'
import { visibleName } from '../lib/catalogName'
import { useLocale } from '../hooks/useLocale'
import { ArchivedFilter } from './ArchivedFilter'
import { HabitMark } from './HabitMark'
import { Icon } from './Icon'

interface MetricListProps {
  metrics: Metric[]
  loading: boolean
  showArchived: boolean
  onToggleArchived: () => void
  onSelect: (metric: Metric) => void
  onAdd: () => void
}

export function MetricList({
  metrics,
  loading,
  showArchived,
  onToggleArchived,
  onSelect,
  onAdd,
}: MetricListProps) {
  const { locale, t } = useLocale()
  const visible = showArchived ? metrics : metrics.filter((m) => !m.archived)
  const archivedCount = metrics.filter((m) => m.archived).length

  return (
    <div className="activity-list-screen">
      <div className="screen-heading">
        <div>
          <h2>{t('nav.vitals')}</h2>
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
      ) : visible.length === 0 ? (
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
          {visible.map((metric) => (
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
