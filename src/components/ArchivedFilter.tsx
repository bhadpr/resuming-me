interface ArchivedFilterProps {
  showArchived: boolean
  archivedCount: number
  onToggle: () => void
}

/** Quiet text toggle — only shown when archived items exist. */
export function ArchivedFilter({
  showArchived,
  archivedCount,
  onToggle,
}: ArchivedFilterProps) {
  if (archivedCount === 0) return null

  return (
    <div className="list-filter-row">
      <button type="button" className="list-filter-btn" onClick={onToggle}>
        {showArchived ? 'Hide archived' : 'Show archived'}
      </button>
    </div>
  )
}
