import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { EmailSignInForm } from './EmailSignInForm'
import { BrandTitle } from './BrandTitle'
import { SiteFooter } from './SiteFooter'
import { trackPageView } from '../lib/analytics'
import { consumeAccountDeletedFlag } from '../lib/clearLocalData'
import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  useDocumentMeta,
} from '../hooks/useDocumentMeta'
import { track } from '../lib/track'
import { templateLabel } from '../lib/catalogName'
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

const PREVIEW_DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

/** Sample week — gaps, then coming back. */
const PREVIEW_SERIES = [
  {
    name: 'Walking',
    unit: 'min',
    target: 20,
    values: [0, 10, 0, 20, 15, 0, 20],
  },
] as const

/** Resuming’s path — restart energy, not “become a better you.” */
const INTENT_STEPS = [
  {
    id: 'postponed',
    question: 'Got something you’ve been putting off?',
    action: 'Yes',
    image: '/intent/postponed.webp',
    imageAlt: 'A quiet desk with a closed notebook waiting to be opened.',
  },
  {
    id: 'small',
    question: 'Okay starting small — even a few minutes?',
    action: 'Yes',
    image: '/intent/small.webp',
    imageAlt: 'A person taking one small step on a path at sunrise.',
  },
  {
    id: 'promise',
    question: 'I’ll come back when I drift.',
    action: 'I promise',
    image: '/intent/promise.webp',
    imageAlt: 'An open doorway with warm light — coming back home.',
  },
] as const

function previewDoneDays(values: readonly number[], target: number): number {
  return values.filter((value) => value >= target).length
}

