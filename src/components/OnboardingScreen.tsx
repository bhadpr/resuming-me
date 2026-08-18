import { useMemo, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import {
  applyDeadlineDate,
  applyDraftName,
  applyDailyCadence,
  applyDailyCount,
  applySessionMinutes,
  applyWeeklyCount,
  applyWeeklyTimes,
  chipAddsImmediately,
  chipAsksCountTimes,
  DEADLINE_CADENCE_OPTIONS,
  draftFromChip,
  draftSummary,
  emptyNamedDraft,
  formatShortDate,
  sessionSizeOptions,
  STARTER_CHIPS,
  thisWeekDeadline,
  twoWeekDeadline,
  uniqueChipAlreadyAdded,
  type DeadlineCadence,
  type OnboardingCompletePayload,
  type OnboardingDraft,
  type StarterChipId,
} from '../lib/onboarding'
import { todayLocalDate } from '../lib/dates'
import { formatTimeInput, parseTimeInput } from '../lib/dailyDigest'

type Step =
  | 'chip'
  | 'size'
  | 'else-kind'
  | 'cadence'
  | 'weekly'
  | 'daily-times'
  | 'deadline-date'
  | 'deadline-remind'
  | 'list'
  | 'digest'

interface OnboardingScreenProps {
  saving?: boolean
  error?: string | null
  onComplete: (payload: OnboardingCompletePayload) => Promise<void>
  onSkip: () => void
}

export function OnboardingScreen({
  saving = false,
  error = null,
  onComplete,
  onSkip,
}: OnboardingScreenProps) {
  const today = useMemo(() => todayLocalDate(), [])
  const weekDate = useMemo(() => thisWeekDeadline(today), [today])
  const twoWeekDate = useMemo(() => twoWeekDeadline(today), [today])
  const native = Capacitor.isNativePlatform()

  const [step, setStep] = useState<Step>('chip')
  const [chipId, setChipId] = useState<StarterChipId | null>(null)
  const [draft, setDraft] = useState<OnboardingDraft | null>(null)
  const [added, setAdded] = useState<OnboardingDraft[]>([])
  const [customName, setCustomName] = useState('')
  const [deadlinePreset, setDeadlinePreset] = useState<'week' | 'two_weeks' | 'custom'>(
    'two_weeks',
  )
  const [customDeadline, setCustomDeadline] = useState(twoWeekDate)
  const [cadence, setCadence] = useState<DeadlineCadence>('few_days')
  const [digestHour, setDigestHour] = useState(19)
  const [digestMinute, setDigestMinute] = useState(0)

  const availableChips = STARTER_CHIPS.filter(
    (chip) => !uniqueChipAlreadyAdded(chip.id, added),
  )

  function commit(next: OnboardingDraft) {
    setAdded((prev) => [...prev, next])
    setDraft(null)
    setChipId(null)
    setCustomName('')
    setDeadlinePreset('two_weeks')
    setCustomDeadline(twoWeekDate)
    setCadence('few_days')
    setStep('list')
  }

  function startChip(id: StarterChipId) {
    setChipId(id)
    if (id === 'else' || id === 'deadline') {
      setDraft(emptyNamedDraft(id))
      setCustomName('')
      return
    }
    const next = draftFromChip(id)
    if (!next) return
    if (chipAddsImmediately(id)) {
      commit(next)
      return
    }
    setDraft(next)
    setStep('cadence')
  }

  function continueFromChip() {
    if (chipId === 'else') {
      if (!customName.trim()) return
      setDraft(applyDraftName(emptyNamedDraft('else'), customName))
      setStep('else-kind')
      return
    }
    if (chipId === 'deadline') {
      if (!customName.trim()) return
      setDraft(applyDraftName(emptyNamedDraft('deadline'), customName))
      setStep('deadline-date')
    }
  }

  function continueSize(minutes: number) {
    if (!draft) return
    commit(applySessionMinutes(draft, minutes))
  }

  function continueElseRepeating() {
    const base = applyDraftName(draft ?? emptyNamedDraft('else'), customName)
    setDraft(base)
    setStep('cadence')
  }

  function continueDaily() {
    if (!draft) return
    const next = applyDailyCadence(draft)
    setDraft(next)
    if (chipAsksCountTimes(next.chipId)) {
      setStep('daily-times')
      return
    }
    setStep('size')
  }

  function continueDailyTimes(times: number) {
    if (!draft) return
    commit(applyDailyCount(draft, times))
  }

  function continueWeeklyTimes(times: number) {
    if (!draft) return
    if (chipAsksCountTimes(draft.chipId)) {
      commit(applyWeeklyCount(draft, times))
      return
    }
    setDraft(applyWeeklyTimes(draft, times))
    setStep('size')
  }

  function continueElseDeadline() {
    const base = applyDraftName(draft ?? emptyNamedDraft('else'), customName)
    setDraft({ ...base, fromElse: true })
    setStep('deadline-date')
  }

  function selectedDeadline(): string {
    if (deadlinePreset === 'week') return weekDate
    if (deadlinePreset === 'two_weeks') return twoWeekDate
    return customDeadline
  }

  function continueDeadlineDate() {
    if (!draft) return
    setDraft(applyDeadlineDate(draft, selectedDeadline()))
    setStep('deadline-remind')
  }

  function continueDeadlineRemind() {
    if (!draft) return
    const dated = applyDeadlineDate(draft, selectedDeadline())
    commit({ ...dated, deadlineCadence: cadence })
  }

  async function finish(enableDigest: boolean) {
    const activities = added.map((item) => ({
      input: item.input,
      deadlineCadence: item.deadlineCadence,
    }))
    await onComplete({
      activities,
      digest: {
        enabled: enableDigest,
        hour: digestHour,
        minute: digestMinute,
      },
    })
  }

  const needsName = chipId === 'else' || chipId === 'deadline'
  const chipContinueDisabled = saving || !customName.trim()

  return (
    <div className="onboarding-screen">
      <figure className="onboarding-figure">
        <img
          src="/landing-resume.jpg"
          alt="Pausing, then picking work back up."
          width={960}
          height={640}
        />
      </figure>
      {step === 'chip' && (
        <>
          <Kicker text={added.length === 0 ? 'Get started' : 'Add another'} />
          <Header
            title="What’s one thing you’ve been putting off?"
            sub="Pick one. You can add more later."
          />
          <div className="onboarding-chips">
            {availableChips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`onboarding-chip ${chipId === chip.id ? 'onboarding-chip-selected' : ''}`}
                aria-pressed={chipId === chip.id}
                disabled={saving}
                onClick={() => startChip(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {needsName && (
            <label className="field">
              <span className="field-label">
                {chipId === 'deadline' ? 'What is it called?' : 'What do you want to call it?'}
              </span>
              <input
                className="field-input"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder={
                  chipId === 'deadline' ? 'Call the dentist' : 'Practice guitar'
                }
                autoFocus
                disabled={saving}
              />
            </label>
          )}
          <Actions
            primary={needsName ? 'Continue' : null}
            primaryDisabled={chipContinueDisabled}
            onPrimary={continueFromChip}
            secondary={added.length === 0 ? 'Skip for now' : 'Back'}
            onSecondary={added.length === 0 ? onSkip : () => setStep('list')}
            saving={saving}
          />
        </>
      )}

      {step === 'size' && draft && (
        <SizeStep
          name={draft.name}
          chipId={draft.chipId}
          weekly={draft.input.type === 'weekly_n'}
          saving={saving}
          onContinue={(minutes) => continueSize(minutes)}
          onBack={() =>
            setStep(draft.input.type === 'weekly_n' ? 'weekly' : 'cadence')
          }
        />
      )}

      {step === 'else-kind' && (
        <ElseKindStep
          name={customName.trim()}
          saving={saving}
          onRepeating={continueElseRepeating}
          onDeadline={continueElseDeadline}
          onBack={() => setStep('chip')}
        />
      )}

      {step === 'cadence' && (
        <CadenceStep
          name={customName.trim() || draft?.name || 'Something else'}
          saving={saving}
          onDaily={continueDaily}
          onWeekly={() => setStep('weekly')}
          onBack={() => setStep(draft?.chipId === 'else' ? 'else-kind' : 'chip')}
        />
      )}

      {step === 'weekly' && (
        <TimesStep
          name={customName.trim() || draft?.name || 'Something else'}
          period="week"
          primary={chipAsksCountTimes(draft?.chipId ?? 'else') ? 'Add to Today' : 'Continue'}
          saving={saving}
          onContinue={continueWeeklyTimes}
          onBack={() => setStep('cadence')}
        />
      )}

      {step === 'daily-times' && (
        <TimesStep
          name={customName.trim() || draft?.name || 'Something else'}
          period="day"
          primary="Add to Today"
          saving={saving}
          onContinue={continueDailyTimes}
          onBack={() => setStep('cadence')}
        />
      )}

      {step === 'deadline-date' && (
        <>
          <Kicker text={draft?.name || customName || 'Deadline'} />
          <Header
            title="When is it due?"
            sub="Pick a date. If you miss it, it stays until you complete it or move the date."
          />
          <ul className="template-list">
            <li>
              <Choice
                title="This week"
                meta={formatShortDate(weekDate)}
                selected={deadlinePreset === 'week'}
                disabled={saving}
                onClick={() => setDeadlinePreset('week')}
              />
            </li>
            <li>
              <Choice
                title="In 2 weeks"
                meta={formatShortDate(twoWeekDate)}
                selected={deadlinePreset === 'two_weeks'}
                disabled={saving}
                onClick={() => setDeadlinePreset('two_weeks')}
              />
            </li>
            <li>
              <Choice
                title="Pick a date"
                selected={deadlinePreset === 'custom'}
                disabled={saving}
                onClick={() => setDeadlinePreset('custom')}
              />
            </li>
          </ul>
          {deadlinePreset === 'custom' && (
            <label className="field">
              <span className="field-label">Date</span>
              <input
                className="field-input"
                type="date"
                value={customDeadline}
                min={today}
                onChange={(e) => setCustomDeadline(e.target.value)}
                disabled={saving}
              />
            </label>
          )}
          <Actions
            primary="Continue"
            primaryDisabled={saving || (deadlinePreset === 'custom' && !customDeadline)}
            onPrimary={continueDeadlineDate}
            secondary="Back"
            onSecondary={() => setStep(draft?.fromElse ? 'else-kind' : 'chip')}
            saving={saving}
          />
        </>
      )}

      {step === 'deadline-remind' && (
        <>
          <Kicker
            text={`${draft?.name || 'Deadline'} · due ${formatShortDate(selectedDeadline())}`}
          />
          <Header
            title="How often should I remind you?"
            sub="Until this date. One ping each time, if it is still open. Silent after you complete it."
          />
          <ul className="template-list">
            {DEADLINE_CADENCE_OPTIONS.map((option) => (
              <li key={option.id}>
                <Choice
                  title={option.title}
                  meta={option.meta}
                  selected={cadence === option.id}
                  disabled={saving}
                  onClick={() => setCadence(option.id)}
                />
              </li>
            ))}
          </ul>
          <Actions
            primary="Add to Today"
            primaryDisabled={saving}
            onPrimary={continueDeadlineRemind}
            secondary="Back"
            onSecondary={() => setStep('deadline-date')}
            saving={saving}
          />
        </>
      )}

      {step === 'list' && (
        <>
          <Kicker text="On Today" />
          <Header
            title={
              added.length === 1
                ? `${added[0].name} is set up`
                : `${added.length} things are set up`
            }
            sub={
              added.length === 1
                ? `${added[0].name} is on Today. Add another, or go there when you are ready.`
                : `They’re on Today. Add another, or go there when you are ready.`
            }
          />
          <ul className="template-list">
            {added.map((item, index) => (
              <li key={`${item.chipId}-${index}`}>
                <div className="template-option onboarding-added">
                  <span className="activity-emoji" aria-hidden>
                    {item.emoji}
                  </span>
                  <span className="activity-meta">
                    <span className="activity-name">{item.name}</span>
                    <span className="activity-desc">{draftSummary(item)}</span>
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {added.length < 3 && (
            <p className="onboarding-hint">You can add more later.</p>
          )}
          {error && <p className="error">{error}</p>}
          <Actions
            primary={added.length >= 3 ? 'Go to Today' : 'Add another'}
            onPrimary={added.length >= 3 ? () => setStep('digest') : () => setStep('chip')}
            secondary={added.length >= 3 ? 'Add another' : 'Go to Today'}
            onSecondary={
              added.length >= 3 ? () => setStep('chip') : () => setStep('digest')
            }
            saving={saving}
          />
        </>
      )}

      {step === 'digest' && (
        <>
          <Kicker text="Optional" />
          <Header
            title="Want a daily reminder?"
            sub="One ping a day if something is still open. Silent if you’re done."
          />
          <label className="field">
            <span className="field-label">What time?</span>
            <input
              className="field-input time-input"
              type="time"
              value={formatTimeInput(digestHour, digestMinute)}
              disabled={saving}
              onChange={(event) => {
                const parsed = parseTimeInput(event.target.value)
                if (!parsed) return
                setDigestHour(parsed.hour)
                setDigestMinute(parsed.minute)
              }}
            />
          </label>
          {!native && (
            <p className="onboarding-hint">
              Reminders arrive in the Android app. We’ll save this choice either way.
            </p>
          )}
          {error && <p className="error">{error}</p>}
          <Actions
            primary="Turn on"
            primaryDisabled={saving}
            onPrimary={() => void finish(true)}
            secondary="Not now"
            onSecondary={() => void finish(false)}
            saving={saving}
            savingLabel="Setting up…"
          />
        </>
      )}
    </div>
  )
}

function SizeStep({
  name,
  chipId,
  weekly,
  saving,
  onContinue,
  onBack,
}: {
  name: string
  chipId: StarterChipId
  weekly: boolean
  saving: boolean
  onContinue: (minutes: number) => void
  onBack: () => void
}) {
  const options = sessionSizeOptions(chipId)
  const [minutes, setMinutes] = useState(options[0]?.minutes ?? 2)
  const [custom, setCustom] = useState('')
  const usingCustom = custom.trim() !== '' && Number(custom) > 0
  const chosen = usingCustom ? Number(custom) : minutes

  return (
    <>
      <Kicker text={name} />
      <Header
        title={weekly ? 'How many minutes each time?' : 'How many minutes to start with?'}
        sub="Pick a preset, or type your own. You can change this later."
      />
      <ul className="template-list">
        {options.map((option) => (
          <li key={option.minutes}>
            <Choice
              title={option.title}
              meta={option.meta}
              selected={!usingCustom && minutes === option.minutes}
              disabled={saving}
              onClick={() => {
                setCustom('')
                setMinutes(option.minutes)
              }}
            />
          </li>
        ))}
      </ul>
      <label className="field">
        <span className="field-label">Or enter minutes</span>
        <input
          className="field-input"
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          placeholder="e.g. 15"
          value={custom}
          disabled={saving}
          onChange={(e) => setCustom(e.target.value)}
        />
      </label>
      <Actions
        primary="Add to Today"
        primaryDisabled={saving || !Number.isInteger(chosen) || chosen < 1}
        onPrimary={() => onContinue(chosen)}
        secondary="Back"
        onSecondary={onBack}
        saving={saving}
      />
    </>
  )
}

function CadenceStep({
  name,
  saving,
  onDaily,
  onWeekly,
  onBack,
}: {
  name: string
  saving: boolean
  onDaily: () => void
  onWeekly: () => void
  onBack: () => void
}) {
  const [cadence, setCadence] = useState<'daily' | 'weekly'>('daily')

  return (
    <>
      <Kicker text={name || 'Something else'} />
      <Header
        title="How often?"
        sub="Every day, or a few times a week. You can change this later."
      />
      <ul className="template-list">
        <li>
          <Choice
            title="Every day"
            meta="Show up on Today each day"
            selected={cadence === 'daily'}
            disabled={saving}
            onClick={() => setCadence('daily')}
          />
        </li>
        <li>
          <Choice
            title="A few times a week"
            meta="Set how many times next"
            selected={cadence === 'weekly'}
            disabled={saving}
            onClick={() => setCadence('weekly')}
          />
        </li>
      </ul>
      <Actions
        primary="Continue"
        primaryDisabled={saving}
        onPrimary={() => (cadence === 'weekly' ? onWeekly() : onDaily())}
        secondary="Back"
        onSecondary={onBack}
        saving={saving}
      />
    </>
  )
}

function TimesStep({
  name,
  period,
  primary,
  saving,
  onContinue,
  onBack,
}: {
  name: string
  period: 'day' | 'week'
  primary: string
  saving: boolean
  onContinue: (times: number) => void
  onBack: () => void
}) {
  const options =
    period === 'week'
      ? [
          { times: 1, title: 'Once a week', meta: 'One session is enough' },
          { times: 2, title: 'Twice a week', meta: 'A light weekly target' },
          { times: 3, title: 'Three times a week', meta: 'A bit more often' },
        ]
      : [
          { times: 1, title: 'Once a day', meta: 'One time is enough' },
          { times: 2, title: 'Twice a day', meta: 'Morning and later' },
          { times: 3, title: 'Three times a day', meta: 'A bit more often' },
        ]
  const max = period === 'week' ? 7 : 8
  const [times, setTimes] = useState(2)
  const [custom, setCustom] = useState('')
  const usingCustom = custom.trim() !== '' && Number(custom) > 0
  const chosen = usingCustom ? Number(custom) : times
  const valid = Number.isInteger(chosen) && chosen >= 1 && chosen <= max

  return (
    <>
      <Kicker text={name || 'Something else'} />
      <Header
        title={period === 'week' ? 'How many times a week?' : 'How many times a day?'}
        sub="Pick a preset, or type your own. You can change this later."
      />
      <ul className="template-list">
        {options.map((option) => (
          <li key={option.times}>
            <Choice
              title={option.title}
              meta={option.meta}
              selected={!usingCustom && times === option.times}
              disabled={saving}
              onClick={() => {
                setCustom('')
                setTimes(option.times)
              }}
            />
          </li>
        ))}
      </ul>
      <label className="field">
        <span className="field-label">
          {period === 'week' ? 'Or enter times per week' : 'Or enter times per day'}
        </span>
        <input
          className="field-input"
          type="number"
          min={1}
          max={max}
          step={1}
          inputMode="numeric"
          placeholder="e.g. 4"
          value={custom}
          disabled={saving}
          onChange={(e) => setCustom(e.target.value)}
        />
      </label>
      <Actions
        primary={primary}
        primaryDisabled={saving || !valid}
        onPrimary={() => onContinue(chosen)}
        secondary="Back"
        onSecondary={onBack}
        saving={saving}
      />
    </>
  )
}

function ElseKindStep({
  name,
  saving,
  onRepeating,
  onDeadline,
  onBack,
}: {
  name: string
  saving: boolean
  onRepeating: () => void
  onDeadline: () => void
  onBack: () => void
}) {
  const [kind, setKind] = useState<'repeating' | 'deadline'>('repeating')

  return (
    <>
      <Kicker text={name || 'Something else'} />
      <Header
        title="Is this ongoing, or one task?"
        sub="Ongoing comes back on Today. One task has a due date, like a call you’ve been putting off."
      />
      <ul className="template-list">
        <li>
          <Choice
            title="Ongoing"
            meta="I’ll do this again — daily or weekly"
            selected={kind === 'repeating'}
            disabled={saving}
            onClick={() => setKind('repeating')}
          />
        </li>
        <li>
          <Choice
            title="One task with a due date"
            meta="Finish it once, then it’s done"
            selected={kind === 'deadline'}
            disabled={saving}
            onClick={() => setKind('deadline')}
          />
        </li>
      </ul>
      <Actions
        primary="Continue"
        primaryDisabled={saving}
        onPrimary={() => (kind === 'deadline' ? onDeadline() : onRepeating())}
        secondary="Back"
        onSecondary={onBack}
        saving={saving}
      />
    </>
  )
}

function Kicker({ text }: { text: string }) {
  return <p className="onboarding-kicker">{text}</p>
}

function Header({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="screen-heading">
      <div>
        <h2>{title}</h2>
        <p className="screen-sub">{sub}</p>
      </div>
    </div>
  )
}

function Choice({
  title,
  meta,
  selected = false,
  disabled,
  onClick,
}: {
  title: string
  meta?: string
  selected?: boolean
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`template-option ${selected ? 'template-option-selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
    >
      <span className="activity-meta">
        <span className="activity-name">{title}</span>
        {meta ? <span className="activity-desc">{meta}</span> : null}
      </span>
      {selected ? (
        <span className="theme-check" aria-hidden>
          ✓
        </span>
      ) : (
        <span className="theme-check theme-check-empty" aria-hidden />
      )}
    </button>
  )
}

function Actions({
  primary,
  primaryDisabled,
  onPrimary,
  secondary,
  onSecondary,
  saving,
  savingLabel = 'Setting up…',
}: {
  primary: string | null
  primaryDisabled?: boolean
  onPrimary?: () => void
  secondary?: string
  onSecondary?: () => void
  saving?: boolean
  savingLabel?: string
}) {
  return (
    <div className="onboarding-actions">
      {primary && onPrimary && (
        <button
          type="button"
          className="btn btn-primary"
          disabled={primaryDisabled}
          onClick={onPrimary}
        >
          {saving ? savingLabel : primary}
        </button>
      )}
      {secondary && onSecondary && (
        <button type="button" className="btn btn-ghost" disabled={saving} onClick={onSecondary}>
          {secondary}
        </button>
      )}
    </div>
  )
}
