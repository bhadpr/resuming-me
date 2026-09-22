import { Link } from 'react-router-dom'
import { useDocumentMeta } from '../hooks/useDocumentMeta'

export function NotFoundPage() {
  useDocumentMeta({
    title: 'Not found · Resuming',
    description: 'This page took a break. Let’s get you back.',
    noindex: true,
  })

  return (
    <div className="landing">
      <div className="landing-card">
        <h1 className="form-title">This page took a break.</h1>
        <p className="explainer">Let’s get you back.</p>
        <Link to="/" className="btn btn-primary">
          Go home
        </Link>
      </div>
    </div>
  )
}
