import { useEffect, useRef, type ReactNode } from 'react'
import {
  Navigate,
  Outlet,
  ScrollRestoration,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { Capacitor } from '@capacitor/core'
import { useAuth } from './hooks/useAuth'
import { useAndroidBackButton } from './hooks/useAndroidBackButton'
import { AppShell } from './components/AppShell'
import { BrandTitle } from './components/BrandTitle'
import { LandingPage } from './components/LandingPage'
import { LegalPage } from './components/LegalPage'
import { FeedbackPage } from './components/FeedbackPage'
import { NotFoundPage } from './components/NotFoundPage'
import { DeleteAccountPage } from './components/DeleteAccountPage'
import { StartPage } from './components/StartPage'
import { GuestMergeBanner } from './components/GuestMergeBanner'
import { GuestAppShell, isGuestAppPath } from './components/GuestAppShell'
import { LanguageScreen } from './components/LanguageScreen'
import { useLocale } from './hooks/useLocale'
import { hideNativeSplash } from './lib/nativeChrome'
import { loadGuestDraft } from './lib/guestDraft'
import { markCheckinOpened } from './lib/checkinPrefs'
import { navigateBack, safeNextPath, stashAuthNext, takeAuthNext } from './lib/navigation'
import type { SitePageId } from './lib/site'
import { trackPageView } from './lib/analytics'

function LoadingScreen() {
  return (
    <div className="loading-screen">
      <p>Loading…</p>
    </div>
  )
}

function CheckinOpenedPing() {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const token = params.get('checkin')
  const sent = useRef(false)

  useEffect(() => {
    if (!user || token !== '1' || sent.current) return
    sent.current = true
    void markCheckinOpened().finally(() => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current)
          next.delete('checkin')
          return next
        },
        { replace: true },
      )
    })
  }, [user, token, setParams])

  return null
}

function RootLayout() {
  useAndroidBackButton()
  const { localeChosen, localeResolved } = useLocale()

  useEffect(() => {
    if (!localeResolved) return
    void hideNativeSplash().catch(() => {})
  }, [localeResolved])

  useEffect(() => {
    void import('./lib/marketingCapture').then((mod) => mod.captureMarketingOpen())
  }, [])

  if (!localeResolved) return <LoadingScreen />

  if (!localeChosen) return <LanguageScreen />

  return (
    <>
      <ScrollRestoration />
      <GuestMergeBanner />
      <CheckinOpenedPing />
      <Outlet />
    </>
  )
}

function IndexRoute() {
  const { user, loading, configured, configError, authError, signInWithGoogle } = useAuth()
  const [params] = useSearchParams()

  useEffect(() => {
    const next = safeNextPath(params.get('next'))
    if (next) stashAuthNext(next)
  }, [params])

  useEffect(() => {
    if (loading) return
    void hideNativeSplash().catch(() => {})
  }, [loading])

  if (loading) return <LoadingScreen />

  if (user) {
    const next = safeNextPath(params.get('next')) ?? takeAuthNext()
    return <Navigate to={next ?? '/today'} replace />
  }

  const next = safeNextPath(params.get('next'))
  if (next && loadGuestDraft() && isGuestAppPath(next.split('?')[0] ?? next)) {
    return <Navigate to={next} replace />
  }

  return (
    <LandingPage
      configured={configured}
      configError={configError}
      authError={authError}
      onSignIn={signInWithGoogle}
    />
  )
}

function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()

  useEffect(() => {
    if (loading) return
    void hideNativeSplash().catch(() => {})
  }, [loading])

  if (loading) return <LoadingScreen />

  if (!user) {
    if (loadGuestDraft() && isGuestAppPath(location.pathname)) {
      return <GuestAppShell />
    }
    const next = safeNextPath(`${location.pathname}${location.search}`) ?? '/today'
    stashAuthNext(next)
    return <Navigate to={`/?next=${encodeURIComponent(next)}`} replace />
  }

  return <Outlet />
}

