import { describeActivity, type Activity } from '../lib/activities'

interface ActivityListProps {
  activities: Activity[]
  loading: boolean
  showArchived: boolean
  onToggleArchived: () => void
  onSelect: (activity: Activity) => void
  onAdd: () => void
}

export function ActivityList({
  activities,
  loading,
  showArchived,
  onToggleArchived,
  onSelect,
  onAdd,
}: ActivityListProps) {
  const visible = showArchived
    ? activities
    : activities.filter((a) => !a.archived)

  return (
    <div className="activity-list-screen">
      <div className="screen-heading">
        <div>
          <h2>Activities</h2>
          <p className="screen-sub">Create and manage what you want to resume.</p>
        </div>
        <button type="button" className="btn btn-primary btn-compact" onClick={onAdd}>
          Add
        </button>
      </div>

      <label className="toggle-row">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={onToggleArchived}
        />
        <span>Show archived</span>
      </label>

      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : visible.length === 0 ? (
        <section className="empty-state">
          <p className="empty-state-emoji">📌</p>
          <h2>No activities yet</h2>
          <p>Add a daily habit, weekly goal, or deadline to get started.</p>
          <button type="button" className="btn btn-primary" onClick={onAdd}>
            Add activity
          </button>
        </section>
      ) : (
        <ul className="activity-list">
          {visible.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                className={`activity-row ${activity.archived ? 'activity-row-archived' : ''}`}
                onClick={() => onSelect(activity)}
              >
                <span className="activity-emoji" aria-hidden>
                  {activity.emoji}
                </span>
                <span className="activity-meta">
                  <span className="activity-name">
                    {activity.name}
                    {activity.archived && <span className="badge">Archived</span>}
                  </span>
                  <span className="activity-desc">{describeActivity(activity)}</span>
                </span>
                <span className="activity-chevron" aria-hidden>
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