export function LandingPage({
  configured,
  configError = null,
  authError = null,
  onSignIn,
}: LandingPageProps) {
  const navigate = useNavigate()
  const { t, locale } = useLocale()
  const native = Capacitor.isNativePlatform()
  const [error, setError] = useState<string | null>(null)
  const [signingIn, setSigningIn] = useState(false)
  const [accountDeleted] = useState(() => consumeAccountDeletedFlag())
  const [showSignIn, setShowSignIn] = useState(() => Boolean(authError) || accountDeleted)
  const [intentIndex, setIntentIndex] = useState<number | null>(null)

  useDocumentMeta({
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    path: '/',
  })

  useEffect(() => {
    trackPageView('/', 'Landing')
    track('landing_viewed', {
      referrer: document.referrer ? document.referrer.slice(0, 200) : null,
    })
  }, [])

  useEffect(() => {
    if (authError) setShowSignIn(true)
  }, [authError])

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

  function startIntent() {
    track('get_started_clicked')
    track('intent_journey_started')
    setIntentIndex(0)
  }

  function advanceIntent() {
    if (intentIndex == null) return
    const step = INTENT_STEPS[intentIndex]
    track('intent_step_answered', { step: step.id, choice: step.action })
    if (intentIndex + 1 >= INTENT_STEPS.length) {
      track('intent_journey_completed')
      navigate('/start?step=1')
      return
    }
    setIntentIndex(intentIndex + 1)
  }

  const displayError = configError || authError || error
  const intentStep = intentIndex != null ? INTENT_STEPS[intentIndex] : null

  if (!configured) {
    return (
      <div className="landing">
        <div className="landing-card">
          <LandingBrand />
          <p className="tagline">{t('landing.tagline')}</p>
          <div className="notice notice-warning">
            <p>{configError ?? 'Supabase is not configured.'}</p>
          </div>
          <SiteFooter privacyOnly={native} />
        </div>
      </div>
    )
  }

  if (intentStep) {
    return (
      <div className="landing">
        <div className="landing-card landing-intent">
          <LandingBrand />
          <p className="landing-intent-progress" aria-hidden>
            {INTENT_STEPS.map((step, index) => (
              <span
                key={step.id}
                className={`landing-intent-dot${index <= intentIndex! ? ' landing-intent-dot-on' : ''}`}
              />
            ))}
          </p>
          <figure className="landing-intent-figure">
            <img
              className="landing-intent-image"
              src={intentStep.image}
              alt={intentStep.imageAlt}
              width={768}
              height={768}
              decoding="async"
            />
          </figure>
          <h1 className="landing-intent-question">
            {intentStep.id === 'postponed'
              ? t('landing.postponed')
              : intentStep.id === 'small'
                ? t('landing.small')
                : t('landing.promiseQ')}
          </h1>
          <button type="button" className="btn btn-primary btn-lg" onClick={advanceIntent}>
            {intentStep.id === 'promise' ? t('landing.promise') : t('landing.yes')}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              track('intent_journey_skipped', {
                at: intentStep.id,
              })
              navigate('/start?step=1')
            }}
          >
            {t('landing.skip')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="landing">
      <div className="landing-card">
        <LandingBrand />
        <p className="tagline">{t('landing.tagline')}</p>
        <p className="explainer">{t('landing.explainer')}</p>

        <figure className="landing-hero-figure">
          <img
            className="landing-hero-image"
            src="/landing/hero.png"
            alt="Sitting with what’s been put off, then walking toward the light again."
            width={768}
            height={1024}
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

        <div className="landing-preview" aria-label={t('landing.previewLabel')}>
          <div className="landing-preview-header">
            <p className="landing-preview-title">{t('landing.thisWeek')}</p>
            <p className="landing-preview-sub">{t('landing.previewSub')}</p>
          </div>
          <ul className="landing-preview-list">
            {PREVIEW_SERIES.map((series) => {
              const doneDays = previewDoneDays(series.values, series.target)
              return (
                <li key={series.name} className="landing-preview-row">
                  <div className="landing-preview-meta">
                    <span className="landing-preview-name">{templateLabel('walk', locale)}</span>
                    <span className="landing-preview-stat">
                      {t('landing.days', {
                        done: doneDays,
                        total: PREVIEW_DAYS.length,
                        target: series.target,
                        unit: series.unit,
                      })}
                    </span>
                  </div>
                  <div className="landing-preview-chart" aria-hidden>
                    {series.values.map((value, index) => {
                      const ratio = Math.min(1, value / series.target)
                      const state =
                        value <= 0 ? 'empty' : value >= series.target ? 'done' : 'partial'
                      return (
                        <div key={`${series.name}-${index}`} className="landing-preview-col">
                          <div className="landing-preview-bar-track">
                            <div
                              className={`landing-preview-bar landing-preview-bar-${state}`}
                              style={{ height: `${Math.max(ratio * 100, value > 0 ? 12 : 0)}%` }}
                              title={`${PREVIEW_DAYS[index]}: ${value} ${series.unit}`}
                            />
                          </div>
                          <span className="landing-preview-day">{PREVIEW_DAYS[index]}</span>
                        </div>
                      )
                    })}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="landing-actions">
          <button type="button" className="btn btn-primary btn-lg" onClick={startIntent}>
            {t('landing.getStarted')}
          </button>
          <p className="landing-actions-note">{t('landing.noAccount')}</p>
        </div>

        {!showSignIn ? (
          <button
            type="button"
            className="btn btn-ghost landing-signin-toggle"
            onClick={() => {
              track('signin_reveal_clicked')
              setShowSignIn(true)
            }}
          >
            {t('landing.haveAccount')}
          </button>
        ) : (
          <div className="landing-signin">
            <p className="landing-signin-heading">{t('landing.signIn')}</p>
            <EmailSignInForm
              onClick={() => track('signin_method_clicked', { method: 'email' })}
            />
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                track('signin_method_clicked', { method: 'google' })
                void handleSignIn()
              }}
              disabled={signingIn}
            >
              {signingIn ? t('landing.redirecting') : t('landing.google')}
            </button>
          </div>
        )}

        <SiteFooter privacyOnly={native} />
      </div>
    </div>
  )
}
