import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { useLocale } from '../hooks/useLocale'
import { canSharePhoto, copyPhotoToClipboard, sharePhotoWithText } from '../lib/sharePhoto'
import type { Reminder, ReminderInput, SharedReminderStatus } from '../lib/reminderSchedule'
import {
  SHARED_FROM_MAX,
  SharedEventError,
  cancelSharedEvent,
  cleanFromLine,
  createSharedEvent,
  hasWebLink,
  isShareableReminder,
  ownedSharedEvent,
  replacementReminder,
  resetSharedEventLink,
  setSharedEventTakingAdds,
  sharedEventMessage,
  whatsAppShareUrl,
  type OwnedSharedEvent,
  type SharedEventIssue,
} from '../lib/sharedEvents'
import { track } from '../lib/track'
import { Icon } from './Icon'

interface ShareReminderProps {
  reminder: Reminder
  userId: string
  today: string
  onShared: (eventId: string) => void
  onStatus: (status: SharedReminderStatus) => void
  /** Cancel and make a new one: drop this reminder and open a new one with the same details. */
  onReplace: (input: ReminderInput) => Promise<void>
  /** Opened from Share on the reminder list: bring this section into view. */
  focus?: boolean
}

type Confirm = 'reset' | 'cancel' | null

/** The first share swaps the editor for the shared view, so a note for the person rides across here. */
const carriedNotices = new Map<string, string>()

function issueKey(issue: SharedEventIssue): string {
  if (issue === 'links') return 'sharedEvent.noLinks'
  if (issue === 'dailyCap') return 'sharedEvent.dailyCap'
  if (issue === 'pastDay') return 'sharedEvent.pastDay'
  return 'sharedEvent.shareFailed'
}

/** Sends to WhatsApp, or the browser's tab when a pop-up blocker stops the new one. */
function openUrl(url: string, pending: Window | null): void {
  if (pending) {
    pending.opener = null
    pending.location.href = url
    return
  }
  if (!window.open(url, '_blank')) window.location.href = url
}

