import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import { LocaleProvider } from './hooks/useLocale'
import { ThemeProvider } from './hooks/useTheme'
import { setupServiceWorker } from './lib/pwa'
import { initTracking } from './lib/track'
import { appRouteObjects } from './App'
import './fonts-dawn.css'
import './themes.css'
import './index.css'

void setupServiceWorker()
initTracking()

const router = createBrowserRouter(appRouteObjects)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <LocaleProvider>
          <RouterProvider router={router} />
        </LocaleProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
)
