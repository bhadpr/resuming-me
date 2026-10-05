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
  const src = photo || medicineFallbackSrc(system ?? 'allopathic')
  return <img className={className} src={src ?? undefined} alt="" />
}
