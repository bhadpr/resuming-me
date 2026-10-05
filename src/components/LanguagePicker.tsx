import { useLocale } from '../hooks/useLocale'
import { isLocale, LOCALES, type Locale } from '../lib/i18n'

const LABEL_KEY: Record<Locale, string> = {
  en: 'language.english',
  hi: 'language.hindi',
  te: 'language.telugu',
  gu: 'language.gujarati',
  mr: 'language.marathi',
  ta: 'language.tamil',
}

/** Language switch. The choice is saved on this device. */
export function LanguagePicker({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useLocale()
  return (
    <label className={`language-picker ${className}`.trim()}>
      <span className="visually-hidden">{t('language.label')}</span>
      <select
        className="field-input language-select"
        value={locale}
        aria-label={t('language.label')}
        onChange={(event) => {
          const next = event.target.value
          if (isLocale(next)) setLocale(next)
        }}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {t(LABEL_KEY[code])}
          </option>
        ))}
      </select>
    </label>
  )
}