function publicBack(navigate: ReturnType<typeof useNavigate>) {
  navigateBack(navigate, '/')
}

function PublicPageFrame({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const native = Capacitor.isNativePlatform()
  const home = user || loadGuestDraft() ? '/today' : '/'

  useEffect(() => {
    void hideNativeSplash().catch(() => {})
  }, [])

  if (native) {
    return (
      <div className="app">
        <header className="app-header">
          <BrandTitle className="app-title" homeTo={home} />
        </header>
        <main className="app-main">{children}</main>
      </div>
    )
  }

  return (
    <div className="landing landing-legal">
      <div className="landing-card landing-card-legal">
        <div className="brand-line">
          <BrandTitle className="app-title" homeTo={home} />
        </div>
        {children}
      </div>
    </div>
  )
}

function PublicLegalRoute({ page }: { page: Exclude<SitePageId, 'feedback' | 'delete-account'> }) {
  const navigate = useNavigate()

  useEffect(() => {
    trackPageView(`/${page}`, page)
  }, [page])

  return (
    <PublicPageFrame>
      <LegalPage page={page} onBack={() => publicBack(navigate)} />
    </PublicPageFrame>
  )
}

function PublicDeleteAccountRoute() {
  const navigate = useNavigate()

  useEffect(() => {
    trackPageView('/delete-account', 'delete-account')
  }, [])

  return (
    <PublicPageFrame>
      <DeleteAccountPage onBack={() => publicBack(navigate)} />
    </PublicPageFrame>
  )
}

function PublicFeedbackRoute() {
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    trackPageView('/feedback', 'feedback')
  }, [])

  return (
    <PublicPageFrame>
      <FeedbackPage
        onBack={() => publicBack(navigate)}
        defaultName={user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''}
        defaultEmail={user?.email ?? ''}
      />
    </PublicPageFrame>
  )
}

/** Pathless layout: keeps AppShell mounted across app routes. */
function AppShellLayout() {
  return (
    <>
      <AppShell />
      <Outlet />
    </>
  )
}

function RouteSlot() {
  return null
}

export const appRouteObjects = [
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <IndexRoute /> },
      { path: '/start', element: <StartPage /> },
      { path: '/about', element: <PublicLegalRoute page="about" /> },
      { path: '/privacy', element: <PublicLegalRoute page="privacy" /> },
      { path: '/terms', element: <PublicLegalRoute page="terms" /> },
      { path: '/feedback', element: <PublicFeedbackRoute /> },
      { path: '/delete-account', element: <PublicDeleteAccountRoute /> },
      {
        element: <RequireAuth />,
        children: [
          {
            element: <AppShellLayout />,
            children: [
              { path: '/today', element: <RouteSlot /> },
              { path: '/activities', element: <RouteSlot /> },
              { path: '/activities/new', element: <RouteSlot /> },
              { path: '/activities/:id', element: <RouteSlot /> },
              { path: '/activities/:id/edit', element: <RouteSlot /> },
              { path: '/numbers', element: <RouteSlot /> },
              { path: '/numbers/new', element: <RouteSlot /> },
              { path: '/numbers/:id', element: <RouteSlot /> },
              { path: '/numbers/:id/edit', element: <RouteSlot /> },
              { path: '/medicines/new', element: <RouteSlot /> },
              { path: '/medicines/:id', element: <RouteSlot /> },
              { path: '/reminders/new', element: <RouteSlot /> },
              { path: '/reminders/:id', element: <RouteSlot /> },
              { path: '/insights', element: <RouteSlot /> },
              { path: '/review/:weekStart', element: <RouteSlot /> },
              { path: '/settings/themes', element: <RouteSlot /> },
              { path: '/settings/reminders', element: <RouteSlot /> },
              { path: '/settings', element: <RouteSlot /> },
              { path: '/admin/analytics', element: <RouteSlot /> },
              { path: '/admin/feedback', element: <RouteSlot /> },
              { path: '/admin/groups', element: <RouteSlot /> },
              { path: '/admin/groups/:groupId', element: <RouteSlot /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
