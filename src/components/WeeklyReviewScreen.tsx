import type { Activity } from '../lib/activities'
import { shrinkOffer, type WeeklyReview } from '../lib/weeklyReview'

interface WeeklyReviewScreenProps {
  review: WeeklyReview
  activities: Activity[]
  focusActivityId: string | null
  busy?: boolean
  canUndoShrink?: boolean
  onBack: () => void
  onShrink: (activityId: string, value: number) => void
  onUndoShrink: () => void
  onFocus: (activityId: string) => void
  onInsights: () => void
  onTurnOff: () => void
}

export function WeeklyReviewScreen({
  review,
  activities,
  focusActivityId,
  busy = false,
  canUndoShrink = false,
  onBack,
  onShrink,
  onUndoShrink,
  onFocus,
  onInsights,
  onTurnOff,
}: WeeklyReviewScreenProps) {
  return (
    <div className="insights-screen">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Today
      </button>
      <div className="screen-heading">
        <div>
          <h2>This week</h2>
          <p className="screen-sub">
            {review.weekStart} → {review.weekEnd}
          </p>
        </div>
      </div>

      <section className="insights-summary">
        <p>{review.headline}</p>
        {review.firstWeek && <p className="screen-sub">This is your first week.</p>}
        <p>{review.comebackLine}</p>
        {review.steadiestName && <p>{review.steadiestName} was the steadiest.</p>}
      </section>

      {review.slipped.length > 0 && (
        <section className="today-section">
          <h3 className="section-label">What slipped</h3>
          <ul className="insights-list">
            {review.slipped.map((row) => {
              const activity = activities.find((item) => item.id === row.activityId)
              const offer = activity ? shrinkOffer(activity) : null
              return (
                <li key={row.activityId} className="insights-row-wrap">
                  <p className="activity-desc">
                    {row.name} has been quiet for {row.quietDays} days.
                    {offer ? ` Want to shrink it to ${offer.value} ${offer.unit}?` : ''}
                  </p>
                  {offer && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={busy}
                      onClick={() => onShrink(row.activityId, offer.value)}
                    >
                      Shrink target
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
          {canUndoShrink && (
            <button type="button" className="btn btn-ghost" onClick={onUndoShrink}>
              Undo shrink
            </button>
          )}
        </section>
      )}

      {review.pattern && (
        <section className="today-section">
          <h3 className="section-label">{review.pattern.earlyGuess ? 'Early guess' : 'A pattern'}</h3>
          <p>{review.pattern.text}</p>
        </section>
      )}

      <section className="today-section">
        <h3 className="section-label">One small thing for next week?</h3>
        {review.focus.length === 0 ? (
          <p className="screen-sub">Add something small and it can be next week’s focus.</p>
        ) : (
          <div className="onboarding-chips">
            {review.focus.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className={`onboarding-chip ${focusActivityId === choice.id ? 'onboarding-chip-selected' : ''}`}
                onClick={() => onFocus(choice.id)}
              >
                {choice.name}
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="detail-actions">
        <button type="button" className="btn btn-primary" onClick={onInsights}>
          Full insights
        </button>
        <button type="button" className="btn btn-ghost" onClick={onTurnOff}>
          Turn these off
        </button>
      </div>
    </div>
  )
}
