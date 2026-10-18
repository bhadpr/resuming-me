import { useLocale } from '../hooks/useLocale'
import { isLocale, LOCALES, type Locale } from '../lib/i18n'

const LABEL_KEY: Record<Locale, string> = {
  en: 'language.english',
  hi: 'language.hindi',
  te: 'language.telugu',
  gu: 'language.gujarati',
  mr: 'language.marathi',
  ta: 'language.tamil',
  bn: 'language.bengali',
}

/** Language switch. The choice is saved on this device. */
export function LanguagePicker({
  className = '',
  variant = 'select',
}: {
  className?: string
  /** Chips on Settings; a compact menu on the landing page. */
  variant?: 'select' | 'chips'
}) {
  const { locale, setLocale, t } = useLocale()

  if (variant === 'chips') {
    return (
      <div className={`st-langs ${className}`.trim()} role="group" aria-label={t('language.label')}>
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            className={`st-lang ${locale === code ? 'st-lang-active' : ''}`}
            aria-pressed={locale === code}
            onClick={() => setLocale(code)}
          >
            {t(LABEL_KEY[code])}
          </button>
        ))}
      </div>
    )
  }

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
