import { useLocale } from '../hooks/useLocale'
import { useTheme } from '../hooks/useTheme'
import { THEME_PREFERENCES } from '../lib/themes'
import { Icon } from './Icon'

export function ThemesScreen({ onBack }: { onBack: () => void }) {
  const { preference, setPreference } = useTheme()
  const { t } = useLocale()

  return (
    <>
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        <Icon name="back" />
        {t('themes.back')}
      </button>
      <ul className="theme-list">
        {THEME_PREFERENCES.map((id) => {
          const selected = id === preference
          return (
            <li key={id}>
              <button
                type="button"
                className={`theme-option ${selected ? 'theme-option-selected' : ''}`}
                onClick={() => setPreference(id)}
                aria-pressed={selected}
              >
                <span className={`theme-swatch theme-swatch-${id}`} aria-hidden />
                <span className="activity-meta">
                  <span className="activity-name">{t(`themes.${id}`)}</span>
                  <span className="activity-desc">{t(`themes.${id}Desc`)}</span>
                </span>
                {selected ? (
                  <span className="theme-check" aria-hidden>
                    <Icon name="check" />
                  </span>
                ) : (
                  <span className="theme-check theme-check-empty" aria-hidden />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}
