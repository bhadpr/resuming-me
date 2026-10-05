import { templateById } from '../data/activityTemplates'
import { getLocale, t, type Locale } from './i18n'

/** Hindi labels for catalog habits and vitals. English stays on the template. */
const HI_LABELS: Record<string, string> = {
  reading: 'पढ़ना',
  walk: 'चलना',
  running: 'दौड़ना',
  exercise: 'ताकत',
  meditate: 'ध्यान',
  stretching: 'व्यायाम',
  water: 'पानी',
  protein: 'प्रोटीन',
  fasting: 'उपवास',
  sleep_hours: 'नींद',
  weight: 'वज़न',
  steps: 'कदम',
  blood_pressure: 'रक्तचाप',
  heart_rate: 'हृदय गति',
  journaling: 'डायरी',
  writing: 'लेखन',
  daily_writing: 'रोज़ लेखन',
  study: 'पढ़ाई',
  language: 'भाषा',
  music: 'संगीत',
  painting: 'चित्रकला',
  dancing: 'नृत्य',
  bhastrika: 'भस्त्रिका',
  kapalabhati: 'कपालभाति',
  anuloma_viloma: 'अनुलोम विलोम',
  bhramari: 'भ्रामरी',
  rejuvenation: 'सफाई',
  prayer: 'प्रार्थना',
  relaxation: 'विश्राम',
}

/** Telugu labels for catalog habits and vitals. */
const TE_LABELS: Record<string, string> = {
  reading: 'చదవడం',
  walk: 'నడక',
  running: 'పరుగు',
  exercise: 'బలం',
  meditate: 'ధ్యానం',
  stretching: 'వ్యాయామం',
  water: 'నీరు',
  protein: 'ప్రోటీన్',
  fasting: 'ఉపవాసం',
  sleep_hours: 'నిద్ర',
  weight: 'బరువు',
  steps: 'అడుగులు',
  blood_pressure: 'రక్తపోటు',
  heart_rate: 'హృదయ స్పందన',
  journaling: 'డైరీ',
  writing: 'రాత',
  daily_writing: 'రోజూ రాత',
  study: 'చదువు',
  language: 'భాష',
  music: 'సంగీతం',
  painting: 'చిత్రలేఖనం',
  dancing: 'నృత్యం',
  bhastrika: 'భస్త్రిక',
  kapalabhati: 'కపాలభాతి',
  anuloma_viloma: 'అనులోమ విలోమ',
  bhramari: 'భ్రామరి',
  rejuvenation: 'శుభ్రం',
  prayer: 'ప్రార్థన',
  relaxation: 'విశ్రాంతి',
}

/** Gujarati labels for catalog habits and vitals. */
const GU_LABELS: Record<string, string> = {
  reading: 'વાંચન',
  walk: 'ચાલવું',
  running: 'દોડ',
  exercise: 'તાકાત',
  meditate: 'ધ્યાન',
  stretching: 'કસરત',
  water: 'પાણી',
  protein: 'પ્રોટીન',
  fasting: 'ઉપવાસ',
  sleep_hours: 'ઊંઘ',
  weight: 'વજન',
  steps: 'પગલાં',
  blood_pressure: 'બ્લડ પ્રેશર',
  heart_rate: 'હૃદય ગતિ',
  journaling: 'ડાયરી',
  writing: 'લેખન',
  daily_writing: 'રોજ લેખન',
  study: 'અભ્યાસ',
  language: 'ભાષા',
  music: 'સંગીત',
  painting: 'ચિત્રકળા',
  dancing: 'નૃત્ય',
  bhastrika: 'ભસ્ત્રિકા',
  kapalabhati: 'કપાલભાતિ',
  anuloma_viloma: 'અનુલોમ વિલોમ',
  bhramari: 'ભ્રામરી',
  rejuvenation: 'સફાઈ',
  prayer: 'પ્રાર્થના',
  relaxation: 'આરામ',
}

/** Marathi labels for catalog habits and vitals. */
const MR_LABELS: Record<string, string> = {
  reading: 'वाचन',
  walk: 'चालणे',
  running: 'धावणे',
  exercise: 'ताकद',
  meditate: 'ध्यान',
  stretching: 'व्यायाम',
  water: 'पाणी',
  protein: 'प्रथिने',
  fasting: 'उपवास',
  sleep_hours: 'झोप',
  weight: 'वजन',
  steps: 'पावले',
  blood_pressure: 'रक्तदाब',
  heart_rate: 'हृदयाची गती',
  journaling: 'डायरी',
  writing: 'लेखन',
  daily_writing: 'रोज लेखन',
  study: 'अभ्यास',
  language: 'भाषा',
  music: 'संगीत',
  painting: 'चित्रकला',
  dancing: 'नृत्य',
  bhastrika: 'भस्त्रिका',
  kapalabhati: 'कपालभाती',
  anuloma_viloma: 'अनुलोम विलोम',
  bhramari: 'भ्रामरी',
  rejuvenation: 'साफसफाई',
  prayer: 'प्रार्थना',
  relaxation: 'विश्रांती',
}

