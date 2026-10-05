import { useLocale } from '../hooks/useLocale'

/** Daily step goal, asked before a Steps habit is created. */
export function StepGoalField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t } = useLocale()
  return (
    <label className="field">
      <span className="field-label">{t('start.targetSteps')}</span>
      <input
        className="field-input"
        inputMode="numeric"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="10000"
      />
      <span className="form-hint">{t('notes.steps')}</span>
    </label>
  )
}
