import { useState } from 'react'
import type { Activity } from '../lib/activities'

interface DeadlineOverduePromptProps {
  activity: Activity
  busy?: boolean
  onMarkComplete: () => void
  onReschedule: (newDeadline: string) => void
}

export function DeadlineOverduePrompt({
  activity,
  busy = false,
  onMarkComplete,
  onReschedule,
}: DeadlineOverduePromptProps) {
  const [newDeadline, setNewDeadline] = useState('')
  const [showReschedule, setShowReschedule] = useState(false)

  return (
    <div className="deadline-prompt">
      <p className="deadline-prompt-title">
        {activity.emoji} {activity.name} is overdue
      </p>
      <p className="deadline-prompt-body">
        Deadline was <strong>{activity.deadline}</strong>. Mark it complete if it got done, or
        set a new deadline — it won&apos;t disappear on its own.
      </p>

      {!showReschedule ? (
        <div className="form-actions">
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={onMarkComplete}
          >
            Mark complete
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setShowReschedule(true)}
          >
            Set new deadline
          </button>
        </div>
      ) : (
        <div className="deadline-reschedule">
          <label className="field">
            <span className="field-label">New deadline</span>
            <input
              className="field-input"
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => setShowReschedule(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !newDeadline}
              onClick={() => onReschedule(newDeadline)}
            >
              Save deadline
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