/** Tamil labels for catalog habits and vitals. */
const TA_LABELS: Record<string, string> = {
  reading: 'வாசிப்பு',
  walk: 'நடை',
  running: 'ஓட்டம்',
  exercise: 'வலிமை',
  meditate: 'தியானம்',
  stretching: 'உடற்பயிற்சி',
  water: 'தண்ணீர்',
  protein: 'புரதம்',
  fasting: 'உபவாசம்',
  sleep_hours: 'தூக்கம்',
  weight: 'எடை',
  steps: 'அடிகள்',
  blood_pressure: 'இரத்த அழுத்தம்',
  heart_rate: 'இதயத் துடிப்பு',
  journaling: 'நாட்குறிப்பு',
  writing: 'எழுத்து',
  daily_writing: 'தினசரி எழுத்து',
  study: 'படிப்பு',
  language: 'மொழி',
  music: 'இசை',
  painting: 'ஓவியம்',
  dancing: 'நடனம்',
  bhastrika: 'பஸ்த்ரிகா',
  kapalabhati: 'கபாலபாதி',
  anuloma_viloma: 'அனுலோம விலோம',
  bhramari: 'ப்ராமரி',
  rejuvenation: 'சுத்தம்',
  prayer: 'பிரார்த்தனை',
  relaxation: 'ஓய்வு',
}

const CATALOG_LABELS: Partial<Record<Locale, Record<string, string>>> = {
  hi: HI_LABELS,
  te: TE_LABELS,
  gu: GU_LABELS,
  mr: MR_LABELS,
  ta: TA_LABELS,
}

/** Extra stored names that still mean a catalog item. */
const EXTRA_LABELS: Record<string, readonly string[]> = {
  steps: ['daily steps', 'steps', 'कदम', 'అడుగులు', 'પગલાં', 'पावले', 'அடிகள்'],
  sleep_hours: ['sleep', 'नींद', 'నిద్ర', 'ઊંઘ', 'झोप', 'தூக்கம்'],
  exercise: ['strength', 'exercise', 'ताकत', 'బలం', 'તાકાત', 'ताकद', 'வலிமை'],
  stretching: ['exercises', 'stretch', 'व्यायाम', 'వ్యాయామం', 'કસરત', 'व्यायाम', 'உடற்பயிற்சி'],
  walk: ['walking', 'walk', 'चलना', 'నడక', 'ચાલવું', 'चालणे', 'நடை'],
  rejuvenation: ['cleaning'],
}

export function templateLabel(id: string, locale: Locale = getLocale()): string | null {
  return CATALOG_LABELS[locale]?.[id] ?? templateById(id)?.label ?? null
}

export function groupTitle(title: string, locale: Locale = getLocale()): string {
  if (locale === 'en') return title
  const key = `group.${title}`
  const hit = t(key)
  return hit === key ? title : hit
}

export function isCatalogLabel(templateId: string, name: string): boolean {
  const normalized = name.trim().toLowerCase()
  if (!normalized) return false
  const labels = [
    templateById(templateId)?.label,
    HI_LABELS[templateId],
    TE_LABELS[templateId],
    GU_LABELS[templateId],
    MR_LABELS[templateId],
    TA_LABELS[templateId],
    ...(EXTRA_LABELS[templateId] ?? []),
  ]
  return labels.some((label) => label?.trim().toLowerCase() === normalized)
}

export type NamedItem = {
  name: string
  templateId?: string | null
  template_id?: string | null
  nameOverridden?: boolean
  name_overridden?: boolean
}

/** Catalog names follow the language. A renamed or custom item keeps its text. */
export function visibleName(item: NamedItem, locale: Locale = getLocale()): string {
  const id = item.templateId ?? item.template_id ?? null
  const overridden = Boolean(item.nameOverridden ?? item.name_overridden)
  if (id && !overridden) {
    const label = templateLabel(id, locale)
    if (label) return label
  }
  return item.name
}

/** Analytics code. Never a free-text name. */
export function catalogTrackId(templateId: string | null | undefined): string {
  if (templateId && /^[a-z0-9_]{1,40}$/.test(templateId)) return templateId
  return 'custom'
}
