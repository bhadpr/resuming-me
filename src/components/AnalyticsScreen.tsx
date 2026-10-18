import { useEffect, useState } from 'react'
import {
  fetchPageViewsForAnalytics,
  fetchProductAnalytics,
  fetchSignedInEmails,
  summarizePageViews,
  type AnalyticsSummary,
  type AnalyticsWindow,
  type ProductAnalyticsSummary,
  type SignedInAccount,
} from '../lib/analytics'
import { fetchOnboardingFunnel, type OnboardingFunnel } from '../lib/onboardingFunnel'
import { fetchGuestJourney, type CreateCounts, type GuestJourney } from '../lib/guestJourney'
import { fetchLoopAnalytics, type CohortRow, type ComebackLoopSummary } from '../lib/loopAnalytics'
import { fetchReminderSummary, type ReminderSummary } from '../lib/reminderAnalytics'
import { AnalyticsView } from './AnalyticsView'
import { GrowthSection } from './GrowthSection'
import { fetchSiteEvents, summarizeSiteEvents, type SiteSummary } from '../lib/siteAnalytics'

export function AnalyticsScreen() {
  const [window, setWindow] = useState<AnalyticsWindow>('7d')
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null)
  const [product, setProduct] = useState<ProductAnalyticsSummary | null>(null)
  const [accounts, setAccounts] = useState<SignedInAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [productLoading, setProductLoading] = useState(true)
  const [accountsError, setAccountsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [productError, setProductError] = useState<string | null>(null)
  const [funnel, setFunnel] = useState<OnboardingFunnel | null>(null)
  const [funnelError, setFunnelError] = useState<string | null>(null)
  const [loop, setLoop] = useState<ComebackLoopSummary | null>(null)
  const [cohorts, setCohorts] = useState<CohortRow[]>([])
  const [loopError, setLoopError] = useState<string | null>(null)
  const [journey, setJourney] = useState<GuestJourney | null>(null)
  const [creates, setCreates] = useState<CreateCounts | null>(null)
  const [journeyError, setJourneyError] = useState<string | null>(null)
  const [reminders, setReminders] = useState<ReminderSummary | null>(null)
  const [remindersError, setRemindersError] = useState<string | null>(null)
  const [site, setSite] = useState<SiteSummary | null>(null)
  const [siteLoading, setSiteLoading] = useState(true)
  const [siteError, setSiteError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setSiteLoading(true)
    setSiteError(null)
    fetchSiteEvents(window)
      .then((rows) => {
        if (mounted) setSite(summarizeSiteEvents(rows))
      })
      .catch((err) => {
        if (!mounted) return
        setSite(null)
        setSiteError(err instanceof Error ? err.message : 'Could not load website numbers')
      })
      .finally(() => {
        if (mounted) setSiteLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setRemindersError(null)
    fetchReminderSummary(window)
      .then((summary) => {
        if (mounted) setReminders(summary)
      })
      .catch((err) => {
        if (!mounted) return
        setReminders(null)
        setRemindersError(err instanceof Error ? err.message : 'Could not load reminders')
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setLoading(true)
    setError(null)
    fetchPageViewsForAnalytics(window)
      .then((rows) => {
        if (!mounted) return
        setSummary(summarizePageViews(rows, window))
      })
      .catch((err) => {
        if (!mounted) return
        setSummary(null)
        setError(err instanceof Error ? err.message : 'Could not load analytics')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setProductLoading(true)
    setProductError(null)
    fetchProductAnalytics(window)
      .then((rows) => {
        if (!mounted) return
        setProduct(rows)
      })
      .catch((err) => {
        if (!mounted) return
        setProduct(null)
        setProductError(
          err instanceof Error ? err.message : 'Could not load product analytics',
        )
      })
      .finally(() => {
        if (mounted) setProductLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setJourneyError(null)
    fetchGuestJourney(window)
      .then((result) => {
        if (!mounted) return
        setJourney(result.journey)
        setCreates(result.creates)
      })
      .catch((err) => {
        if (!mounted) return
        setJourney(null)
        setCreates(null)
        setJourneyError(err instanceof Error ? err.message : 'Could not load guest journeys')
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setFunnelError(null)
    fetchOnboardingFunnel(window)
      .then((result) => {
        if (!mounted) return
        setFunnel(result)
      })
      .catch((err) => {
        if (!mounted) return
        setFunnel(null)
        setFunnelError(err instanceof Error ? err.message : 'Could not load the funnel')
      })
    return () => {
      mounted = false
    }
  }, [window])

  useEffect(() => {
    let mounted = true
    setLoopError(null)
    fetchLoopAnalytics(90)
      .then((result) => {
        if (!mounted) return
        setLoop(result.loop)
        setCohorts(result.cohorts)
      })
      .catch((err) => {
        if (!mounted) return
        setLoop(null)
        setCohorts([])
        setLoopError(err instanceof Error ? err.message : 'Could not load the comeback loop')
      })
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    let mounted = true
    setAccountsError(null)
    fetchSignedInEmails()
      .then((rows) => {
        if (!mounted) return
        setAccounts(rows)
      })
      .catch((err) => {
        if (!mounted) return
        setAccounts([])
        setAccountsError(
          err instanceof Error ? err.message : 'Could not load signed-in emails',
        )
      })
    return () => {
      mounted = false
    }
  }, [])

  return (
    <AnalyticsView
      window={window}
      onWindow={setWindow}
      summary={summary}
      loading={loading}
      error={error}
      product={product}
      productLoading={productLoading}
      productError={productError}
      site={site}
      siteLoading={siteLoading}
      siteError={siteError}
      journey={journey}
      creates={creates}
      journeyError={journeyError}
      funnel={funnel}
      funnelError={funnelError}
      reminders={reminders}
      remindersError={remindersError}
      loop={loop}
      cohorts={cohorts}
      loopError={loopError}
      accounts={accounts}
      accountsError={accountsError}
      growth={<GrowthSection />}
    />
  )
}