/** Share on WhatsApp, and manage the organizer's own shared event. Followers' copies show nothing. */
export function ShareReminder({ reminder, userId, today, onShared, onStatus, onReplace, focus = false }: ShareReminderProps) {
  const { locale, t } = useLocale()
  const eventId = reminder.sharedEventId ?? null
  const [owned, setOwned] = useState<OwnedSharedEvent | null>(null)
  const [checking, setChecking] = useState(Boolean(eventId))
  const [from, setFrom] = useState('')
  const [busy, setBusy] = useState(false)
  const [issue, setIssue] = useState<SharedEventIssue | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [notice, setNotice] = useState<string | null>(() => carriedNotices.get(reminder.id) ?? null)
  const [photo, setPhoto] = useState<File | null>(null)
  /** Before the first share: the From line, photo, and lock warning show after one tap. */
  const [setup, setSetup] = useState(focus)
  /** The organizer's Stop new adds, Reset link, and Cancel, folded away until asked for. */
  const [manage, setManage] = useState(false)
  const section = useRef<HTMLElement>(null)
  const scrolled = useRef(false)

  useEffect(() => {
    carriedNotices.delete(reminder.id)
  }, [reminder.id])

  useEffect(() => {
    if (!eventId || owned?.id === eventId) {
      setChecking(false)
      return
    }
    let live = true
    setChecking(true)
    ownedSharedEvent(eventId)
      .then((event) => {
        if (live) setOwned(event)
      })
      .catch(() => {
        if (live) setOwned(null)
      })
      .finally(() => {
        if (live) setChecking(false)
      })
    return () => {
      live = false
    }
  }, [eventId, owned?.id])

  useEffect(() => {
    if (!focus || checking || scrolled.current || !section.current) return
    scrolled.current = true
    section.current.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [focus, checking])

  if (checking) return null
  if (eventId && !owned) return null
  const open = isShareableReminder(reminder, today)
  if (!owned && !open) return null

  async function share() {
    setIssue(null)
    setNotice(null)
    const fromLine = owned ? owned.from : cleanFromLine(from)
    if (!owned && (hasWebLink(reminder.text) || hasWebLink(fromLine))) {
      setIssue('links')
      return
    }
    const withPhoto = photo != null && canSharePhoto(photo)
    const copied = photo != null && !withPhoto ? await copyPhotoToClipboard(photo) : false
    const pending = withPhoto || owned || Capacitor.isNativePlatform() ? null : window.open('', '_blank')
    setBusy(true)
    try {
      let event = owned
      if (!event) {
        const made = await createSharedEvent(userId, reminder, fromLine)
        event = { id: made.id, code: made.code, from: fromLine, status: 'active', takingAdds: true, followers: 0 }
        setOwned(event)
        track('shared_event_created', {
          has_from: fromLine != null,
          has_time: reminder.hour != null,
          kind: reminder.kind,
        })
      }
      const message = sharedEventMessage(
        {
          code: event.code,
          text: reminder.text,
          from: event.from,
          day: reminder.day,
          hour: reminder.hour,
          minute: reminder.minute,
        },
        locale,
      )
      if (withPhoto) {
        const result = await sharePhotoWithText(photo, message)
        if (result === 'needsTap') {
          setNotice(t('sharedEvent.photoTapAgain'))
          return
        }
        if (result === 'shared') track('shared_event_shared', { first: !owned, photo: true })
      } else {
        if (photo) {
          const note = t(copied ? 'sharedEvent.photoCopied' : 'sharedEvent.photoNotHere')
          setNotice(note)
          if (!reminder.sharedEventId) carriedNotices.set(reminder.id, note)
        }
        openUrl(whatsAppShareUrl(message), pending)
        track('shared_event_shared', { first: !owned, photo: false, photo_copied: copied })
      }
      if (!reminder.sharedEventId) onShared(event.id)
    } catch (err) {
      pending?.close()
      setIssue(err instanceof SharedEventError ? err.issue : 'failed')
    } finally {
      setBusy(false)
    }
  }

  async function act(work: (event: OwnedSharedEvent) => Promise<Partial<OwnedSharedEvent> | void>) {
    if (!owned) return
    setIssue(null)
    setNotice(null)
    setBusy(true)
    try {
      const patch = await work(owned)
      if (patch) setOwned({ ...owned, ...patch })
      setConfirm(null)
    } catch (err) {
      setNotice(
        t(err instanceof SharedEventError && err.issue === 'dailyCap' ? 'sharedEvent.dailyCap' : 'sharedEvent.manageFailed'),
      )
    } finally {
      setBusy(false)
    }
  }

  if (owned) {
    if (owned.status !== 'active') {
      return (
        <section ref={section} className="share-event share-card" aria-label={t('sharedEvent.share')}>
          <p className="share-event-note">
            {t(owned.status === 'cancelled' ? 'sharedEvent.youCancelled' : 'sharedEvent.switchedOffLine')}
          </p>
        </section>
      )
    }
    const count =
      owned.followers === 0
        ? t('sharedEvent.addedNone')
        : owned.followers === 1
          ? t('sharedEvent.addedOne')
          : t('sharedEvent.addedMany', { count: owned.followers })
    return (
      <section ref={section} className="share-event share-card" aria-label={t('sharedEvent.share')}>
        <p className="share-event-count">{count}</p>
        {!owned.takingAdds && <p className="share-event-note">{t('sharedEvent.addsStopped')}</p>}
        {notice && (
          <p className="share-event-notice" role="status">
            {notice}
          </p>
        )}
        {issue && <p className="error">{t(issueKey(issue))}</p>}
        {open && (
          <>
            <PhotoPicker photo={photo} disabled={busy} onChange={setPhoto} />
            <button
              type="button"
              className="btn btn-primary share-event-btn"
              disabled={busy}
              onClick={() => void share()}
            >
              {busy ? t('sharedEvent.sharing') : t('sharedEvent.share')}
            </button>

            <button
              type="button"
              className="share-event-more"
              aria-expanded={manage}
              onClick={() => {
                setManage((shown) => !shown)
                setConfirm(null)
              }}
            >
              {t('sharedEvent.linkOptions')}
              <Icon name="chevron" className="icon share-event-more-icon" />
            </button>
          </>
        )}
        {open && manage && (
          <div className="share-event-manage">
            <p className="share-event-note">{t('sharedEvent.organizerLocked')}</p>
            {confirm === null && (
              <div className="share-event-actions">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() =>
                    void act(async (event) => {
                      await setSharedEventTakingAdds(event.id, !event.takingAdds)
                      return { takingAdds: !event.takingAdds }
                    })
                  }
                >
                  {owned.takingAdds ? t('sharedEvent.stopAdds') : t('sharedEvent.allowAdds')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirm('reset')}>
                  {t('sharedEvent.resetLink')}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirm('cancel')}>
                  {t('sharedEvent.cancelReminder')}
                </button>
              </div>
            )}

            {confirm === 'reset' && (
              <div className="share-event-confirm">
                <p>{t('sharedEvent.resetConfirm')}</p>
                <div className="share-event-actions">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setConfirm(null)}>
                    {t('sharedEvent.keep')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void act(async (event) => {
                        const code = await resetSharedEventLink(event.id)
                        setNotice(t('sharedEvent.resetDone'))
                        track('shared_event_reset')
                        return { code }
                      })
                    }
                  >
                    {t('sharedEvent.resetLink')}
                  </button>
                </div>
              </div>
            )}

            {confirm === 'cancel' && (
              <div className="share-event-confirm">
                <p>{t('sharedEvent.cancelConfirm')}</p>
                <div className="share-event-actions">
                  <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setConfirm(null)}>
                    {t('sharedEvent.keep')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void act(async (event) => {
                        await cancelSharedEvent(event.id)
                        track('shared_event_cancelled', { replaced: false })
                        onStatus('cancelled')
                        return { status: 'cancelled' }
                      })
                    }
                  >
                    {t('sharedEvent.cancelYes')}
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() =>
                      void act(async (event) => {
                        await cancelSharedEvent(event.id)
                        track('shared_event_cancelled', { replaced: true })
                        await onReplace(replacementReminder(reminder))
                      })
                    }
                  >
                    {t('sharedEvent.cancelAndNew')}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    )
  }

  return (
    <section ref={section} className="share-event share-card" aria-label={t('sharedEvent.share')}>
      <h3 className="share-event-title">{t('sharedEvent.inviteTitle')}</h3>
      <p className="share-event-note">{t('sharedEvent.inviteBody')}</p>
      {!setup ? (
        <button type="button" className="btn btn-secondary share-event-btn" onClick={() => setSetup(true)}>
          <Icon name="share" />
          {t('sharedEvent.share')}
        </button>
      ) : (
        <>
          <label className="field">
            <span className="share-event-label">{t('sharedEvent.fromLabel')}</span>
            <input
              className="field-input"
              value={from}
              maxLength={SHARED_FROM_MAX}
              placeholder={t('sharedEvent.fromPlaceholder')}
              onChange={(event) => {
                setFrom(event.target.value)
                if (issue === 'links') setIssue(null)
              }}
            />
          </label>
          <PhotoPicker photo={photo} disabled={busy} onChange={setPhoto} />
          <p className="share-event-warn">
            <Icon name="lock" />
            <span>
              {t('sharedEvent.anyoneCanSee')} {t('sharedEvent.lockWarning')}
            </span>
          </p>
          {issue && <p className="error">{t(issueKey(issue))}</p>}
          <button type="button" className="btn btn-primary share-event-btn" disabled={busy} onClick={() => void share()}>
            {busy ? t('sharedEvent.sharing') : t('sharedEvent.share')}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={busy}
            onClick={() => {
              setSetup(false)
              setIssue(null)
            }}
          >
            {t('sharedEvent.notNow')}
          </button>
        </>
      )}
    </section>
  )
}

