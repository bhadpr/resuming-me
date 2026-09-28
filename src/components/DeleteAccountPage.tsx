import { PRODUCT_NAME } from '../lib/site'
import { CONTACT_EMAIL } from '../config'

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
          <h2>Delete your data</h2>
          <p className="screen-sub">{PRODUCT_NAME} by Cheerful Games, Inc.</p>
        </div>
      </div>

      <article className="legal-article">
        <p>
          You can delete one habit and keep your {PRODUCT_NAME} account, or delete the
          account and everything stored with it. Both happen in the app.
        </p>

        <h3>Delete one habit</h3>
        <ol>
          <li>Sign in to {PRODUCT_NAME} with Google or your email link.</li>
          <li>Open the habit.</li>
          <li>
            Tap <strong>Delete permanently</strong>, then <strong>Delete forever</strong>.
          </li>
        </ol>
        <p>
          This removes that habit and its log history. Your account, name, email, and
          other habits stay.
        </p>

        <h3>Delete your account and all of your data</h3>
        <ol>
          <li>Sign in to {PRODUCT_NAME} with Google or your email link.</li>
          <li>
            Open <strong>Settings</strong> (gear icon).
          </li>
          <li>
            Under <strong>Account</strong>, tap <strong>Delete my account</strong>.
          </li>
          <li>
            You can export a copy first. Then type <strong>DELETE</strong> to confirm.
          </li>
        </ol>
        <p>This permanently removes:</p>
        <ul>
          <li>Your profile, including the name and email on the account</li>
          <li>Your habits, metrics, and log history</li>
          <li>Feedback you sent while signed in</li>
        </ul>

        <h3>What we keep</h3>
        <p>
          Deleted habits and deleted accounts are removed from {PRODUCT_NAME}. We do not
          keep a separate copy in the app. Encrypted backups may still hold that data
          until those backups expire in the ordinary backup cycle. We may also keep a
          limited record when the law or security requires it. Anonymous usage counts
          that are not tied to your account can remain.
        </p>

        <h3>Need help?</h3>
        <p>
          If you cannot access the app, email{' '}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> from the address on your
          account. Cheerful Games, Inc. will verify the request and delete the data.
        </p>
      </article>
    </div>
  )
}
