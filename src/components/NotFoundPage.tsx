import { Link } from 'react-router-dom'
import { BrandTitle } from './BrandTitle'

export function NotFoundPage() {
  return (
    <div className="landing">
      <div className="landing-card">
        <BrandTitle size="lg" className="landing-brand" />
        <h1 className="form-title">Page not found</h1>
        <p className="explainer">
          That link does not match a screen in Resuming. Head back to Today and
          pick up from there.
        </p>
        <Link to="/today" className="btn btn-primary">
          Go to Today
        </Link>
      </div>
    </div>
  )
}
