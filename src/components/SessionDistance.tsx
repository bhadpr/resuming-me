import { useSessionDistance } from '../hooks/useSessionDistance'
import { useLocale } from '../hooks/useLocale'
import { formatDistance, type DistanceSession } from '../lib/healthDistance'

/** Total distance from these sessions, or a link to allow Health Connect distance. */
export function SessionDistanceLine({
  entries,
  showTotal = true,
}: {
  entries: DistanceSession[]
  showTotal?: boolean
}) {
  const { t } = useLocale()
  const { access, meters, connect } = useSessionDistance(entries, showTotal)
  const label = meters == null ? null : formatDistance(meters)
  if (label) return <span className="activity-desc session-distance">{label}</span>
  if (access !== 'needs-permission') return null
  return (
    <button type="button" className="session-distance-connect" onClick={connect}>
      {t('today.distanceConnect')}
    </button>
  )
}

/** History row suffix, e.g. " · 2.1 km". */
export function SessionDistanceSuffix({ entry }: { entry: DistanceSession }) {
  const { meters } = useSessionDistance([entry])
  const label = meters == null ? null : formatDistance(meters)
  return label ? <> · {label}</> : null
}