interface PhotoPickerProps {
  photo: File | null
  disabled: boolean
  onChange: (photo: File | null) => void
}

/** An optional photo, such as an invitation card. It goes only to WhatsApp, never to Resuming. */
function PhotoPicker({ photo, disabled, onChange }: PhotoPickerProps) {
  const { t } = useLocale()
  const input = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)

  useEffect(() => {
    if (!photo) {
      setPreview(null)
      return
    }
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

  return (
    <div className="share-photo">
      <input
        ref={input}
        className="share-photo-input"
        type="file"
        accept="image/*"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file && file.type.startsWith('image/')) onChange(file)
          event.target.value = ''
        }}
      />
      {photo && preview ? (
        <div className="share-photo-chosen">
          <img className="share-photo-thumb" src={preview} alt={t('sharedEvent.photoAlt')} />
          <div className="share-photo-actions">
            <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => input.current?.click()}>
              {t('sharedEvent.changePhoto')}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={disabled} onClick={() => onChange(null)}>
              {t('sharedEvent.removePhoto')}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="btn btn-ghost btn-sm share-photo-add"
          disabled={disabled}
          onClick={() => input.current?.click()}
        >
          <Icon name="photo" />
          {t('sharedEvent.addPhoto')}
        </button>
      )}
      <p className="share-event-note">{t('sharedEvent.photoNote')}</p>
    </div>
  )
}
