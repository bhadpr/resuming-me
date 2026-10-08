import { describeActivity, type Activity } from '../lib/activities'
import { findActivePause, type ActivityPauseRow } from '../lib/activityPauses'
import { groupTitle, visibleName } from '../lib/catalogName'
import { groupByHabitGroup } from '../data/activityTemplates'
import { habitTemplateId } from '../data/habitArt'
import { useLocale } from '../hooks/useLocale'
import { ArchivedFilter } from './ArchivedFilter'
import { HabitMark } from './HabitMark'
import { Icon } from './Icon'

interface ActivityListProps {
  activities: Activity[]
  pauses?: ActivityPauseRow[]
  loading: boolean
  showArchived: boolean
  onToggleArchived: () => void
  onSelect: (activity: Activity) => void
  onAdd: () => void
}

export function ActivityList({
  activities,
  pauses = [],
  loading,
  showArchived,
  onToggleArchived,
  onSelect,
  onAdd,
}: ActivityListProps) {
  const { locale, t } = useLocale()
  const visible = showArchived
    ? activities
    : activities.filter((a) => !a.archived)
  const archivedCount = activities.filter((a) => a.archived).length

  return (
    <div className="activity-list-screen">
      <div className="screen-heading">
        <div>
          <h2>{t('nav.abhyas')}</h2>
          <p className="screen-sub">{t('list.activitySub')}</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          {t('list.add')}
        </button>
      </div>

      <ArchivedFilter
        showArchived={showArchived}
        archivedCount={archivedCount}
        onToggle={onToggleArchived}
        showLabel={t('list.showHiddenToday')}
      />

      {loading ? (
        <p className="muted-center">{t('list.loading')}</p>
      ) : visible.length === 0 ? (
        <section className="empty-state">
          <span className="empty-state-icon"><Icon name="activities" size={24} /></span>
          <h2>{t('list.empty')}</h2>
          <p>{t('list.activityEmpty')}</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            {t('list.addHabit')}
          </button>
        </section>
      ) : (
        <div className="activity-groups">
          {groupByHabitGroup(visible, (activity) => habitTemplateId(activity)).map((group) => (
            <section key={group.title} className="activity-group">
              <h3 className="today-period-title">{groupTitle(group.title, locale)}</h3>
              <ul className="activity-list">
                {group.items.map((activity) => (
                  <li key={activity.id}>
                    <button
                      type="button"
                      className={`activity-row item-kind-activity ${activity.archived ? 'activity-row-archived' : ''}`}
                      onClick={() => onSelect(activity)}
                    >
                      <HabitMark name={visibleName(activity, locale)} templateId={activity.template_id} />
                      <span className="activity-meta">
                        <span className="activity-name">
                          {visibleName(activity, locale)}
                          {activity.archived ? (
                            <span className="badge">{t('list.archived')}</span>
                          ) : findActivePause(pauses, activity.id) && (
                            <span className="badge badge-paused">{t('list.paused')}</span>
                          )}
                        </span>
                        <span className="activity-desc">{describeActivity(activity)}</span>
                      </span>
                      <span className="activity-chevron" aria-hidden>
                        <Icon name="chevron" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
