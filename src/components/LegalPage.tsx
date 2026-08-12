import {
  COMPANY_NAME,
  COPYRIGHT_YEAR,
  PRODUCT_NAME,
  type LegalPageId,
} from '../lib/site'

interface LegalPageProps {
  page: LegalPageId
  onBack: () => void
}

export function LegalPage({ page, onBack }: LegalPageProps) {
  const title =
    page === 'about' ? 'About' : page === 'privacy' ? 'Privacy Policy' : 'Terms & Conditions'

  return (
    <div className="legal-page">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="screen-heading">
        <div>
          <h2>{title}</h2>
          <p className="screen-sub">
            {PRODUCT_NAME} by {COMPANY_NAME}
          </p>
        </div>
      </div>

      <article className="legal-article">
        {page === 'about' && <AboutContent />}
        {page === 'privacy' && <PrivacyContent />}
        {page === 'terms' && <TermsContent />}
      </article>

      <p className="site-footer-copy legal-page-copy">
        © {COPYRIGHT_YEAR} {COMPANY_NAME}
      </p>
    </div>
  )
}

function AboutContent() {
  return (
    <>
      <p>
        <strong>{PRODUCT_NAME}</strong> is a personal multi-activity tracker from{' '}
        {COMPANY_NAME}. It helps you notice what you keep postponing — across habits,
        deadlines, and daily metrics — so avoidance stops being invisible.
      </p>
      <p>
        Unlike streak-first habit apps, Resuming focuses on the pattern: what you skip,
        when you skip it, and how those skips cluster. Timers, checkboxes, and simple
        number logs are the plumbing; Insights is the point.
      </p>
      <p>
        Built for a single person who wants a calm, no-shame tool — not gamification,
        not social pressure, just a clearer view of what you are (and aren’t) picking
        back up.
      </p>
      <p className="legal-muted">Last updated: August 12, {COPYRIGHT_YEAR}</p>
    </>
  )
}

function PrivacyContent() {
  return (
    <>
      <p>
        This Privacy Policy describes how {COMPANY_NAME} (“we”, “us”) handles information
        when you use {PRODUCT_NAME}.
      </p>
      <h3>Information we collect</h3>
      <p>
        When you sign in with Google, we receive basic account details needed to
        authenticate you (such as your email address and a stable account identifier).
        We also store the activity, metric, and log data you create in the app.
      </p>
      <h3>How we use it</h3>
      <p>
        We use your data to provide {PRODUCT_NAME}: syncing your activities and logs,
        computing Insights, and keeping your session signed in. We do not sell your
        personal data.
      </p>
      <h3>Storage & security</h3>
      <p>
        App data is stored in Supabase (hosted Postgres) with row-level security scoped
        to your account. Auth is handled by Google OAuth through Supabase. You can
        delete activities and entries from within the app; contact us if you need a full
        account deletion.
      </p>
      <h3>Third parties</h3>
      <p>
        Sign-in uses Google. Hosting and database providers process data only to run the
        service. We do not use advertising trackers in v1.
      </p>
      <h3>Contact</h3>
      <p>
        Questions about privacy: privacy@cheerfulgames.example (placeholder — replace
        with a real address before public launch).
      </p>
      <p className="legal-muted">Last updated: August 12, {COPYRIGHT_YEAR}</p>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <p>
        These Terms & Conditions govern your use of {PRODUCT_NAME}, provided by{' '}
        {COMPANY_NAME}.
      </p>
      <h3>The service</h3>
      <p>
        {PRODUCT_NAME} is a personal tracking tool offered as-is for individual use. We
        may change features, fix bugs, or temporarily interrupt service for maintenance.
      </p>
      <h3>Your account</h3>
      <p>
        You are responsible for activity under your signed-in account. Do not misuse the
        service or attempt to access another user’s data.
      </p>
      <h3>Your content</h3>
      <p>
        You own the activities, metrics, and logs you create. You grant us a limited
        license to store and process that content solely to operate {PRODUCT_NAME}.
      </p>
      <h3>Disclaimer</h3>
      <p>
        {PRODUCT_NAME} is not medical, legal, or financial advice. Insights are
        descriptive summaries of your own logs. The service is provided without
        warranties of any kind to the fullest extent permitted by law.
      </p>
      <h3>Limitation of liability</h3>
      <p>
        To the maximum extent allowed by law, {COMPANY_NAME} is not liable for indirect,
        incidental, or consequential damages arising from your use of the app.
      </p>
      <h3>Contact</h3>
      <p>
        Questions about these terms: legal@cheerfulgames.example (placeholder).
      </p>
      <p className="legal-muted">Last updated: August 12, {COPYRIGHT_YEAR}</p>
    </>
  )
}
