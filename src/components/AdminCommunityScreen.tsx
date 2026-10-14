import { useEffect, useState } from 'react'
import {
  communityFormIssue,
  communityTitle,
  deleteCommunityReminder,
  listCommunityRemindersForAdmin,
  saveCommunityReminder,
  type CommunityForm,
  type CommunityReminder,
} from '../lib/communityReminders'
import { todayLocalDate } from '../lib/dates'
import { communityPhotoUrl } from '../lib/eventPhotoUrl'
import { compressEventPhoto } from '../lib/eventPhotos'
import { LOCALES, type Locale } from '../lib/i18n'
import { REMINDER_TEXT_MAX, formatReminderDay } from '../lib/reminderSchedule'
import { ReminderKindMark } from './ReminderKindIcon'

/** A few more than this on at once and the onboarding screen gets long. */
const SUGGESTED_MAX_ON = 7
/** Cards are small, so the picture does not need to be large. */
const PHOTO_SIDE = 640

const LANGUAGE_NAME: Record<Locale, string> = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  gu: 'Gujarati',
  mr: 'Marathi',
  ta: 'Tamil',
  bn: 'Bengali',
}

function emptyForm(): CommunityForm {
  return { titles: {}, day: '', remindBefore: true, remindWeekBefore: false, active: true, photoPath: null }
}

function formFrom(item: CommunityReminder): CommunityForm {
  return {
    id: item.id,
    titles: { ...item.titles },
    day: item.day,
    remindBefore: item.remindBefore,
    remindWeekBefore: item.remindWeekBefore,
    active: item.active,
    photoPath: item.photoPath,
  }
}

