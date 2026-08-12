import { useTheme } from '../hooks/useTheme'
import { DEFAULT_THEME, type ThemeId } from '../lib/themes'

interface SettingsScreenProps {
  onBack: () => void
  isAdmin?: boolean
  onOpenAnalytics?: () => void
}

export function SettingsScreen({
  onBack,
  isAdmin = false,
  onOpenAnalytics,
}: SettingsScreenProps) {
  const { themeId, themes, setThemeId } = useTheme()

  return (
    <div className="settings-screen">
      <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={onBack}>
        ← Back
      </button>

      <div className="screen-heading">
        <div>
          <h2>Settings</h2>
          <p className="screen-sub">Choose how Resuming looks.</p>
        </div>
      </div>

      <section className="today-section">
        <h3 className="section-label">Theme</h3>
        <ul className="theme-list">
          {themes.map((theme) => {
            const selected = theme.id === themeId
            return (
              <li key={theme.id}>
                <button
                  type="button"
                  className={`theme-option ${selected ? 'theme-option-selected' : ''}`}
                  onClick={() => setThemeId(theme.id as ThemeId)}
                  aria-pressed={selected}
                >
                  <span className={`theme-swatch theme-swatch-${theme.id}`} aria-hidden />
                  <span className="activity-meta">
                    <span className="activity-name">
                      {theme.name}
                      {theme.id === DEFAULT_THEME ? ' · default' : ''}
                      <span className={`theme-mode-badge theme-mode-${theme.colorScheme}`}>
                        {theme.colorScheme}
                      </span>
                    </span>
                    <span className="activity-desc">{theme.description}</span>
                  </span>
                  <span className="theme-check" aria-hidden>
                    {selected ? '●' : '○'}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      {isAdmin && onOpenAnalytics && (
        <section className="today-section">
          <h3 className="section-label">Admin</h3>
          <button
            type="button"
            className="theme-option settings-nav-link"
            onClick={onOpenAnalytics}
          >
            <span className="activity-meta">
              <span className="activity-name">Analytics</span>
              <span className="activity-desc">Website traffic and page views</span>
            </span>
            <span className="activity-chevron" aria-hidden>
              ›
            </span>
          </button>
        </section>
      )}
    </div>
  )
}
