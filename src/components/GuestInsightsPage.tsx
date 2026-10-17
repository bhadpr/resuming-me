import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { todayLocalDate } from '../lib/dates'
import { loadGuestDraft } from '../lib/guestDraft'
import { guestDraftInsights } from '../lib/guestInsights'
import { computeInsights, type InsightsWindow } from '../lib/insights'
import { GuestSaveWidget } from './GuestSaveWidget'
import { InsightsScreen } from './InsightsScreen'

/** Insights from the guest draft. Nothing is sent to the server. */
export function GuestInsightsPage() {
  const navigate = useNavigate()
  const [draft] = useState(() => loadGuestDraft())
  const [window, setWindow] = useState<InsightsWindow>('week')
  const today = todayLocalDate()
  const mapped = useMemo(
    () =>
      draft
        ? guestDraftInsights(draft)
        : { activities: [], entries: [], metrics: [], metricEntries: [] },
    [draft],
  )
  const insights = useMemo(
    () => computeInsights(mapped.activities, mapped.entries, window, today),
    [mapped.activities, mapped.entries, window, today],
  )

  return (
    <div className="today-screen">
      {draft && <GuestSaveWidget draft={draft} />}
      <InsightsScreen
        window={window}
        onWindowChange={setWindow}
        insights={insights}
        activities={mapped.activities}
        entries={mapped.entries}
        metrics={mapped.metrics}
        metricEntries={mapped.metricEntries}
        today={today}
        loading={false}
        error={null}
        onAddActivity={() => navigate('/start?step=1&add=1')}
        onAddMetric={() => navigate('/start?step=1&add=1&vital=1')}
      />
    </div>
  )
}
