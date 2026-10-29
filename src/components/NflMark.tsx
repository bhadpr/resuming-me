/** A crest when the team has one, or the short city name on team colors. */
export type TeamBadge = {
  abbr: string
  color: string
  accent: string
  ink: string
  logo?: string
}

/** The team logo, sized for a row, the Add card, or the games page. */
export function NflMark({ team, size = 'row' }: { team: TeamBadge; size?: 'row' | 'card' | 'hero' }) {
  const sized = size === 'row' ? '' : ` nfl-mark-${size}`
  if (team.logo) {
    const flag = team.logo.includes('/cricket/') ? ' nfl-mark-flag' : ''
    return (
      <span className={`activity-emoji activity-emoji-art reminder-mark nfl-mark nfl-mark-logo${flag}${sized}`} aria-hidden>
        <img className="nfl-mark-img" src={team.logo} alt="" />
      </span>
    )
  }
  return (
    <span
      className={`activity-emoji activity-emoji-art reminder-mark nfl-mark${sized}`}
      style={{ background: team.color, color: team.ink }}
      aria-hidden
    >
      <span className={`nfl-mark-abbr${team.abbr.length > 2 ? ' nfl-mark-abbr-long' : ''}`}>{team.abbr}</span>
      <span className="nfl-mark-stripe" style={{ background: team.accent }} />
    </span>
  )
}
