import { PRODUCT_NAME, SUPPORT_EMAIL } from '../lib/site'

interface DeleteAccountPageProps {
  onBack: () => void
}

export function DeleteAccountPage({ onBack }: DeleteAccountPageProps) {
  return (
    <div className="legal-page">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="screen-heading">
        <div>
          <h2>Delete your account</h2>
          <p className="screen-sub">How to remove your {PRODUCT_NAME} account and data</p>
        </div>
      </div>

      <article className="legal-article">
        <p>
          You can delete your {PRODUCT_NAME} account from inside the app. This permanently
          removes your profile, activities, metrics, log history, and related data. It
          cannot be undone.
        </p>

        <h3>In the app</h3>
        <ol>
          <li>Sign in with the Google account you use for {PRODUCT_NAME}.</li>
          <li>
            Open <strong>Settings</strong> (gear icon).
          </li>
          <li>
            Under <strong>Account</strong>, tap <strong>Delete my account</strong>.
          </li>
          <li>
            Optionally export a copy of your data first, then type <strong>DELETE</strong>{' '}
            to confirm.
          </li>
        </ol>

        <p>
          After you sign in, use Settings → Account → Delete my account.
        </p>

        <h3>Need help?</h3>
        <p>
          If you cannot access the app, email{' '}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the address on your
          account and we will help verify and complete deletion.
        </p>
      </article>
    </div>
  )
}
