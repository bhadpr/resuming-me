import { useEffect, useState } from 'react'
import { formatReminderDay, REMINDER_TEXT_MAX } from '../lib/reminderSchedule'
import { todayLocalDate } from '../lib/dates'
import { listPhotoUrl } from '../lib/eventPhotoUrl'
import { compressEventPhoto } from '../lib/eventPhotos'
import { EventPhoto } from './ReminderKindIcon'
import {
  createSharedList,
  emptySharedListItem,
  listSharedListsForAdmin,
  setSharedListOff,
  setSharedListPhoto,
  SHARED_LIST_MAX_ITEMS,
  SHARED_LIST_TITLE_MAX,
  sharedListFormIssue,
  sharedListItemsFromCsv,
  sharedListStatsForAdmin,
  sharedListUrl,
  type SharedList,
  type SharedListAdminStats,
  type SharedListItemDraft,
} from '../lib/sharedLists'

const ISSUE_TEXT = {
  title: 'Give the list a title, up to 80 characters.',
  links: 'Titles and reminders cannot contain a web link.',
  empty: 'Add at least one reminder.',
  tooMany: `A list can hold ${SHARED_LIST_MAX_ITEMS} reminders.`,
  item: 'Each reminder needs a name and a real date. A time is optional.',
} as const

function acceptedLabel(count: number): string {
  if (count === 1) return '1 person accepted'
  return `${count} people accepted`
}

