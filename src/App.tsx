import { useEffect } from 'react'
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
import { LandingPage } from './components/LandingPage'
import { LegalPage } from './components/LegalPage'
import { FeedbackPage } from './components/FeedbackPage'
import { NotFoundPage } from './components/NotFoundPage'
import { StartPage } from './components/StartPage'
import { GuestMergeBanner } from './components/GuestMergeBanner'
import { hideNativeSplash } from './lib/nativeChrome'
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

function RootLayout() {
  useAndroidBackButton()
  return (
    <>
      <ScrollRestoration />
      <GuestMergeBanner />
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
    const next = safeNextPath(`${location.pathname}${location.search}`) ?? '/today'
    return <Navigate to={`/?next=${encodeURIComponent(next)}`} replace />
  }

  return <Outlet />
}

function publicBack(navigate: ReturnType<typeof useNavigate>) {
  navigateBack(navigate, '/')
}

function PublicLegalRoute({ page }: { page: Exclude<SitePageId, 'feedback'> }) {
  const navigate = useNavigate()
  const native = Capacitor.isNativePlatform()

  useEffect(() => {
    trackPageView(`/${page}`, page)
  }, [page])

  useEffect(() => {
    void hideNativeSplash().catch(() => {})
  }, [])

  return (
    <div className={native ? 'app' : 'landing landing-legal'}>
      <div className={native ? 'app-main' : 'landing-card landing-card-legal'}>
        <LegalPage page={page} onBack={() => publicBack(navigate)} />
      </div>
    </div>
  )
}

function PublicFeedbackRoute() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const native = Capacitor.isNativePlatform()

  useEffect(() => {
    trackPageView('/feedback', 'feedback')
  }, [])

  useEffect(() => {
    void hideNativeSplash().catch(() => {})
  }, [])

  return (
    <div className={native ? 'app' : 'landing landing-legal'}>
      <div className={native ? 'app-main' : 'landing-card landing-card-legal'}>
        <FeedbackPage
          onBack={() => publicBack(navigate)}
          defaultName={user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? ''}
          defaultEmail={user?.email ?? ''}
        />
      </div>
    </div>
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
              { path: '/insights', element: <RouteSlot /> },
              { path: '/settings', element: <RouteSlot /> },
              { path: '/admin/analytics', element: <RouteSlot /> },
              { path: '/admin/feedback', element: <RouteSlot /> },
            ],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
