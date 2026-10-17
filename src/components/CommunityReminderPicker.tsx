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
  expanded = false,
  selection,
}: {
  today: string
  /** Community reminders this person already has. */
  addedIds: readonly string[]
  /** Resolves 'full' when the person has no room for another reminder. */
  onAdd?: (item: CommunityReminder) => Promise<'ok' | 'full'>
  /** Called once when there is nothing to show, so a flow can move on. */
  onEmpty?: () => void
  /** Show every card, two by two, instead of scrolling inside the list. */
  expanded?: boolean
  /** Taps choose cards. The caller saves them together. */
  selection?: {
    ids: readonly string[]
    onToggle: (item: CommunityReminder) => void
  }
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
    if (!onAdd) return
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
  const visible = items?.filter((item) => !added.has(item.id)) ?? null

  return (
    <div className={`community-picker${expanded ? ' community-picker-open' : ''}`}>
      {loadFailed ? (
        <p className="error">{t('reminders.community.error')}</p>
      ) : visible === null ? (
        <p className="muted-center">{t('reminders.loading')}</p>
      ) : visible.length === 0 ? (
        <p className="muted-center">{t('reminders.community.empty')}</p>
      ) : (
        <ul className="community-grid">
          {visible.map((item) => {
            const name = communityTitle(item, locale)
            const photo = communityPhotoUrl(item.photoPath)
            const saved = added.has(item.id)
            const picked = selection?.ids.includes(item.id) === true
            const marked = saved || picked
            return (
              <li key={item.id}>
                <button
                  type="button"
                  className={`community-card picture-pick${saved ? ' community-card-added' : ''}${picked ? ' community-card-picked' : ''}`}
                  disabled={selection ? saved : saved || busyId != null}
                  aria-pressed={marked}
                  aria-label={`${marked ? t('reminders.community.added') : t('reminders.community.add')}: ${name}`}
                  onClick={() => {
                    if (selection) {
                      if (!saved) selection.onToggle(item)
                      return
                    }
                    void add(item)
                  }}
                >
                  <span className="community-photo-frame">
                    <CardPicture photo={photo} kind={item.kind} />
                  </span>
                  <span className="community-name">{name}</span>
                  <span className="community-day">{formatReminderDay(item.day, today, locale)}</span>
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
