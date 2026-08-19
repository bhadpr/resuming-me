interface ArchivedFilterProps {
  showArchived: boolean
  archivedCount: number
  onToggle: () => void
  showLabel?: string
  hideLabel?: string
}

/** Quiet text toggle — only shown when archived items exist. */
export function ArchivedFilter({
  showArchived,
  archivedCount,
  onToggle,
  showLabel = 'Show hidden',
  hideLabel = 'Hide archived',
}: ArchivedFilterProps) {
  if (archivedCount === 0) return null

  return (
    <div className="list-filter-row">
      <button type="button" className="list-filter-btn" onClick={onToggle}>
        {showArchived ? hideLabel : showLabel}
      </button>
    </div>
  )
}
