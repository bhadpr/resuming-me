const ACTIVITY_EMOJIS = [
  '📚', '🚶', '🏃', '🏋️', '🧘', '🧠', '✍️', '🎹',
  '🎸', '🎬', '🥗', '💧', '😴', '🧹', '🧾', '💼',
  '📧', '🗣️', '🌱', '🎯', '⏰', '📝', '🔧', '📌',
]

const METRIC_EMOJIS = [
  '⚖️', '❤️', '💤', '😊', '🌡️', '🩸', '🫁', '🧠',
  '💧', '🥗', '⏱️', '📉', '📈', '🩺', '😌', '🔥',
]

interface EmojiPickerProps {
  value: string
  onChange: (emoji: string) => void
  options?: string[]
  label?: string
}

export function EmojiPicker({
  value,
  onChange,
  options = ACTIVITY_EMOJIS,
  label = 'Emoji',
}: EmojiPickerProps) {
  return (
    <div className="emoji-picker" role="listbox" aria-label={label}>
      {options.map((emoji) => (
        <button
          key={emoji}
          type="button"
          role="option"
          aria-selected={value === emoji}
          className={`emoji-option ${value === emoji ? 'emoji-option-selected' : ''}`}
          onClick={() => onChange(emoji)}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}

export { ACTIVITY_EMOJIS, METRIC_EMOJIS }
