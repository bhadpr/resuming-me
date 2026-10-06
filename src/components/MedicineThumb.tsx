import { useThemedArt } from '../hooks/useThemedArt'
import { medicineFallbackSrc } from '../lib/medicineFormat'
import type { MedicineSystem } from '../lib/medicineSchedule'

export function MedicineThumb({
  photo,
  system,
  className = 'medicine-thumb',
}: {
  photo?: string | null
  system?: MedicineSystem | null
  className?: string
}) {
  const art = useThemedArt()
  const fallback = medicineFallbackSrc(system ?? 'allopathic')
  const src = photo || (fallback ? art(fallback) : null)
  return <img className={className} src={src ?? undefined} alt="" />
}
