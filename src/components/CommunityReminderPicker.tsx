import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import {
  communityTitle,
  listCommunityReminders,
  type CommunityReminder,
} from '../lib/communityReminders'
import { communityPhotoUrl } from '../lib/eventPhotoUrl'
import { formatReminderDay } from '../lib/reminderSchedule'
import { ReminderKindMark } from './ReminderKindIcon'

/** The picture, or the kind's picture when there is none or it does not load. */
function CardPicture({ photo, kind }: { photo: string | null; kind: CommunityReminder['kind'] }) {
  const [failed, setFailed] = useState(false)
  if (!photo || failed) return <ReminderKindMark kind={kind} />
  return (
    <img
      className="community-photo"
      src={photo}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  )
}

/**
 * The community reminders still ahead, as picture cards. Add makes the person's own reminder.
 * The caller decides what adding does, because a guest and a signed-in person save differently.
 */
export function CommunityReminderPicker({
  today,
  addedIds,
  onAdd,
  onEmpty,
}: {
  today: string
  /** Community reminders this person already has. */
  addedIds: readonly string[]
  /** Resolves 'full' when the person has no room for another reminder. */
  onAdd: (item: CommunityReminder) => Promise<'ok' | 'full'>
  /** Called once when there is nothing to show, so a flow can move on. */
  onEmpty?: () => void
}) {
  const { locale, t } = useLocale()
  const [items, setItems] = useState<CommunityReminder[] | null>(null)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [addedNow, setAddedNow] = useState<string[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const emptyRef = useRef(onEmpty)
  emptyRef.current = onEmpty

  useEffect(() => {
    let mounted = true
    listCommunityReminders(today)
      .then((list) => {
        if (!mounted) return
        setItems(list)
        if (list.length === 0) emptyRef.current?.()
      })
      .catch(() => {
        if (mounted) setLoadFailed(true)
      })
    return () => {
      mounted = false
    }
  }, [today])

  async function add(item: CommunityReminder) {
    setBusyId(item.id)
    setMessage(null)
    try {
      const result = await onAdd(item)
      if (result === 'full') setMessage(t('reminders.full'))
      else setAddedNow((current) => [...current, item.id])
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not add that reminder')
    } finally {
      setBusyId(null)
    }
  }

  const added = new Set([...addedIds, ...addedNow])

  return (
    <div className="community-picker">
      {loadFailed ? (
        <p className="error">{t('reminders.community.error')}</p>
      ) : items === null ? (
        <p className="muted-center">{t('reminders.loading')}</p>
      ) : items.length === 0 ? (
        <p className="muted-center">{t('reminders.community.empty')}</p>
      ) : (
        <ul className="community-grid">
          {items.map((item) => {
            const name = communityTitle(item, locale)
            const photo = communityPhotoUrl(item.photoPath)
            const done = added.has(item.id)
            return (
              <li key={item.id} className={`community-card${done ? ' community-card-added' : ''}`}>
                <div className="community-photo-frame">
                  <CardPicture photo={photo} kind={item.kind} />
                </div>
                <span className="community-name">{name}</span>
                <span className="community-day">{formatReminderDay(item.day, today, locale)}</span>
                <button
                  type="button"
                  className={`btn btn-sm ${done ? 'btn-secondary' : 'btn-primary'}`}
                  disabled={done || busyId != null}
                  aria-label={`${done ? t('reminders.community.added') : t('reminders.community.add')}: ${name}`}
                  onClick={() => void add(item)}
                >
                  {done ? t('reminders.community.added') : t('reminders.community.add')}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      {message && <p className="error">{message}</p>}
    </div>
  )
}
