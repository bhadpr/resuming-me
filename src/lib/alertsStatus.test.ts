import { describe, expect, it } from 'vitest'
import { alertsStatusProps, exactAlarmState, notificationPermission, shouldReportAlertsStatus } from './alertsStatus'

describe('notificationPermission', () => {
  it('maps what Android answers', () => {
    expect(notificationPermission('granted')).toBe('granted')
    expect(notificationPermission('denied')).toBe('denied')
    expect(notificationPermission('prompt')).toBe('prompt')
    expect(notificationPermission('prompt-with-rationale')).toBe('prompt')
    expect(notificationPermission(undefined)).toBe('prompt')
  })
})

describe('exactAlarmState', () => {
  it('maps the Alarms & reminders setting', () => {
    expect(exactAlarmState('granted')).toBe('granted')
    expect(exactAlarmState('denied')).toBe('denied')
    expect(exactAlarmState('prompt')).toBe('denied')
    expect(exactAlarmState(undefined)).toBe('unknown')
    expect(exactAlarmState(null)).toBe('unknown')
  })
})

describe('alertsStatusProps', () => {
  it('sends the two answers and how many alerts are planned, never more than 64', () => {
    expect(alertsStatusProps('granted', 'denied', 3)).toEqual({ notifications: 'granted', exact_alarms: 'denied', planned: 3 })
    expect(alertsStatusProps('denied', 'unknown', 500).planned).toBe(64)
    expect(alertsStatusProps('denied', 'unknown', -2).planned).toBe(0)
  })
})

describe('shouldReportAlertsStatus', () => {
  it('reports once a day, and again at once when the answer changes', () => {
    expect(shouldReportAlertsStatus(null, '2026-10-17', 'granted|granted')).toBe(true)
    expect(shouldReportAlertsStatus('2026-10-17|granted|granted', '2026-10-17', 'granted|granted')).toBe(false)
    expect(shouldReportAlertsStatus('2026-10-17|granted|granted', '2026-10-17', 'denied|granted')).toBe(true)
    expect(shouldReportAlertsStatus('2026-10-16|granted|granted', '2026-10-17', 'granted|granted')).toBe(true)
  })
})
