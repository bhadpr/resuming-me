import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { BrandTitle } from './BrandTitle'
import { SiteFooter } from './SiteFooter'
import { trackPageView } from '../lib/analytics'
import { consumeAccountDeletedFlag } from '../lib/clearLocalData'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  useDocumentMeta,
} from '../hooks/useDocumentMeta'
import { playStoreUrl } from '../lib/marketing'
import { track } from '../lib/track'
import { useLocale } from '../hooks/useLocale'
import { LanguagePicker } from './LanguagePicker'

function LandingBrand() {
  return (
    <div className="brand-line">
      <BrandTitle size="lg" className="landing-brand" />
      <LanguagePicker />
    </div>
  )
}

interface LandingPageProps {
  configured: boolean
  configError?: string | null
  authError?: string | null
  onSignIn: () => Promise<void>
}

export function LandingPage({
  configured,
  configError = null,
  authError = null,
  onSignIn,
}: LandingPageProps) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const native = Capacitor.isNativePlatform()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [accountDeleted] = useState(() => consumeAccountDeletedFlag())

  useDocumentMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
  })

  useEffect(() => {
    trackPageView('/', 'Landing')
    track('landing_viewed', {
      referrer: document.referrer ? document.referrer.slice(0, 200) : null,
      // A link tagged ?utm_source=name shows up as that channel in the growth numbers.
      utm_source: new URLSearchParams(window.location.search).get('utm_source')?.slice(0, 60) ?? null,
    })
  }, [])

  async function handleSignIn() {
    track('signin_clicked')
    setError(null)
    setSigningIn(true)
    try {
      await onSignIn()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed')
      setSigningIn(false)
    }
  }

  function startSetup() {
    track('get_started_clicked')
    navigate('/start?step=1')
  }

  const displayError = configError || authError || error

  if (!configured) {
    return (
      <div className="landing">
        <div className="landing-card">
          <LandingBrand />
          <p className="tagline">
            {t('landing.tagline')}
            <span className="tagline-accent">{t('landing.taglineAccent')}</span>
          </p>
          <div className="notice notice-warning">
            <p>{configError ?? 'Supabase is not configured.'}</p>
          </div>
          <SiteFooter privacyOnly={native} />
        </div>
      </div>
    )
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <LandingBrand />
        <p className="tagline">
          {t('landing.tagline')}
          <span className="tagline-accent">{t('landing.taglineAccent')}</span>
        </p>
        <p className="explainer">{t('landing.explainer')}</p>

        <figure className="landing-hero-figure">
          <img
            className="landing-hero-image"
            src="/landing/hero-idea-3d.jpg"
            alt="A woman meditating by a sunrise window, with a glass of water, a blood pressure cuff, walking shoes, and a board of dates to remember."
            width={1152}
            height={864}
            decoding="async"
          />
        </figure>

        {accountDeleted && (
          <div className="notice" role="status">
            <p>{t('landing.deleted')}</p>
          </div>
        )}
        {displayError && (
          <div className="notice notice-warning">
            <p>{displayError}</p>
          </div>
        )}

        <div className="landing-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={startSetup}>
            {t('landing.getStarted')}
          </button>
          <p className="landing-actions-note">{t('landing.noAccount')}</p>
          <div className="landing-signin">
            <p className="landing-signin-heading">{t('landing.haveAccount')}</p>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                track('signin_method_clicked', { method: 'google' })
                void handleSignIn()
              }}
              disabled={signingIn}
            >
              {signingIn ? t('landing.redirecting') : t('landing.signInGoogle')}
            </button>
          </div>
        </div>

        <SiteFooter
          privacyOnly={native}
          leading={
            native ? null : (
              <a
                className="landing-get-app"
                href={playStoreUrl('landing')}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => track('get_app_clicked', { where: 'landing' })}
              >
                {t('landing.getApp')}
              </a>
            )
          }
        />
      </div>
    </div>
  )
}
