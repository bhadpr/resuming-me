import { useAuth } from './hooks/useAuth'
import { AppShell } from './components/AppShell'
import { LandingPage } from './components/LandingPage'

export default function App() {
  const { user, loading, configured, configError, authError, signInWithGoogle } = useAuth()

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
