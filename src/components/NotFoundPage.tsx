import { useDocumentMeta } from '../hooks/useDocumentMeta'

interface NotFoundPageProps {
  onHome: () => void
}

export function NotFoundPage({ onHome }: NotFoundPageProps) {
  useDocumentMeta({
    title: 'Not found · Resuming',
    description: 'This page took a break. Let’s get you back.',
    path: undefined,
    noindex: true,
  })

  return (
    <div className="landing">
      <div className="landing-card">
        <h1 className="screen-heading" style={{ marginBottom: '0.5rem' }}>
          This page took a break.
        </h1>
        <p className="explainer">Let’s get you back.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={onHome}>
          Go home
        </button>
      </div>
    </div>
  )
}
