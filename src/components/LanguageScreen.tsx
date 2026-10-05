import { BrandTitle } from './BrandTitle'
import { useLocale } from '../hooks/useLocale'
import { LOCALES, translate, type Locale } from '../lib/i18n'

const LABEL_KEY: Record<Locale, string> = {
  en: 'language.english',
  hi: 'language.hindi',
  te: 'language.telugu',
  gu: 'language.gujarati',
  mr: 'language.marathi',
  ta: 'language.tamil',
}

/** First screen after install. Each language is written in its own script. */
export function LanguageScreen() {
  const { setLocale } = useLocale()

  return (
    <div className="language-screen">
      <BrandTitle size="lg" />
      <p className="tagline language-screen-tagline" lang="en">
        {translate('en', 'landing.tagline')}
      </p>
      <p className="language-screen-prompt" lang="en">
        {translate('en', 'language.choose')}
      </p>
      <div className="language-screen-choices">
        {LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            className="btn btn-secondary"
            lang={code}
            onClick={() => setLocale(code)}
          >
            {translate(code, LABEL_KEY[code])}
          </button>
        ))}
      </div>
      <p className="language-screen-later" lang="en">
        {translate('en', 'language.later')}
      </p>
    </div>
  )
}
