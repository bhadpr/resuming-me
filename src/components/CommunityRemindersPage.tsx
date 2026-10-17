import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLocale } from '../hooks/useLocale'
import type { CommunityReminder } from '../lib/communityReminders'
import { navigateBack } from '../lib/navigation'
import { CommunityReminderPicker } from './CommunityReminderPicker'
import { Icon } from './Icon'

/** Community days on their own page: pick several, then save them together. */
export function CommunityRemindersPage({
  today,
  addedIds,
  onAdd,
}: {
  today: string
  addedIds: readonly string[]
  onAdd: (item: CommunityReminder) => Promise<'ok' | 'full'>
}) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const [picked, setPicked] = useState<CommunityReminder[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  function toggle(item: CommunityReminder) {
    setPicked((current) =>
      current.some((one) => one.id === item.id) ? current.filter((one) => one.id !== item.id) : [...current, item],
    )
  }

  async function save() {
    if (picked.length === 0 || busy) return
    setBusy(true)
    setMessage(null)
    const saved = new Set<string>()
    try {
      for (const item of picked) {
        const result = await onAdd(item)
        if (result === 'full') {
          setMessage(t('reminders.full'))
          setPicked((current) => current.filter((one) => !saved.has(one.id)))
          return
        }
        saved.add(item.id)
      }
      navigate('/reminders', { replace: true })
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not add that reminder')
      setPicked((current) => current.filter((one) => !saved.has(one.id)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="activity-list-screen">
      <button
        type="button"
        className="btn btn-ghost btn-sm back-btn"
        onClick={() => navigateBack(navigate, '/reminders')}
      >
        <Icon name="back" />
        {t('reminders.back')}
      </button>
      <div className="screen-heading">
        <div>
          <h2>{t('reminders.community.title')}</h2>
          <p className="screen-sub">{t('reminders.community.sub')}</p>
        </div>
      </div>
      <CommunityReminderPicker
        expanded
        today={today}
        addedIds={addedIds}
        selection={{ ids: picked.map((item) => item.id), onToggle: toggle }}
      />
      {message && <p className="error">{message}</p>}
      <button type="button" className="btn btn-primary community-continue" disabled={busy || picked.length === 0} onClick={() => void save()}>
        {busy ? t('reminders.saving') : t('start.continue')}
      </button>
    </div>
  )
}