export function AdminCommunityScreen() {
  const today = todayLocalDate()
  const [rows, setRows] = useState<CommunityReminder[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [form, setForm] = useState<CommunityForm | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listCommunityRemindersForAdmin()
      .then((data) => {
        if (mounted) setRows(data)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Could not load community reminders')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  function upsert(saved: CommunityReminder) {
    setRows((current) => {
      const next = current.some((item) => item.id === saved.id)
        ? current.map((item) => (item.id === saved.id ? saved : item))
        : [...current, saved]
      return next.sort((a, b) => b.day.localeCompare(a.day))
    })
  }

  async function toggleActive(item: CommunityReminder) {
    setBusyId(item.id)
    setError(null)
    try {
      upsert(await saveCommunityReminder({ ...formFrom(item), active: !item.active }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that one')
    } finally {
      setBusyId(null)
    }
  }

  async function remove(item: CommunityReminder) {
    setBusyId(item.id)
    setError(null)
    try {
      await deleteCommunityReminder(item.id)
      setRows((current) => current.filter((row) => row.id !== item.id))
      setConfirmDeleteId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete that one')
    } finally {
      setBusyId(null)
    }
  }

  const upcoming = rows.filter((item) => item.day >= today).sort((a, b) => a.day.localeCompare(b.day))
  const past = rows.filter((item) => item.day < today)
  const showing = upcoming.filter((item) => item.active).length

  function renderRow(item: CommunityReminder) {
    const photo = communityPhotoUrl(item.photoPath)
    return (
      <li key={item.id} className="admin-feedback-card">
        <div className="admin-feedback-head">
          <strong>{communityTitle(item, 'en')}</strong>
          <span className="analytics-stat-hint">{formatReminderDay(item.day, today, 'en')}</span>
        </div>
        <div className="community-admin-thumb">
          {photo ? <img src={photo} alt="" loading="lazy" /> : <ReminderKindMark kind={item.kind} />}
        </div>
        <p className="admin-feedback-who">
          {item.active ? 'Showing in the app' : 'Switched off'}
          {item.remindWeekBefore ? ' · alerts a week before' : ''}
          {item.remindBefore ? ' · alerts the evening before' : ''} · {Object.keys(item.titles).length} of{' '}
          {LOCALES.length} languages
        </p>
        <div className="community-admin-actions">
          <button type="button" className="btn btn-sm btn-secondary" disabled={busyId === item.id} onClick={() => setForm(formFrom(item))}>
            Edit
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={busyId === item.id}
            onClick={() => void toggleActive(item)}
          >
            {item.active ? 'Switch off' : 'Switch on'}
          </button>
          {confirmDeleteId === item.id ? (
            <>
              <button type="button" className="btn btn-sm btn-primary" disabled={busyId === item.id} onClick={() => void remove(item)}>
                Delete for good
              </button>
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setConfirmDeleteId(null)}>
                Keep
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-sm btn-ghost" disabled={busyId === item.id} onClick={() => setConfirmDeleteId(item.id)}>
              Delete
            </button>
          )}
        </div>
      </li>
    )
  }

  if (form) {
    return (
      <CommunityEditor
        initial={form}
        onCancel={() => setForm(null)}
        onSaved={(saved) => {
          upsert(saved)
          setForm(null)
        }}
      />
    )
  }

  return (
    <div className="analytics-screen">
      <p className="screen-sub settings-lead">
        Days many people keep, such as Diwali or Christmas. Everyone sees the ones still ahead, in onboarding and
        under Reminders. Each person who picks one gets a reminder of their own. Enter the date again each year; a
        day that has passed stops showing.
      </p>

      {error && <p className="error">{error}</p>}

      <button type="button" className="btn btn-primary" onClick={() => setForm(emptyForm())}>
        Add a community reminder
      </button>

      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : (
        <>
          <section className="analytics-overview">
            <div className="analytics-stat">
              <span className="analytics-stat-label">Showing now</span>
              <span className="analytics-stat-value">{showing}</span>
              <span className="analytics-stat-hint">
                {showing > SUGGESTED_MAX_ON ? `More than ${SUGGESTED_MAX_ON}: the list gets long` : `Up to ${SUGGESTED_MAX_ON} works well`}
              </span>
            </div>
          </section>

          <h3 className="section-label">Ahead</h3>
          {upcoming.length === 0 ? (
            <p className="muted-center">Nothing ahead. People see no community days.</p>
          ) : (
            <ul className="admin-feedback-list">{upcoming.map(renderRow)}</ul>
          )}

          {past.length > 0 && (
            <>
              <h3 className="section-label">Passed</h3>
              <ul className="admin-feedback-list">{past.map(renderRow)}</ul>
            </>
          )}
        </>
      )}
    </div>
  )
}

function CommunityEditor({
  initial,
  onCancel,
  onSaved,
}: {
  initial: CommunityForm
  onCancel: () => void
  onSaved: (saved: CommunityReminder) => void
}) {
  const [form, setForm] = useState<CommunityForm>(initial)
  const [photoPreview, setPhotoPreview] = useState<string | null>(communityPhotoUrl(initial.photoPath))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  function setTitle(locale: Locale, value: string) {
    setForm((current) => ({ ...current, titles: { ...current.titles, [locale]: value } }))
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return
    setError(null)
    try {
      const blob = await compressEventPhoto(file, PHOTO_SIDE)
      setForm((current) => ({ ...current, newPhoto: blob, removePhoto: false }))
      setPhotoPreview(URL.createObjectURL(blob))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not read that photo')
    }
  }

  async function submit() {
    const issue = communityFormIssue(form)
    if (issue) {
      setError(issue.field === 'title' ? 'Write the English title (up to 120 characters).' : 'Pick the date.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await saveCommunityReminder(form))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save')
      setSaving(false)
    }
  }

  return (
    <form
      className="analytics-screen"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <h2 className="screen-heading">{form.id ? 'Edit community reminder' : 'New community reminder'}</h2>

      <label className="field">
        <span className="field-label">Title in English (required)</span>
        <input
          className="field-input"
          value={form.titles.en ?? ''}
          maxLength={REMINDER_TEXT_MAX}
          onChange={(event) => setTitle('en', event.target.value)}
        />
      </label>

      <details>
        <summary>Other languages (a missing one shows English)</summary>
        {LOCALES.filter((locale) => locale !== 'en').map((locale) => (
          <label key={locale} className="field">
            <span className="field-label">{LANGUAGE_NAME[locale]}</span>
            <input
              className="field-input"
              lang={locale}
              value={form.titles[locale] ?? ''}
              maxLength={REMINDER_TEXT_MAX}
              onChange={(event) => setTitle(locale, event.target.value)}
            />
          </label>
        ))}
      </details>

      <label className="field">
        <span className="field-label">Date this year</span>
        <input
          className="field-input"
          type="date"
          value={form.day}
          onChange={(event) => setForm((current) => ({ ...current, day: event.target.value }))}
        />
      </label>

      <label className="reminder-switch">
        <input
          type="checkbox"
          checked={form.remindBefore}
          onChange={(event) => setForm((current) => ({ ...current, remindBefore: event.target.checked }))}
        />
        <span>Also alert the evening before</span>
      </label>

      <label className="reminder-switch">
        <input
          type="checkbox"
          checked={form.remindWeekBefore}
          onChange={(event) => setForm((current) => ({ ...current, remindWeekBefore: event.target.checked }))}
        />
        <span>Also alert a week before</span>
      </label>

      <label className="reminder-switch">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))}
        />
        <span>Show in the app</span>
      </label>

      <div className="field">
        <span className="field-label">Picture</span>
        {photoPreview && !form.removePhoto ? (
          <div className="community-admin-thumb community-admin-thumb-large">
            <img src={photoPreview} alt="" />
          </div>
        ) : (
          <p className="activity-desc">No picture. The reminder icon shows instead.</p>
        )}
        <input type="file" accept="image/*" onChange={(event) => void pickPhoto(event.target.files?.[0])} />
        {(photoPreview || form.photoPath) && !form.removePhoto && (
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              setForm((current) => ({ ...current, newPhoto: null, removePhoto: true }))
              setPhotoPreview(null)
            }}
          >
            Remove picture
          </button>
        )}
        <p className="activity-desc">
          Square works best. It is shrunk to about {PHOTO_SIDE} pixels, so many pictures load quickly on a phone.
        </p>
      </div>

      {error && <p className="error">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
      <button type="button" className="btn btn-ghost" disabled={saving} onClick={onCancel}>
        Cancel
      </button>
    </form>
  )
}
