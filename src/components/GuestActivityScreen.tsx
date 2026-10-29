import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ActivityInput } from '../lib/activities'
import { todayLocalDate } from '../lib/dates'
import {
  appendGuestLog,
  loadGuestDraft,
  removeGuestActivity,
  removeGuestLogAt,
  setGuestActivityArchived,
  updateGuestLog,
  upsertGuestActivity,
  type GuestActivity,
  type GuestDraft,
} from '../lib/guestDraft'
import { guestActivityRow, guestLogsForActivity } from '../lib/guestInsights'
import { navigateBack } from '../lib/navigation'
import { useLocale } from '../hooks/useLocale'
import { ActivityDetail } from './ActivityDetail'
import { ActivityForm } from './ActivityForm'
import { Icon } from './Icon'

function activityFromInput(input: ActivityInput, existing?: GuestActivity): GuestActivity {
  const timed = input.type !== 'deadline' && input.type !== 'monthly'
  return {
    ...(existing ?? {
      localId: crypto.randomUUID(),
      sized: true,
    }),
    name: input.name.trim(),
    emoji: input.emoji.trim() || '📌',
    type: input.type,
    trackingMode: input.trackingMode,
    targetValue: timed ? input.targetValue : null,
    targetUnit:
      timed && input.trackingMode !== 'checkbox' ? input.targetUnit : null,
    weeklyTarget: input.type === 'weekly_n' ? input.weeklyTarget : null,
    deadline: input.type === 'deadline' ? input.deadline : null,
    templateId: input.templateId ?? existing?.templateId ?? null,
    why: input.whyMatters?.trim() || null,
    usuallyWhen: input.usuallyWhen?.trim() || null,
  }
}

function logIndex(id: string): number | null {
  const index = Number(id)
  return Number.isInteger(index) && index >= 0 ? index : null
}

/** Habit detail and edit for a guest. Check-ins stay on this device. */
export function GuestActivityScreen({
  mode,
  activityId,
}: {
  mode: 'detail' | 'form'
  activityId?: string
}) {
  const navigate = useNavigate()
  const { t } = useLocale()
  const [draft, setDraft] = useState<GuestDraft | null>(() => loadGuestDraft())
  const activity = draft?.activities.find((item) => item.localId === activityId) ?? null

  function refresh(next: GuestDraft) {
    setDraft(next)
  }

  if (!draft) return null

  if (mode === 'form') {
    return (
      <>
        <button
          type="button"
          className="btn btn-ghost btn-sm back-btn"
          onClick={() => navigateBack(navigate, activity ? `/activities/${activity.localId}` : '/activities')}
        >
          <Icon name="back" />
          {t('start.back')}
        </button>
        {!activity?.templateId && (
          <h2 className="form-title">{activity ? t('list.editHabit') : t('list.addHabit')}</h2>
        )}
        <ActivityForm
          initial={activity ? guestActivityRow(activity, draft.createdAt) : null}
          existingNames={draft.activities
            .filter((item) => item.localId !== activity?.localId)
            .map((item) => item.name)}
          onCancel={() => navigate(activity ? `/activities/${activity.localId}` : '/activities')}
          onSubmit={(input) => {
            const current = loadGuestDraft()
            if (!current) return
            const next = activityFromInput(input, activity ?? undefined)
            const saved = upsertGuestActivity(current, next)
            refresh(saved)
            if (!activity) {
              navigate('/activities')
            } else if (saved.activities.some((item) => item.localId === next.localId)) {
              navigate(`/activities/${next.localId}`)
            }
          }}
        />
      </>
    )
  }

  if (!activity) {
    return (
      <>
        <button type="button" className="btn btn-ghost btn-sm back-btn" onClick={() => navigate('/activities')}>
          <Icon name="back" />
          {t('start.back')}
        </button>
        <p className="screen-sub">{t('list.missingHabit')}</p>
      </>
    )
  }

  const row = guestActivityRow(activity, draft.createdAt)
  const today = todayLocalDate()

  return (
    <ActivityDetail
      activity={row}
      entries={guestLogsForActivity(draft, activity.localId)}
      onBack={() => navigate('/activities')}
      onEdit={() => navigate(`/activities/${activity.localId}/edit`)}
      onArchive={async () => {
        const current = loadGuestDraft()
        if (current) refresh(setGuestActivityArchived(current, activity.localId, true))
      }}
      onUnarchive={async () => {
        const current = loadGuestDraft()
        if (current) refresh(setGuestActivityArchived(current, activity.localId, false))
      }}
      onDelete={async () => {
        const current = loadGuestDraft()
        if (current) removeGuestActivity(current, activity.localId)
        navigate('/activities')
      }}
      onUpdateEntry={async (entryId, updates) => {
        const index = logIndex(entryId)
        const current = loadGuestDraft()
        if (index == null || !current) return
        refresh(
          updateGuestLog(current, index, {
            ...(updates.date ? { date: updates.date } : {}),
            ...(updates.duration_seconds != null ? { durationSeconds: updates.duration_seconds } : {}),
            ...(updates.note !== undefined ? { note: updates.note } : {}),
          }),
        )
      }}
      onDeleteEntry={async (entryId) => {
        const index = logIndex(entryId)
        const current = loadGuestDraft()
        if (index == null || !current) return
        refresh(removeGuestLogAt(current, index))
      }}
      onMarkDeadlineComplete={async () => {
        const current = loadGuestDraft()
        if (!current) return
        refresh(
          appendGuestLog(current, {
            localActivityId: activity.localId,
            startedAt: new Date().toISOString(),
            durationSeconds: 0,
            date: today,
            kind: 'completed',
          }),
        )
      }}
      icon={activity.icon}
      photo={activity.photo}
      onRescheduleDeadline={async (newDeadline) => {
        const current = loadGuestDraft()
        if (!current) return
        refresh(upsertGuestActivity(current, { ...activity, deadline: newDeadline }))
      }}
    />
  )
}
