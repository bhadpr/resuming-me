/** A school calendar is offered in these time zones. Canada and Mexico share the clock, not the zone name. */
const US_TIME_ZONES = new Set([
  'America/New_York',
  'America/Detroit',
  'America/Kentucky/Louisville',
  'America/Kentucky/Monticello',
  'America/Indiana/Indianapolis',
  'America/Indiana/Vincennes',
  'America/Indiana/Winamac',
  'America/Indiana/Marengo',
  'America/Indiana/Petersburg',
  'America/Indiana/Vevay',
  'America/Chicago',
  'America/Indiana/Tell_City',
  'America/Indiana/Knox',
  'America/Menominee',
  'America/North_Dakota/Center',
  'America/North_Dakota/New_Salem',
  'America/North_Dakota/Beulah',
  'America/Denver',
  'America/Boise',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'America/Juneau',
  'America/Sitka',
  'America/Metlakatla',
  'America/Yakutat',
  'America/Nome',
  'America/Adak',
  'Pacific/Honolulu',
  'America/Puerto_Rico',
  'America/St_Thomas',
  'Pacific/Guam',
  'Pacific/Saipan',
  'Pacific/Pago_Pago',
])

/** A large city district, such as New York City, plus a little room. */
export const SCHOOL_ZIP_MAX = 300
const SCHOOL_ZIP_KEY = 'resuming-school-zip'

export function isUsTimeZone(zone = Intl.DateTimeFormat().resolvedOptions().timeZone): boolean {
  return US_TIME_ZONES.has(zone)
}

/** India has one time zone. Asia/Calcutta is the older name for the same clock. */
export function isIndiaTimeZone(zone = Intl.DateTimeFormat().resolvedOptions().timeZone): boolean {
  return zone === 'Asia/Kolkata' || zone === 'Asia/Calcutta'
}

/** US catalogs follow this. India holidays are shown in every region. */
export function communityRegion(zone = Intl.DateTimeFormat().resolvedOptions().timeZone): 'us' | 'in' | null {
  if (isUsTimeZone(zone)) return 'us'
  if (isIndiaTimeZone(zone)) return 'in'
  return null
}

/** Five-digit codes. Spaces or commas may separate them. Blank is an empty list. */
export function parseZipCodes(source: string): { ok: true; zipCodes: string[] } | { ok: false } {
  const trimmed = source.trim()
  if (!trimmed) return { ok: true, zipCodes: [] }
  const tokens = trimmed.split(/[^0-9]+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > SCHOOL_ZIP_MAX || tokens.some((token) => token.length !== 5)) {
    return { ok: false }
  }
  return { ok: true, zipCodes: [...new Set(tokens)] }
}

export function readSchoolZip(): string | null {
  try {
    const value = localStorage.getItem(SCHOOL_ZIP_KEY) ?? ''
    const parsed = parseZipCodes(value)
    if (!parsed.ok || parsed.zipCodes.length !== 1) return null
    return parsed.zipCodes[0]
  } catch {
    return null
  }
}

export function writeSchoolZip(zip: string): void {
  localStorage.setItem(SCHOOL_ZIP_KEY, zip)
}