function timeLabel(hour: number | null, minute: number | null): string {
  if (hour == null || minute == null) return 'Any time'
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

export function AdminSharedListsScreen() {
  const today = todayLocalDate()
  const [rows, setRows] = useState<SharedList[]>([])
  const [stats, setStats] = useState<Record<string, SharedListAdminStats>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    listSharedListsForAdmin()
      .then(async (data) => {
        if (!mounted) return
        setRows(data)
        const counts = await sharedListStatsForAdmin().catch(() => ({}))
        if (mounted) setStats(counts)
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : 'Could not load reminder lists')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  async function copyLink(list: SharedList) {
    const url = sharedListUrl(list.code)
    try {
      await navigator.clipboard.writeText(url)
      setCopiedId(list.id)
    } catch {
      setError(url)
    }
  }

  async function toggle(list: SharedList) {
    setBusyId(list.id)
    setError(null)
    try {
      const off = list.status === 'active'
      await setSharedListOff(list.id, off)
      setRows((current) =>
        current.map((row) => (row.id === list.id ? { ...row, status: off ? 'off' : 'active' } : row)),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change that list')
    } finally {
      setBusyId(null)
    }
  }

  if (creating) {
    return (
      <ListForm
        onCancel={() => setCreating(false)}
        onSaved={(list) => {
          setRows((current) => [list, ...current])
          setCreating(false)
        }}
      />
    )
  }

  return (
    <div className="analytics-screen">
      <h2 className="screen-heading">Reminder lists</h2>
      <p className="screen-sub">
        One link holds many reminders. People who open it can accept them. Only you can make a list.
      </p>
      <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
        New list
      </button>
      {error && <p className="error">{error}</p>}
      {loading ? (
        <p className="muted-center">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="muted-center">No lists yet.</p>
      ) : (
        <ul className="admin-feedback-list">
          {rows.map((list) => (
            <li key={list.id} className="admin-feedback-card">
              <div className="admin-feedback-head">
                <strong>{list.title}</strong>
                <span className="analytics-stat-hint">{list.status === 'off' ? 'Off' : 'On'}</span>
              </div>
              <p className="analytics-stat-hint">
                {list.items.length} reminder{list.items.length === 1 ? '' : 's'} · {acceptedLabel(stats[list.id]?.accepts ?? 0)} · {sharedListUrl(list.code)}
              </p>
              <ListPhoto
                list={list}
                onChanged={(photoPath) =>
                  setRows((current) => current.map((row) => (row.id === list.id ? { ...row, photoPath } : row)))
                }
              />
              {(stats[list.id]?.reports.total ?? 0) > 0 && (
                <p className="analytics-stat-hint">
                  {stats[list.id].reports.total} {stats[list.id].reports.total === 1 ? 'report' : 'reports'} · spam{' '}
                  {stats[list.id].reports.spam} · wrong or harmful {stats[list.id].reports.harmful} · other{' '}
                  {stats[list.id].reports.other}
                </p>
              )}
              <ul>
                {list.items.map((item) => (
                  <li key={item.id}>
                    {item.text} · {formatReminderDay(item.day, today, 'en')} · {timeLabel(item.hour, item.minute)}
                  </li>
                ))}
              </ul>
              <div className="community-admin-actions">
                <button type="button" className="btn btn-secondary" onClick={() => void copyLink(list)}>
                  {copiedId === list.id ? 'Copied' : 'Copy link'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={busyId === list.id}
                  onClick={() => void toggle(list)}
                >
                  {list.status === 'off' ? 'Turn on' : 'Switch off'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ListForm({ onCancel, onSaved }: { onCancel: () => void; onSaved: (list: SharedList) => void }) {
  const [title, setTitle] = useState('')
  const [items, setItems] = useState<SharedListItemDraft[]>([emptySharedListItem()])
  const [photo, setPhoto] = useState<Blob | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [imported, setImported] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    return () => {
      if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview)
    }
  }, [photoPreview])

  function update(index: number, patch: Partial<SharedListItemDraft>) {
    setItems((current) => current.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  function importCsv(file: File) {
    void file.text().then((text) => {
      const result = sharedListItemsFromCsv(text)
      if (!result.ok) {
        setError(result.error)
        return
      }
      const kept = items.filter((item) => item.text.trim() || item.day || item.time)
      const next = [...kept, ...result.items]
      if (next.length > SHARED_LIST_MAX_ITEMS) {
        setError(`A list can hold ${SHARED_LIST_MAX_ITEMS} reminders.`)
        return
      }
      setItems(next)
      setImported(result.items.length)
      setError(null)
    })
  }

  async function submit() {
    const issue = sharedListFormIssue({ title, items })
    if (issue) {
      setError(ISSUE_TEXT[issue])
      return
    }
    setSaving(true)
    setError(null)
    try {
      onSaved(await createSharedList({ title, items }, photo))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that list')
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
      <h2 className="screen-heading">New reminder list</h2>
      <label className="field">
        <span className="field-label">Title</span>
        <input
          className="field-input"
          value={title}
          maxLength={SHARED_LIST_TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <div className="field">
        <span className="field-label">School image</span>
        {photoPreview ? (
          <div className="event-photo event-photo-thumb">
            <img src={photoPreview} alt="" />
          </div>
        ) : (
          <p className="analytics-stat-hint">One picture for the whole list. Optional.</p>
        )}
        <div className="community-admin-actions">
          <label className="btn btn-secondary medicine-photo-pick">
            {photoPreview ? 'Change image' : 'Add image'}
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (!file) return
                void compressEventPhoto(file, 640)
                  .then((blob) => {
                    setPhoto(blob)
                    setPhotoPreview(URL.createObjectURL(blob))
                    setError(null)
                  })
                  .catch((err) => setError(err instanceof Error ? err.message : 'Could not read that picture'))
              }}
            />
          </label>
          {photoPreview && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setPhoto(null)
                setPhotoPreview(null)
              }}
            >
              Remove image
            </button>
          )}
        </div>
      </div>
      <div className="field">
        <span className="field-label">Spreadsheet</span>
        <label className="btn btn-secondary medicine-photo-pick">
          Import CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              if (file) importCsv(file)
            }}
          />
        </label>
        <span className="analytics-stat-hint">
          {imported == null
            ? 'One row per day: name, date, and an optional time. 11/25/2026 or 2026-11-25.'
            : `Added ${imported} reminder${imported === 1 ? '' : 's'}. Check the rows, then save.`}
        </span>
      </div>
      {items.map((item, index) => (
        <fieldset key={index} className="field">
          <legend className="field-label">Reminder {index + 1}</legend>
          <label className="field">
            <span className="field-label">Name</span>
            <input
              className="field-input"
              value={item.text}
              maxLength={REMINDER_TEXT_MAX}
              placeholder="Winter break"
              onChange={(event) => update(index, { text: event.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Date</span>
            <input
              className="field-input"
              type="date"
              value={item.day}
              onChange={(event) => update(index, { day: event.target.value })}
            />
          </label>
          <label className="field">
            <span className="field-label">Time, optional</span>
            <input
              className="field-input"
              type="time"
              value={item.time}
              onChange={(event) => update(index, { time: event.target.value })}
            />
          </label>
          {items.length > 1 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setItems((current) => current.filter((_, i) => i !== index))}
            >
              Remove
            </button>
          )}
        </fieldset>
      ))}
      {items.length < SHARED_LIST_MAX_ITEMS && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setItems((current) => [...current, emptySharedListItem()])}
        >
          Add another
        </button>
      )}
      {error && <p className="error">{error}</p>}
      <div className="community-admin-actions">
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save and make the link'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  )
}

function ListPhoto({ list, onChanged }: { list: SharedList; onChanged: (photoPath: string) => void }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    if (!file) return
    setBusy(true)
    setError(null)
    try {
      const blob = await compressEventPhoto(file, 640)
      onChanged(await setSharedListPhoto(list.id, blob, list.photoPath))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that picture')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="field">
      <EventPhoto src={listPhotoUrl(list.photoPath)} alt="" className="event-photo-thumb" />
      <label className="btn btn-ghost">
        {busy ? 'Saving picture…' : list.photoPath ? 'Change school image' : 'Add school image'}
        <input
          type="file"
          accept="image/*"
          hidden
          disabled={busy}
          onChange={(event) => {
            const file = event.target.files?.[0]
            event.target.value = ''
            void pick(file)
          }}
        />
      </label>
      {error && <p className="error">{error}</p>}
    </div>
  )
}
