export const ACCOUNT_DELETED_FLAG = 'resuming-account-deleted'

const KNOWN_KEYS = [
  'resuming.activeTimer',
  'resuming.offlineSessionQueue',
  'resuming-theme',
  'resuming-onboarding-dismissed',
  'resuming-install-dismissed',
  'resuming-deadline-reminders',
  'resuming-easy-wins',
  'resuming-daily-digest',
  'resuming-visitor-id',
  'resuming-last-page-view',
  ACCOUNT_DELETED_FLAG,
]

function isResumingOrSupabaseKey(key: string): boolean {
  return (
    key.startsWith('resuming') ||
    key.startsWith('sb-') ||
    KNOWN_KEYS.includes(key)
  )
}

/** Clear local app state after account deletion (or a full local reset). */
export function clearLocalAppData(): void {
  try {
    const toRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && isResumingOrSupabaseKey(key)) toRemove.push(key)
    }
    for (const key of toRemove) localStorage.removeItem(key)
  } catch {
    // ignore quota / private mode
  }

  try {
    const toRemove: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && isResumingOrSupabaseKey(key) && key !== ACCOUNT_DELETED_FLAG) {
        toRemove.push(key)
      }
    }
    for (const key of toRemove) sessionStorage.removeItem(key)
  } catch {
    // ignore
  }

  // Best-effort: wipe IndexedDB namespaced to this app / Supabase auth.
  if (typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function') {
    void indexedDB
      .databases()
      .then((dbs) => {
        for (const db of dbs) {
          const name = db.name ?? ''
          if (/supabase|resuming|^sb-/i.test(name)) {
            indexedDB.deleteDatabase(name)
          }
        }
      })
      .catch(() => {})
  }
}

export function markAccountDeleted(): void {
  try {
    sessionStorage.setItem(ACCOUNT_DELETED_FLAG, '1')
  } catch {
    // ignore
  }
}

export function consumeAccountDeletedFlag(): boolean {
  try {
    const set = sessionStorage.getItem(ACCOUNT_DELETED_FLAG) === '1'
    if (set) sessionStorage.removeItem(ACCOUNT_DELETED_FLAG)
    return set
  } catch {
    return false
  }
}
