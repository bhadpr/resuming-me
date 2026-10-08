import { useLocale } from '../hooks/useLocale'
import {
  WEIGHT_UNITS,
  convertWeight,
  gapHeading,
  gapNote,
  gapOptionParts,
  gapOptionsFor,
  parseGoalText,
  type WeightUnit,
} from '../lib/onboardingFlow'

type GoalAsk = Parameters<typeof gapOptionsFor>[0]

function goalOptionValue(option: object): number | null {
  for (const key of ['glasses', 'grams', 'hours', 'count'] as const) {
    if (key in option) {
      const value = (option as Record<typeof key, unknown>)[key]
      if (typeof value === 'number') return value
    }
  }
  return null
}

/** kg or lb, chosen by the person. Switching converts the typed target. */
export function WeightTargetField({
  text,
  unit,
  onText,
  onUnit,
  autoFocus = true,
}: {
  text: string
  unit: WeightUnit
  onText: (text: string) => void
  onUnit: (unit: WeightUnit) => void
  autoFocus?: boolean
}) {
  const { t } = useLocale()
  function switchUnit(next: WeightUnit) {
    if (next === unit) return
    const value = Number(text.replace(/,/g, '').trim())
    if (text.trim() && Number.isFinite(value) && value > 0) onText(String(convertWeight(value, unit, next)))
    onUnit(next)
  }
  return (
    <>
      <div className="segmented" role="group" aria-label={t('start.weightUnit')}>
        {WEIGHT_UNITS.map((option) => (
          <button
            key={option}
            type="button"
            className={`segmented-btn ${unit === option ? 'segmented-btn-active' : ''}`}
            aria-pressed={unit === option}
            onClick={() => switchUnit(option)}
          >
            {option}
          </button>
        ))}
      </div>
      <label className="field">
        <span className="field-label">{t('start.targetIn', { unit })}</span>
        <input
          className="field-input"
          inputMode="decimal"
          value={text}
          onChange={(event) => onText(event.target.value)}
          placeholder={unit === 'kg' ? '70' : '155'}
          autoFocus={autoFocus}
          enterKeyHint="done"
        />
      </label>
    </>
  )
}

/** Blood pressure and heart rate use the standard healthy range instead of asking. */
export function StandardVitalTarget({ messageKey }: { messageKey: string }) {
  const { t } = useLocale()
  return (
    <>
      <p className="start-standard-target">{t(messageKey)}</p>
      <p className="screen-sub">{t('start.standardTarget')}</p>
    </>
  )
}

/** Goal tiles (glasses, grams, hours, steps) plus "Or type your own". */
export function GoalTargetPicker({
  habit,
  value,
  text,
  onPick,
  onText,
}: {
  habit: GoalAsk
  value: number | null
  text: string
  onPick: (value: number) => void
  onText: (text: string) => void
}) {
  const { t } = useLocale()
  const typed = parseGoalText(habit.templateId, text)
  const note = gapNote(habit)
  return (
    <>
      {note && <p className="screen-sub">{note}</p>}
      <div className="choice-grid choice-grid-size" role="group" aria-label={gapHeading(habit)}>
        {gapOptionsFor(habit).map((option) => {
          const optionValue = goalOptionValue(option)
          if (optionValue == null) return null
          const selected = typed == null && value === optionValue
          const parts = gapOptionParts(option)
          return (
            <button
              key={option.id}
              type="button"
              className={`choice-tile choice-tile-stack ${selected ? 'choice-tile-selected' : ''}`}
              aria-label={option.label}
              aria-pressed={selected}
              onClick={() => onPick(optionValue)}
            >
              <span className="choice-tile-primary">{parts.primary}</span>
              {parts.secondary ? <span className="choice-tile-secondary">{parts.secondary}</span> : null}
            </button>
          )
        })}
      </div>
      <label className="field">
        <span className="field-label">{t('start.ownAmount')}</span>
        <input
          className="field-input"
          inputMode={habit.templateId === 'steps' ? 'numeric' : 'decimal'}
          value={text}
          onChange={(event) => onText(event.target.value)}
          placeholder={value != null ? String(value) : ''}
          enterKeyHint="done"
        />
      </label>
    </>
  )
}
