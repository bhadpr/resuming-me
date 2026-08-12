import { addDays, todayLocalDate } from './dates'
import type { ActivityInput } from './activities'
import type { MetricInput } from './metrics'

export const ONBOARDING_DISMISS_KEY = 'resuming-onboarding-dismissed'
export const INSTALL_DISMISS_KEY = 'resuming-install-dismissed'

export interface ActivityTemplate {
  id: string
  label: string
  blurb: string
  input: ActivityInput
}

export interface MetricTemplate {
  id: string
  label: string
  blurb: string
  input: MetricInput
}

/** Spec §16 — common starter cases. */
export function getStarterActivityTemplates(
  today = todayLocalDate(),
): ActivityTemplate[] {
  return [
    {
      id: 'reading',
      label: 'Reading',
      blurb: 'Daily timer · 10 minutes',
      input: {
        name: 'Reading',
        emoji: '📖',
        type: 'daily',
        trackingMode: 'timer',
        targetValue: 10,
        targetUnit: 'minutes',
        weeklyTarget: null,
        deadline: null,
      },
    },
    {
      id: 'walk',
      label: 'Walk',
      blurb: 'Daily timer · 20 minutes',
      input: {
        name: 'Walk',
        emoji: '🚶',
        type: 'daily',
        trackingMode: 'timer',
        targetValue: 20,
        targetUnit: 'minutes',
        weeklyTarget: null,
        deadline: null,
      },
    },
    {
      id: 'run',
      label: 'Run',
      blurb: 'Weekly · 2× per week',
      input: {
        name: 'Run',
        emoji: '🏃',
        type: 'weekly_n',
        trackingMode: 'count',
        targetValue: 1,
        targetUnit: null,
        weeklyTarget: 2,
        deadline: null,
      },
    },
    {
      id: 'gym',
      label: 'Gym',
      blurb: 'Weekly · 2× per week',
      input: {
        name: 'Gym',
        emoji: '🏋️',
        type: 'weekly_n',
        trackingMode: 'count',
        targetValue: 1,
        targetUnit: null,
        weeklyTarget: 2,
        deadline: null,
      },
    },
    {
      id: 'meditation',
      label: 'Meditation',
      blurb: 'Daily timer · 5 minutes',
      input: {
        name: 'Meditation',
        emoji: '🧘',
        type: 'daily',
        trackingMode: 'timer',
        targetValue: 5,
        targetUnit: 'minutes',
        weeklyTarget: null,
        deadline: null,
      },
    },
    {
      id: 'taxes',
      label: 'File taxes',
      blurb: `Deadline · due ${addDays(today, 30)}`,
      input: {
        name: 'File taxes',
        emoji: '🧾',
        type: 'deadline',
        trackingMode: 'checkbox',
        targetValue: null,
        targetUnit: null,
        weeklyTarget: null,
        deadline: addDays(today, 30),
      },
    },
  ]
}

export function getStarterMetricTemplates(): MetricTemplate[] {
  return [
    {
      id: 'weight',
      label: 'Weight',
      blurb: 'Daily number · lbs',
      input: {
        name: 'Weight',
        emoji: '⚖️',
        unit: 'lbs',
      },
    },
  ]
}

export function needsOnboarding(
  activeActivityCount: number,
  dismissed: boolean,
): boolean {
  return activeActivityCount === 0 && !dismissed
}

export function readDismissedFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

export function writeDismissedFlag(key: string, value: boolean): void {
  try {
    if (value) localStorage.setItem(key, '1')
    else localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

/** True when running as installed PWA / home-screen app. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false
  const mq = window.matchMedia?.('(display-mode: standalone)')?.matches
  const iosStandalone =
    'standalone' in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  return Boolean(mq || iosStandalone)
}

/** Rough iOS Safari detection for Add to Home Screen tip. */
export function isLikelyIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const webkit = /WebKit/.test(ua)
  const chromeLike = /CriOS|FxiOS|EdgiOS/.test(ua)
  return iOS && webkit && !chromeLike
}

export function shouldShowInstallTip(params: {
  dismissed: boolean
  standalone: boolean
  iosSafari: boolean
}): boolean {
  return !params.dismissed && !params.standalone && params.iosSafari
}
