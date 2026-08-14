import {
  COMPANY_NAME,
  COPYRIGHT_YEAR,
  GOVERNING_LAW,
  LEGAL_LAST_UPDATED,
  PRODUCT_NAME,
  SUPPORT_EMAIL,
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
      <p className="legal-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
    </>
  )
}

function PrivacyContent() {
  return (
    <>
      <p>
        This Privacy Policy explains how {COMPANY_NAME} (“we”, “us”, or “our”) collects,
        uses, shares, and protects information when you use {PRODUCT_NAME} (the “Service”).
        By using the Service, you agree to this Policy.
      </p>

      <h3>Who we are</h3>
      <p>
        {PRODUCT_NAME} is operated by {COMPANY_NAME}. For privacy questions or requests,
        contact us at{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h3>Information we collect</h3>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with Google, we receive
          authentication details needed to create and maintain your account — typically
          your email address, name (if provided by Google), profile image URL (if
          provided), and a stable account identifier.
        </li>
        <li>
          <strong>App content you create.</strong> Activities, metrics, log entries,
          timers, micro-steps, timezone preferences, and related settings you enter in
          the Service.
        </li>
        <li>
          <strong>Feedback.</strong> If you submit feedback, we store your rating,
          comments, and any name or email you choose to provide, plus your user id if you
          are signed in.
        </li>
        <li>
          <strong>Technical & device data.</strong> Limited operational data needed to
          run the Service (for example, session tokens and basic request metadata
          processed by our infrastructure providers). We do not run advertising or
          third-party marketing analytics. We collect first-party page-view events
          (page path, approximate referrer, browser/device class, and an anonymous
          visitor id) so site operators can understand usage of the Service.
        </li>
        <li>
          <strong>Local device storage.</strong> On your device we may store session
          credentials, theme preference, onboarding state, daily reminder preference,
          active timer state, and offline sync queues so the app works reliably between
          visits. See “Cookies &amp; local storage” below. On Android, an optional daily
          reminder is scheduled on the device only; it is not delivered through a cloud
          push service.
        </li>
      </ul>

      <h3>How we use information</h3>
      <p>We use information to:</p>
      <ul>
        <li>Provide, operate, secure, and improve {PRODUCT_NAME}</li>
        <li>Authenticate you and keep you signed in</li>
        <li>Sync your activities and logs and compute Insights from your own data</li>
        <li>Respond to feedback and support requests</li>
        <li>Understand aggregate website usage through first-party page analytics</li>
        <li>Detect, prevent, and address abuse, security, or technical issues</li>
        <li>Comply with legal obligations</li>
      </ul>
      <p>
        We do not sell your personal information, and we do not share it for
        cross-context behavioral advertising.
      </p>

      <h3>How we share information</h3>
      <p>
        We share information only as needed to operate the Service or as required by law:
      </p>
      <ul>
        <li>
          <strong>Service providers.</strong> Google (sign-in), Supabase (authentication,
          database, and related backend services), and hosting/CDN providers that process
          data on our behalf to run the Service.
        </li>
        <li>
          <strong>Legal & safety.</strong> If we reasonably believe disclosure is
          required to comply with law, enforce our Terms, or protect the rights, safety,
          or security of users or the public.
        </li>
        <li>
          <strong>Business transfers.</strong> If we are involved in a merger,
          acquisition, or asset sale, information may be transferred as part of that
          transaction, subject to this Policy or equivalent protections.
        </li>
      </ul>
      <p>
        Third parties named above have their own privacy practices. We encourage you to
        review Google’s and Supabase’s policies for details on their processing.
      </p>

      <h3>Cookies &amp; local storage</h3>
      <p>
        {PRODUCT_NAME} does not use advertising cookies or third-party marketing
        trackers. We (and our infrastructure providers) use essential browser storage
        and similar technologies so the Service functions, including:
      </p>
      <ul>
        <li>Authentication / session storage so you stay signed in</li>
        <li>
          Local preferences such as theme, onboarding completion, daily reminder time,
          and in-progress timer state
        </li>
        <li>
          A service worker / progressive web app cache that stores app assets for faster
          loading and offline resilience
        </li>
      </ul>
      <p>
        These technologies are necessary for core functionality. You can clear site data
        in your browser or sign out to remove session credentials; doing so may sign you
        out or reset local preferences. If we later introduce analytics or other
        non-essential cookies, we will update this Policy and, where required by law,
        request your consent before using them.
      </p>

      <h3>Retention</h3>
      <p>
        We retain account and app content for as long as your account remains active and
        as needed to provide the Service. Feedback may be retained longer as needed to
        improve the product and handle support. We may retain limited records where
        required for legal, security, or operational purposes. When you delete content in
        the app, we remove it from active systems subject to ordinary backup cycles.
      </p>

      <h3>Security</h3>
      <p>
        App data is stored in Supabase-hosted infrastructure with access controls,
        including row-level security intended to scope user data to the signed-in
        account. No method of transmission or storage is completely secure; we work to
        protect your information but cannot guarantee absolute security.
      </p>

      <h3>Your choices &amp; rights</h3>
      <p>Depending on where you live, you may have rights to:</p>
      <ul>
        <li>Access, correct, or delete personal information we hold about you</li>
        <li>Export a copy of your information</li>
        <li>Object to or restrict certain processing</li>
        <li>Withdraw consent where processing is based on consent</li>
      </ul>
      <p>
        You can edit or delete many records directly in the app, and you can sign out at
        any time. For a full account deletion, data export, or other privacy request,
        email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We may need to verify
        your identity before fulfilling a request. You may also have the right to lodge a
        complaint with a data protection authority in your region.
      </p>

      <h3>Children’s privacy</h3>
      <p>
        {PRODUCT_NAME} is not directed to children under 13, and we do not knowingly
        collect personal information from children under 13. If you believe a child has
        provided us information, contact us and we will take appropriate steps to delete
        it.
      </p>

      <h3>International processing</h3>
      <p>
        We and our service providers may process information in the United States and
        other countries. Those locations may have different data-protection laws than
        your home country. Where required, we rely on appropriate safeguards offered by
        our providers for cross-border transfers.
      </p>

      <h3>Changes to this Policy</h3>
      <p>
        We may update this Privacy Policy from time to time. We will revise the “Last
        updated” date below, and for material changes we may provide additional notice
        in the Service. Continued use after an update means you acknowledge the revised
        Policy.
      </p>

      <h3>Contact</h3>
      <p>
        Privacy requests and questions:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <p className="legal-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
    </>
  )
}

function TermsContent() {
  return (
    <>
      <p>
        These Terms &amp; Conditions (“Terms”) form a binding agreement between you and{' '}
        {COMPANY_NAME} (“we”, “us”, or “our”) governing your access to and use of{' '}
        {PRODUCT_NAME} (the “Service”). By creating an account or using the Service, you
        agree to these Terms and our Privacy Policy. If you do not agree, do not use the
        Service.
      </p>

      <h3>Eligibility</h3>
      <p>
        You must be at least 13 years old to use {PRODUCT_NAME}. If you are under the age
        of majority where you live, you may use the Service only with the involvement of
        a parent or legal guardian who agrees to these Terms.
      </p>

      <h3>The Service</h3>
      <p>
        {PRODUCT_NAME} is a personal activity-tracking tool. Features may change, and we
        may add, modify, or discontinue functionality, or temporarily interrupt the
        Service for maintenance, security, or operational reasons. We do not guarantee
        uninterrupted or error-free availability.
      </p>

      <h3>Accounts</h3>
      <p>
        You sign in using Google authentication. You are responsible for activity under
        your account and for keeping access to your Google account secure. Notify us
        promptly if you believe your {PRODUCT_NAME} account has been compromised. We may
        suspend or terminate access if we reasonably believe these Terms have been
        violated or if needed to protect the Service or other users.
      </p>

      <h3>Acceptable use</h3>
      <p>You agree not to:</p>
      <ul>
        <li>Use the Service for any unlawful purpose</li>
        <li>Attempt to access another user’s data or accounts without authorization</li>
        <li>
          Probe, scan, or test the vulnerability of the Service, or bypass security or
          access controls
        </li>
        <li>
          Interfere with or disrupt the Service, including by introducing malware or
          overloading infrastructure
        </li>
        <li>
          Reverse engineer, scrape, or misuse the Service except where applicable law
          expressly permits
        </li>
        <li>Misrepresent your identity or affiliation when contacting us</li>
      </ul>

      <h3>Your content</h3>
      <p>
        You retain ownership of the activities, metrics, logs, feedback, and other
        content you submit (“Your Content”). You grant {COMPANY_NAME} a worldwide,
        non-exclusive, royalty-free license to host, store, process, transmit, and
        display Your Content solely as needed to operate, maintain, and improve the
        Service. You represent that you have the rights needed to submit Your Content and
        that it does not violate law or third-party rights.
      </p>

      <h3>Our intellectual property</h3>
      <p>
        The Service — including software, design, branding, and documentation — is owned
        by {COMPANY_NAME} or its licensors and is protected by intellectual-property
        laws. These Terms do not grant you any right to use our name, logo, or marks
        except as needed to use the Service.
      </p>

      <h3>Feedback</h3>
      <p>
        If you send ideas, suggestions, or other feedback, you grant us permission to use
        it without restriction or compensation. Feedback is voluntary and does not create
        any confidentiality obligation unless we agree otherwise in writing.
      </p>

      <h3>Third-party services</h3>
      <p>
        The Service relies on third parties such as Google (authentication) and Supabase
        (backend infrastructure). Your use of those services may be subject to their
        terms and policies. We are not responsible for third-party services we do not
        control.
      </p>

      <h3>No professional advice</h3>
      <p>
        {PRODUCT_NAME} is a personal productivity tool. It is not medical, mental-health,
        legal, financial, or other professional advice. Insights are descriptive
        summaries of data you log; they are not diagnoses, treatment plans, or
        recommendations from a licensed professional. Do not disregard professional advice
        or delay seeking it because of something in the Service.
      </p>

      <h3>Disclaimer of warranties</h3>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, THE SERVICE IS PROVIDED “AS IS” AND “AS
        AVAILABLE,” WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR
        STATUTORY, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
        TITLE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL MEET YOUR
        REQUIREMENTS OR BE UNINTERRUPTED, SECURE, OR ERROR-FREE.
      </p>

      <h3>Limitation of liability</h3>
      <p>
        TO THE MAXIMUM EXTENT PERMITTED BY LAW, {COMPANY_NAME} AND ITS OFFICERS,
        DIRECTORS, EMPLOYEES, AND AGENTS WILL NOT BE LIABLE FOR ANY INDIRECT,
        INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR ANY LOSS
        OF PROFITS, DATA, GOODWILL, OR BUSINESS INTERRUPTION, ARISING OUT OF OR RELATED
        TO YOUR USE OF (OR INABILITY TO USE) THE SERVICE, EVEN IF ADVISED OF THE
        POSSIBILITY OF SUCH DAMAGES.
      </p>
      <p>
        OUR TOTAL LIABILITY FOR ANY CLAIM ARISING OUT OF OR RELATING TO THE SERVICE OR
        THESE TERMS WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE
        SERVICE IN THE TWELVE (12) MONTHS BEFORE THE CLAIM OR (B) ONE HUNDRED U.S.
        DOLLARS (US $100). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS; IN THOSE
        CASES, OUR LIABILITY IS LIMITED TO THE FULLEST EXTENT PERMITTED BY LAW.
      </p>

      <h3>Indemnity</h3>
      <p>
        You will defend and indemnify {COMPANY_NAME} against claims, damages, losses, and
        expenses (including reasonable attorneys’ fees) arising from Your Content or your
        misuse of the Service or violation of these Terms, to the extent permitted by
        law.
      </p>

      <h3>Termination</h3>
      <p>
        You may stop using the Service at any time and may request account deletion by
        contacting{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. We may suspend or end
        access to the Service, including for inactivity, risk, or Terms violations.
        Provisions that by their nature should survive (including ownership, disclaimers,
        limitations of liability, and indemnity) will survive termination.
      </p>

      <h3>Changes to these Terms</h3>
      <p>
        We may update these Terms from time to time. We will revise the “Last updated”
        date below. If a change is material, we may provide additional notice in the
        Service. Continued use after changes become effective constitutes acceptance of
        the updated Terms.
      </p>

      <h3>Governing law</h3>
      <p>
        These Terms are governed by the laws of {GOVERNING_LAW}, without regard to
        conflict-of-law principles. Courts located in that jurisdiction will have
        exclusive jurisdiction over disputes arising from these Terms, except that we may
        seek injunctive relief in any appropriate forum. If you are a consumer in a
        jurisdiction that requires different rules, those mandatory protections still
        apply.
      </p>

      <h3>General</h3>
      <p>
        These Terms, together with the Privacy Policy, are the entire agreement between
        you and us regarding the Service. If any provision is found unenforceable, the
        remaining provisions remain in effect. Our failure to enforce a provision is not
        a waiver. You may not assign these Terms without our consent; we may assign them
        in connection with a reorganization, merger, or sale of assets.
      </p>

      <h3>Contact</h3>
      <p>
        Questions about these Terms:{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
      <p className="legal-muted">Last updated: {LEGAL_LAST_UPDATED}</p>
    </>
  )
}
