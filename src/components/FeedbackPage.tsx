import { useState, type FormEvent } from 'react'
import { submitFeedback } from '../lib/feedback'
import { PRODUCT_NAME } from '../lib/site'

interface FeedbackPageProps {
  onBack: () => void
  defaultName?: string
  defaultEmail?: string
}

export function FeedbackPage({ onBack, defaultName = '', defaultEmail = '' }: FeedbackPageProps) {
  const [rating, setRating] = useState(0)
  const [liked, setLiked] = useState('')
  const [improve, setImprove] = useState('')
  const [wish, setWish] = useState('')
  const [name, setName] = useState(defaultName)
  const [email, setEmail] = useState(defaultEmail)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (rating < 1) {
      setError('Please choose a star rating.')
      return
    }

    setSubmitting(true)
    try {
      await submitFeedback({ rating, liked, improve, wish, name, email })
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="feedback-page">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="screen-heading">
        <div>
          <h2>Feedback</h2>
          <p className="screen-sub">We&apos;d love to hear how {PRODUCT_NAME} is working for you.</p>
        </div>
      </div>

      {submitted ? (
        <div className="feedback-thanks" role="status">
          <h3>Thank you</h3>
          <p>Your feedback has been received. We really appreciate you taking the time.</p>
          <button type="button" className="btn btn-primary" onClick={onBack}>
            Done
          </button>
        </div>
      ) : (
        <form className="feedback-form activity-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {error && <p className="error">{error}</p>}

          <div className="field">
            <span className="field-label" id="feedback-rating-label">
              Overall, how much did you enjoy {PRODUCT_NAME}?
            </span>
            <div
              className="feedback-stars"
              role="radiogroup"
              aria-labelledby="feedback-rating-label"
            >
              {[1, 2, 3, 4, 5].map((value) => {
                const selected = rating === value
                const filled = rating >= value
                return (
                  <button
                    key={value}
                    type="button"
                    className={`feedback-star ${filled ? 'feedback-star-filled' : ''}`}
                    role="radio"
                    aria-checked={selected}
                    aria-label={`${value} star${value === 1 ? '' : 's'}`}
                    onClick={() => setRating(value)}
                  >
                    ★
                  </button>
                )
              })}
              <span className="feedback-stars-caption">
                {rating > 0 ? `${rating} / 5` : 'Tap to rate'}
              </span>
            </div>
          </div>

          <label className="field">
            <span className="field-label">What did you like most?</span>
            <textarea
              className="field-input feedback-textarea"
              rows={3}
              maxLength={4000}
              value={liked}
              onChange={(e) => setLiked(e.target.value)}
              placeholder="A feature, the design, Insights…"
            />
          </label>

          <label className="field">
            <span className="field-label">What was confusing or could be better?</span>
            <textarea
              className="field-input feedback-textarea"
              rows={3}
              maxLength={4000}
              value={improve}
              onChange={(e) => setImprove(e.target.value)}
              placeholder="Anything that tripped you up or felt slow."
            />
          </label>

          <label className="field">
            <span className="field-label">Any feature you wish it had?</span>
            <textarea
              className="field-input feedback-textarea"
              rows={3}
              maxLength={4000}
              value={wish}
              onChange={(e) => setWish(e.target.value)}
              placeholder="Your wish list — big or small."
            />
          </label>

          <label className="field">
            <span className="field-label">Your name</span>
            <input
              className="field-input"
              type="text"
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="So we know who to thank"
              autoComplete="name"
            />
          </label>

          <label className="field">
            <span className="field-label">Your email</span>
            <input
              className="field-input"
              type="email"
              maxLength={320}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="If you're happy for us to follow up"
              autoComplete="email"
            />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Sending…' : 'Submit'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
