import { useEffect } from 'react'
import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/AppShell'
import { LandingPage } from './components/LandingPage'
import { hideNativeSplash } from './lib/nativeChrome'
import { sitePageFromPath } from './lib/site'

export default function App() {
  const { user, loading, configured, configError, authError, signInWithGoogle } = useAuth()
  const publicPage = sitePageFromPath(window.location.pathname)

  useEffect(() => {
    if (loading) return
    void hideNativeSplash().catch(() => {})
  }, [loading])

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
