import { useEffect, useState } from 'react'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/AppShell'
import { LandingPage } from './components/LandingPage'
import { NotFoundPage } from './components/NotFoundPage'
import { hideNativeSplash } from './lib/nativeChrome'
import { isKnownPath, sitePageFromPath } from './lib/site'

export default function App() {
  const { user, loading, configured, configError, authError, signInWithGoogle } = useAuth()
  const [pathname, setPathname] = useState(() => window.location.pathname)
  const publicPage = sitePageFromPath(pathname)
  const known = isKnownPath(pathname)

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    if (loading) return
    void hideNativeSplash().catch(() => {})
  }, [loading])

  if (!known) {
    return (
      <NotFoundPage
        onHome={() => {
          window.history.pushState(null, '', '/')
          setPathname('/')
        }}
      />
    )
  }

  if (publicPage) {
    return (
      <LandingPage
        configured={configured}
        configError={configError}
        authError={authError}
        onSignIn={signInWithGoogle}
      />
    )
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <p>Loading…</p>
      </div>
    )
  }

  if (!user) {
    return (
      <LandingPage
        configured={configured}
        configError={configError}
        authError={authError}
        onSignIn={signInWithGoogle}
      />
    )
  }

  return <AppShell />
}
