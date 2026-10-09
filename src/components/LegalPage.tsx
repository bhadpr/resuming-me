import {
  COMPANY_NAME,
  COPYRIGHT_YEAR,
  GOVERNING_LAW,
  LEGAL_LAST_UPDATED,
  PRIVACY_LAST_UPDATED,
  TERMS_LAST_UPDATED,
  PRODUCT_NAME,
  type LegalPageId,
} from '../lib/site'
import { CONTACT_EMAIL } from '../config'
import { Icon } from './Icon'

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
        <Icon name="back" />
        Back
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
        Resuming is for one small habit. Do two minutes. If a few days pass, start again. That still counts.
      </p>
      <p>
        A rest, a skip, and a pause are not failures. Insights keeps a record of
        the days you pick it back up.
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
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
      <p>
        If you live in India, that address is our grievance contact under the Digital
        Personal Data Protection Act, 2023. You may write to us to access, correct, or
        erase your personal data, or to make a complaint. We may need to verify that the
        request comes from you.
      </p>
      <p>
        Where the law requires your consent, we rely on you choosing to create an account
        and choosing to add a medicine, a health measurement, or another log.
      </p>

      <h3>Information we collect</h3>
      <p>We collect the following categories of information:</p>
      <ul>
        <li>
          <strong>Account information.</strong> When you sign in with Google or an email
          magic link, we receive authentication details needed to create and maintain
          your account — typically your email address, name (if provided by Google),
          profile image URL (if provided), and a stable account identifier.
        </li>
        <li>
          <strong>App content you create.</strong> Activities, health measurements you
          choose to log (such as blood pressure, heart rate, weight, and sleep), log
          entries, timers, micro-steps, timezone preferences, and related settings you
          enter in the Service.
        </li>
        <li>
          <strong>Medicines.</strong> If you are signed in, we store each medicine’s
          name, the days of the week, the times, and whether you marked a dose taken.
          If you add a bottle photo, we store that image with your account. A guest
          setup does not keep the photo. The photo and the reminders are a reminder.
          They are not medical advice.
        </li>
        <li>
          <strong>Reminders.</strong> If you are signed in, we store each reminder’s
          text, its day, an optional time, its kind, whether it comes back every year,
          whether you asked for an alert the day before, and when you marked it done. We
          store them to show them on Today and to alert you. A guest’s reminders stay on
          the device.
        </li>
        <li>
          <strong>Shared events.</strong> If you share a reminder, we store its text, the
          optional From line you type, its day, time, time zone and kind, and a short link
          code, tied to your account. Anyone with the link can see the text, the From line
          and the time, but never your name, email or phone number. When someone adds a
          shared event, we store that their account, or an anonymous id for their device,
          follows it, so we can count how many people added it and tell their copy if it is
          cancelled. We do not show the organizer who added it. If someone reports an
          event, we store the reason and their account or anonymous device id.
        </li>
        <li>
          <strong>Steps.</strong> On Android, if you allow it, the app reads today’s
          step count from Health Connect on your phone and shows it on Today. We do
          not write steps to Health Connect, and we do not send that count to our
          servers. A number you type, and your daily step goal, stay on this device.
          Our use of information received from Health Connect follows the Health
          Connect Permissions policy, including its Limited Use requirements.
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
          visitor id) and first-party product events (for example, sign-in, activity
          created, log created/undone, insights viewed, and app opened — with
          non-identifying props such as activity type or duration, never activity
          names, notes, or other personal text) so site operators can understand
          usage of the Service. These events stay on our first-party infrastructure;
          we do not send them to third-party analytics vendors.
        </li>
        <li>
          <strong>Local device storage.</strong> On your device we may store session
          credentials, theme preference, onboarding state, daily reminder preference,
          active timer state, and offline sync queues so the app works reliably between
          visits. See “Cookies &amp; local storage” below. On Android, an optional daily
          reminder, medicine reminders, and alerts for your own reminders are scheduled
          on the device only. They
          are not delivered through a cloud push service. A typed step count and the
          daily step goal stay on the device.
        </li>
      </ul>

      <h3>How we use information</h3>
      <p>We use information to:</p>
      <ul>
        <li>Provide, operate, secure, and improve {PRODUCT_NAME}</li>
        <li>Authenticate you and keep you signed in</li>
        <li>Sync your activities and logs and compute Insights from your own data</li>
        <li>Respond to feedback and support requests</li>
        <li>Understand aggregate website and product usage through first-party analytics</li>
        <li>Detect, prevent, and address abuse, security, or technical issues</li>
        <li>Comply with legal obligations</li>
      </ul>
      <p>
        We do not sell your personal information, and we do not share it for
        cross-context behavioral advertising.
      </p>
      <p>
        Your reminders are private unless you choose Share on WhatsApp. A shared event can
        be seen by anyone with its link. Reminder and event text is not sent to our
        analytics, which count only how many reminders and shared events are added,
        opened and done.
      </p>

      <h3>Health information</h3>
      <p>
        Blood pressure, heart rate, weight, sleep, medicine names, dose times, dose
        marks, and bottle photos are health information. We store them when you are
        signed in and you add them, so the Service can show your log and your reminders.
        We do not sell this information. We do not use it for advertising. Deleting the
        item, or deleting your account, removes it from our active systems, subject to
        ordinary backup cycles.
      </p>
      <p>
        This Service is a personal log. It is not a clinic, a medical record under the
        US HIPAA rules, or a medical device. A bottle photo and a reminder are a
        reminder. They are not medical advice.
      </p>
      <p>
        If you are a consumer in Washington State, this section is our notice for
        consumer health data under the Washington My Health My Data Act. We collect that
        data because you asked the Service to keep that log or reminder. We do not sell
        it. You may ask us to delete it by deleting the item or the account, or by
        emailing us.
      </p>

      <h3>How we share information</h3>
      <p>
        We share information only as needed to operate the Service or as required by law:
      </p>
      <ul>
        <li>
          <strong>Service providers.</strong> Google and email magic links (sign-in; the
          same email can belong to one account when it is already linked), Supabase
          (authentication, database, and related backend services), Resend (optional day
          2, 3, and 7 check-in emails, only if you ask for a reminder, and a morning
          email listing that day’s reminders, only if you turn it on in Settings), and
          hosting/CDN
          providers that process data on our behalf to run the Service.
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
          Local preferences such as theme, language, a guest onboarding draft (kept on
          this device for up to 7 days, until you save an account), daily reminder time,
          a typed step count, the daily step goal, and in-progress timer state
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
        Deleting a medicine removes its bottle photo. Deleting your account removes
        those photos with the rest of your account data.
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
        any time. In Settings → Account you can <strong>Export my data</strong> (download a
        copy of your activities, logs, metrics, and reminders — medicine names, times, and bottle
        photos are not included) or <strong>Delete my account</strong>{' '}
        (permanent removal after typing DELETE). Email us for a copy of those medicine
        records. See also{' '}
        <a href="/delete-account">how to delete your account</a>. For help when you cannot
        use the app, or for other privacy requests, email{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may need to verify
        your identity before fulfilling a request. You may also have the right to lodge a
        complaint with a data protection authority in your region.
      </p>

      <h3>Children’s privacy</h3>
      <p>
        {PRODUCT_NAME} is for people 18 and older. We do not knowingly collect personal
        information from anyone under 18. If you believe a person under 18 has provided
        information, contact us and we will delete it.
      </p>

      <h3>International processing</h3>
      <p>
        We and our service providers process information in the United States and in
        Canada, where the account database is hosted. Google processes sign-in. Our
        email provider sends messages you ask for. Those locations may have different
        data-protection laws than your home country. For people in India, we transfer
        personal data outside India so we can provide the account. India allows that
        transfer except to countries the Government of India restricts.
      </p>

      <h3>Changes to this Policy</h3>
      <p>
        We may update this Privacy Policy from time to time. We will revise the “Last
        updated” date below. If we materially change what health information we collect
        or how we use it, we will notify you in the Service before that change applies.
        For other updates, continued use after the update means you acknowledge the
        revised Policy.
      </p>

      <h3>Contact</h3>
      <p>
        Privacy requests, and complaints from people in India:{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
      </p>
      <p className="legal-muted">Last updated: {PRIVACY_LAST_UPDATED}</p>
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
        You must be at least 18 years old to use {PRODUCT_NAME}. The Service is for
        adults.
      </p>

      <h3>The Service</h3>
      <p>
        {PRODUCT_NAME} is free. It does not show ads. It is a personal log and reminder.
        Features may change, and we may add, modify, or discontinue functionality, or
        temporarily interrupt the Service for maintenance, security, or operational
        reasons. We do not guarantee uninterrupted or error-free availability.
      </p>

      <h3>Accounts</h3>
      <p>
        You sign in with Google or an email magic link. If that email is already linked
        to Google, it is the same account. You are responsible for activity under your
        account and for keeping access to that email secure. Optional day 2, 3, and 7
        check-in emails, and an optional morning email on a day with reminders, can be
        turned off in the message or in Settings. Notify us
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
        You retain ownership of the activities, health measurements, medicines, reminders, logs,
        feedback, and other content you submit (“Your Content”). You grant {COMPANY_NAME}{' '}
        a worldwide, non-exclusive, royalty-free license to host, store, and display Your
        Content so your account works for you. We do not use medicine names, notes,
        vitals, or logs to train models. You represent that you have the rights needed to
        submit Your Content and that it does not violate law or third-party rights.
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

      <h3>Reminders</h3>
      <p>
        Reminders you add are stored so the Service can show them on Today and, if you
        ask, alert you on your Android phone or by email. They stay private unless you
        share one. An alert or an email can arrive late or not at all. Do not rely on{' '}
        {PRODUCT_NAME} alone for anything where a missed reminder could cause harm.
      </p>

      <h3>Shared events</h3>
      <p>
        When you share a reminder, anyone with the link can see its text, its From line and
        its time, and add it. Share only events you are entitled to announce. Do not use a
        shared event for ads, spam, web links, or anything misleading, hateful or harmful.
        A shared event cannot be changed; you can stop new adds, reset the link, or cancel
        it. We may switch off any shared event that is reported or that breaks these Terms,
        without notice.
      </p>

      <h3>Health, medicines, and vitals</h3>
      <p>
        {PRODUCT_NAME} is a reminder and a log. It is not a doctor, a pharmacist, or a
        medical device, and it does not suggest a dose. A bottle photo is a picture you
        chose. A reminder can fail to appear. A missed mark on Today is not a medical
        record of a missed dose. You remain responsible for your own medicines and for
        decisions about blood pressure, heart rate, weight, sleep, and steps. Do not
        delay professional care because of something in the Service.
      </p>
      <p>
        Insights are descriptive summaries of data you log. They are not diagnoses,
        treatment plans, or recommendations from a licensed professional. The Service is
        not legal, financial, or other professional advice.
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
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. We may suspend or end
        access to the Service, including for inactivity, risk, or Terms violations.
        Provisions that by their nature should survive (including ownership, disclaimers,
        limitations of liability, and indemnity) will survive termination.
      </p>

      <h3>Changes to these Terms</h3>
      <p>
        We may update these Terms from time to time. We will revise the “Last updated”
        date below. If a change is material, including a change to what health
        information we store, we will notify you in the Service before it applies. For
        other changes, continued use after the update takes effect constitutes acceptance
        of the updated Terms.
      </p>

      <h3>Governing law</h3>
      <p>
        These Terms are governed by the laws of {GOVERNING_LAW}, without regard to
        conflict-of-law principles, except where a law that applies to you does not allow
        that choice.
      </p>
      <p>
        If you are a consumer in India, you keep the protections of the Consumer
        Protection Act, 2019, including the right to approach a consumer commission where
        you live. If you are a consumer in a state of the United States, you keep the
        mandatory protections of that state. Those rights stay in place under these
        Terms.
      </p>
      <p>
        We may seek injunctive relief in any appropriate court to protect the Service or
        our intellectual property. Other disputes may be brought in the state or federal
        courts located in Washington State, or in the forum the law gives you as a
        consumer.
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
        Questions about these Terms, and privacy complaints from people in India, go to{' '}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. For people in India, that
        address is the grievance contact.
      </p>
      <p className="legal-muted">Last updated: {TERMS_LAST_UPDATED}</p>
    </>
  )
}
