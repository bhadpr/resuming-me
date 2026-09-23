import { Link } from 'react-router-dom'
import { guestSaveWarning, loadGuestDraft, setGuestStep } from '../lib/guestDraft'

/** Local Today for someone who has not saved an account yet. */
export function GuestTodayPage() {
  const draft = loadGuestDraft()
  if (!draft) return null
  const warning = guestSaveWarning(draft)

  return (
    <div className="landing">
      <div className="landing-card">
        <div className="guest-save-banner">
          <p>{warning ?? 'Save your progress'}</p>
          <Link
            className="btn btn-primary"
            to="/start?step=8"
            onClick={() => setGuestStep(draft, 8)}
          >
            Save your progress
          </Link>
          <p className="screen-sub">Stays on this device for 7 days.</p>
        </div>
        <h1 className="screen-heading">Today</h1>
        {draft.activities.length === 0 ? (
          <p className="screen-sub">Nothing here yet.</p>
        ) : (
          <ul className="activity-list">
            {draft.activities.map((activity) => {
              const logged = draft.logs.some((log) => log.localActivityId === activity.localId)
              return (
                <li key={activity.localId} className="activity-row">
                  <span className="activity-emoji" aria-hidden>
                    {activity.emoji}
                  </span>
                  <span className="activity-meta">
                    <span className="activity-name">{activity.name}</span>
                    <span className="activity-desc">{logged ? 'Resumed today' : 'Open'}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
