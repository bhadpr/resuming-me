import { useEffect, useRef, useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import { parseLocalDate } from '../lib/dates'
import {
  communityTitle,
  COMMUNITY_LIST_MAX,
  festivalOf,
  listCommunityReminders,
  type CommunityReminder,
} from '../lib/communityReminders'
import { communityPhotoUrl } from '../lib/eventPhotoUrl'
import { localeTag, type Locale } from '../lib/i18n'
import { formatReminderDay } from '../lib/reminderSchedule'
import { ReminderKindMark } from './ReminderKindIcon'

/** Clay pictures, the same kind as Halloween, Thanksgiving, and Christmas. */
const FESTIVAL_ART: Record<string, string> = {
  halloween: '/community/halloween.jpg',
  thanksgiving: '/community/thanksgiving.jpg',
  christmas: '/community/christmas.jpg',
  election: '/community/election.jpg',
  veteran: '/community/veteran.jpg',
  newyear: '/community/newyear.jpg',
  mlk: '/community/mlk.jpg',
  presidents: '/community/presidents.jpg',
  memorial: '/community/memorial.jpg',
  juneteenth: '/community/juneteenth.jpg',
  independence: '/community/independence.jpg',
  labor: '/community/labor.jpg',
  columbus: '/community/columbus.jpg',
  diwali: '/community/diwali.jpg',
  vijaya: '/community/vijaya.jpg',
  nanak: '/community/nanak.jpg',
  republic: '/community/republic.jpg',
  holi: '/community/holi.jpg',
  fitr: '/community/fitr.jpg',
  ramnavami: '/community/ramnavami.jpg',
  mahavir: '/community/mahavir.jpg',
  goodfriday: '/community/goodfriday.jpg',
  buddha: '/community/buddha.jpg',
  adha: '/community/adha.jpg',
  muharram: '/community/muharram.jpg',
  'in-independence': '/community/in-independence.jpg',
  milad: '/community/milad.jpg',
  janmashtami: '/community/janmashtami.jpg',
  gandhi: '/community/gandhi.jpg',
}

export { holidayArtUrl } from '../lib/communityReminders'

function shortDay(day: string, locale: Locale): string {
  return parseLocalDate(day).toLocaleDateString(localeTag(locale), { day: 'numeric', month: 'short', year: '2-digit' })
}

/** The clay picture for this day, then an uploaded photo, then the kind's picture. */
function CardPicture({
  photo,
  kind,
  festival,
}: {
  photo: string | null
  kind: CommunityReminder['kind']
  festival: string | null
}) {
  const art = festival ? FESTIVAL_ART[festival] : null
  const [artFailed, setArtFailed] = useState(false)
  const [photoFailed, setPhotoFailed] = useState(false)
  const src = art && !artFailed ? art : photo && !photoFailed ? photo : null
  if (!src) return <ReminderKindMark kind={kind} />
  return (
    <img
      className="community-photo"
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      onError={() => {
        if (art && !artFailed) setArtFailed(true)
        else setPhotoFailed(true)
      }}
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
  include,
  limit = COMMUNITY_LIST_MAX,
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
  /** Keeps this section to one region and year. */
  include?: (item: CommunityReminder) => boolean
  /** How many upcoming days to load. The setup list stays short. */
  limit?: number
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
    listCommunityReminders(today, limit)
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
  }, [today, limit])

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
  const visible = items?.filter((item) => (include ? include(item) : true) && !added.has(item.id)) ?? null

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
            const festival = festivalOf(item)
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
                    <CardPicture photo={photo} kind={item.kind} festival={festival} />
                  </span>
                  <span className="community-name">{name}</span>
                  <span className="community-day">{expanded ? shortDay(item.day, locale) : formatReminderDay(item.day, today, locale)}</span>
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
