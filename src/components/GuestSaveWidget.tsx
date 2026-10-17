import { Link } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import { guestSaveWarning, guestSaveWarningUrgent, setGuestStep, type GuestDraft } from '../lib/guestDraft'

/** Sign-in prompt for guests, shown at the top of Today, Activity, Vitals, and Insights. */
export function GuestSaveWidget({ draft }: { draft: GuestDraft }) {
  const { t } = useLocale()
  const warning = guestSaveWarning(draft)
  const urgent = guestSaveWarningUrgent(draft)
  return (
    <div className="guest-save-widget">
      {warning ? (
        <p className={`guest-save-widget-warning${urgent ? ' guest-save-widget-warning-urgent' : ''}`}>{warning}</p>
      ) : null}
      <Link className="btn btn-primary" to="/start?step=8" onClick={() => setGuestStep(draft, 8)}>
        {t('today.save')}
      </Link>
      {warning ? null : <p className="guest-save-widget-note">{t('today.stays')}</p>}
    </div>
  )
}
