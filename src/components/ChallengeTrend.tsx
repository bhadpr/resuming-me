import { useState } from 'react'

const COLORS = ['#2f6fad', '#2f8f5b', '#c4564a', '#c4a04a']

const WIDTH = 360
const HEIGHT = 176
const PAD_L = 40
const PAD_R = 14
const PAD_T = 12
const PAD_B = 26

export function teamColor(image: number): string {
  const index = image >= 1 && image <= COLORS.length ? image - 1 : 0
  return COLORS[index]
}

function shortNumber(value: number): string {
  if (Math.abs(value) >= 1000) {
    const scaled = Math.round(value / 100) / 10
    return `${scaled}k`
  }
  return String(Math.round(value))
}

function niceStep(rough: number): number {
  if (rough <= 0) return 1
  const pow = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / pow
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return nice * pow
}

function axisTicks(lo: number, hi: number): number[] {
  const step = niceStep((hi - lo) / 3)
  const start = Math.ceil(lo / step) * step
  const ticks: number[] = []
  for (let value = start; value <= hi + step * 0.01; value += step) ticks.push(Math.round(value))
  return ticks.slice(0, 5)
}

type Team = { id: string; name: string; image: number }
type Point = { teamId: string; day: string; steps: number; average: number | null }

/** Race: each team's total, then each team's average. Group: progress toward the one goal, then each day. */
export function ChallengeTrend({
  teams,
  points,
  locale,
  unit,
  totalLabel,
  averageLabel,
  goal,
  goalLabel,
  goalMark,
  soFarLabel,
  goalOf,
}: {
  teams: Team[]
  points: Point[]
  locale: string
  unit: string
  totalLabel: string
  averageLabel: string
  goal?: number | null
  goalLabel?: string
  goalMark?: string
  soFarLabel?: string
  goalOf?: (total: number) => string
}) {
  const days = [...new Set(points.map((point) => point.day))].sort()
  const [picked, setPicked] = useState<string | null>(null)
  if (days.length < 2 || teams.length === 0) return null

  const active = picked && days.includes(picked) ? picked : days[days.length - 1]
  const label = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  const formatDay = (day: string) => label.format(new Date(`${day}T12:00:00`))
  const hasAverage = points.some((point) => point.average != null)
  const goalView =
    goal != null && goal > 0 && goalLabel && goalMark && soFarLabel && goalOf
      ? { goal, goalLabel, goalMark, soFarLabel, goalOf }
      : null
  let running = 0
  const cumulative = days.map((day) => {
    const added = points.filter((point) => point.day === day).reduce((sum, point) => sum + point.steps, 0)
    running += added
    return { day, total: running }
  })

  return (
    <div className="challenge-charts">
      {!goalView && (
        <p className="challenge-chart-key">
          {teams.map((team) => (
            <span key={team.id}>
              <i style={{ background: teamColor(team.image) }} />
              {team.name}
            </span>
          ))}
        </p>
      )}
      {days.length <= 16 && (
        <div className="challenge-days" role="tablist" aria-label={unit}>
          {days.map((day) => (
            <button
              key={day}
              type="button"
              role="tab"
              aria-selected={day === active}
              className={day === active ? 'is-selected' : undefined}
              onClick={() => setPicked(day)}
            >
              {new Intl.DateTimeFormat(locale, { day: 'numeric' }).format(new Date(`${day}T12:00:00`))}
            </button>
          ))}
        </div>
      )}
      {goalView && (
        <GoalChart
          title={goalView.goalLabel}
          soFarLabel={goalView.soFarLabel}
          goalMark={goalView.goalMark}
          goal={goalView.goal}
          cumulative={cumulative}
          color={teamColor(teams[0]?.image ?? 1)}
          days={days}
          active={active}
          formatDay={formatDay}
          onPick={setPicked}
          goalOf={goalView.goalOf}
        />
      )}
      <TeamChart
        title={totalLabel}
        teams={teams}
        points={points}
        days={days}
        active={active}
        locale={locale}
        unit={unit}
        formatDay={formatDay}
        onPick={setPicked}
        valueOf={(point) => point.steps}
      />
      {!goalView && hasAverage && (
        <TeamChart
          title={averageLabel}
          teams={teams}
          points={points}
          days={days}
          active={active}
          locale={locale}
          unit={unit}
          formatDay={formatDay}
          onPick={setPicked}
          valueOf={(point) => point.average}
        />
      )}
    </div>
  )
}

function GoalChart({
  title,
  soFarLabel,
  goalMark,
  goal,
  cumulative,
  color,
  days,
  active,
  formatDay,
  onPick,
  goalOf,
}: {
  title: string
  soFarLabel: string
  goalMark: string
  goal: number
  cumulative: { day: string; total: number }[]
  color: string
  days: string[]
  active: string
  formatDay: (day: string) => string
  onPick: (day: string) => void
  goalOf: (total: number) => string
}) {
  const last = cumulative[cumulative.length - 1]?.total ?? 0
  const hi = Math.max(goal, last) * 1.08
  const span = hi || 1
  const innerW = WIDTH - PAD_L - PAD_R
  const innerH = HEIGHT - PAD_T - PAD_B
  const xOf = (index: number) => PAD_L + (index / (days.length - 1)) * innerW
  const yOf = (steps: number) => PAD_T + innerH - (steps / span) * innerH
  const dayIndex = new Map(days.map((day, index) => [day, index]))
  const ticks = [0, Math.round((days.length - 1) / 2), days.length - 1].filter(
    (value, index, all) => all.indexOf(value) === index,
  )
  const yTicks = axisTicks(0, hi)
  const activeIndex = dayIndex.get(active) ?? days.length - 1
  const activeTotal = cumulative.find((point) => point.day === active)?.total ?? 0
  const line = cumulative.map((point) => `${xOf(dayIndex.get(point.day) ?? 0)},${yOf(point.total)}`).join(' ')

  return (
    <figure className="challenge-chart">
      <figcaption className="challenge-chart-title">{title}</figcaption>
      <p className="challenge-chart-key">
        <span>
          <i style={{ background: color }} />
          {soFarLabel}
        </span>
        <span>
          <i className="is-goal" />
          {goalMark}
        </span>
      </p>
      <svg className="trend-chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line className="challenge-chart-grid" x1={PAD_L} y1={yOf(tick)} x2={WIDTH - PAD_R} y2={yOf(tick)} />
            <text x={PAD_L - 6} y={yOf(tick) + 3} textAnchor="end" className="challenge-chart-tick">
              {shortNumber(tick)}
            </text>
          </g>
        ))}
        <line className="trend-axis" x1={PAD_L} y1={PAD_T + innerH} x2={WIDTH - PAD_R} y2={PAD_T + innerH} />
        <line
          x1={xOf(0)}
          y1={yOf(goal)}
          x2={xOf(days.length - 1)}
          y2={yOf(goal)}
          stroke="#c24b78"
          strokeWidth="2"
          strokeDasharray="1.5 5"
        />
        <line
          className="challenge-chart-guide"
          x1={xOf(activeIndex)}
          y1={PAD_T}
          x2={xOf(activeIndex)}
          y2={PAD_T + innerH}
        />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ pointerEvents: 'none' }}
        />
        {cumulative.map((point) => {
          const index = dayIndex.get(point.day) ?? 0
          const chosen = point.day === active
          return (
            <circle
              key={point.day}
              cx={xOf(index)}
              cy={yOf(point.total)}
              r={chosen ? 4.5 : 2.75}
              fill={color}
              stroke="#fff"
              strokeWidth={chosen ? 1.5 : 0}
              style={{ pointerEvents: 'none' }}
            />
          )
        })}
        {ticks.map((index) => (
          <text key={days[index]} x={xOf(index)} y={HEIGHT - 6} textAnchor="middle" className="challenge-chart-tick">
            {formatDay(days[index])}
          </text>
        ))}
        {days.map((day, index) => {
          const left = index === 0 ? PAD_L : (xOf(index - 1) + xOf(index)) / 2
          const right = index === days.length - 1 ? WIDTH - PAD_R : (xOf(index) + xOf(index + 1)) / 2
          return (
            <rect
              key={day}
              x={left}
              y={PAD_T}
              width={right - left}
              height={innerH}
              fill="transparent"
              className="challenge-chart-hit"
              onClick={() => onPick(day)}
            />
          )
        })}
      </svg>
      <div className="challenge-chart-readout">
        <p>{formatDay(active)}</p>
        <ul>
          <li>
            <i style={{ background: color }} />
            <span>{soFarLabel}</span>
            <strong>{goalOf(activeTotal)}</strong>
          </li>
        </ul>
      </div>
    </figure>
  )
}

function TeamChart({
  title,
  teams,
  points,
  days,
  active,
  locale,
  unit,
  formatDay,
  onPick,
  valueOf,
}: {
  title: string
  teams: Team[]
  points: Point[]
  days: string[]
  active: string
  locale: string
  unit: string
  formatDay: (day: string) => string
  onPick: (day: string) => void
  valueOf: (point: Point) => number | null
}) {
  const values = points.map(valueOf).filter((value): value is number => value != null)
  if (values.length === 0) return null
  const rawLo = Math.min(...values)
  const rawHi = Math.max(...values)
  const pad = (rawHi - rawLo || Math.max(rawHi * 0.08, 1)) * 0.22
  const lo = Math.max(0, rawLo - pad)
  const hi = rawHi + pad
  const span = hi - lo || 1
  const innerW = WIDTH - PAD_L - PAD_R
  const innerH = HEIGHT - PAD_T - PAD_B
  const xOf = (index: number) => PAD_L + (index / (days.length - 1)) * innerW
  const yOf = (steps: number) => PAD_T + innerH - ((steps - lo) / span) * innerH
  const dayIndex = new Map(days.map((day, index) => [day, index]))
  const ticks = [0, Math.round((days.length - 1) / 2), days.length - 1].filter(
    (value, index, all) => all.indexOf(value) === index,
  )
  const yTicks = axisTicks(lo, hi)
  const activeIndex = dayIndex.get(active) ?? days.length - 1
  const dayPoints = teams
    .map((team) => {
      const point = points.find((row) => row.teamId === team.id && row.day === active)
      return point ? { team, value: valueOf(point) } : null
    })
    .filter((row): row is { team: Team; value: number | null } => row != null)
    .sort((a, b) => (b.value ?? -1) - (a.value ?? -1))

  return (
    <figure className="challenge-chart">
      <figcaption className="challenge-chart-title">{title}</figcaption>
      <svg className="trend-chart-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} aria-hidden="true">
        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              className="challenge-chart-grid"
              x1={PAD_L}
              y1={yOf(tick)}
              x2={WIDTH - PAD_R}
              y2={yOf(tick)}
            />
            <text x={PAD_L - 6} y={yOf(tick) + 3} textAnchor="end" className="challenge-chart-tick">
              {shortNumber(tick)}
            </text>
          </g>
        ))}
        <line className="trend-axis" x1={PAD_L} y1={PAD_T + innerH} x2={WIDTH - PAD_R} y2={PAD_T + innerH} />
        <line
          className="challenge-chart-guide"
          x1={xOf(activeIndex)}
          y1={PAD_T}
          x2={xOf(activeIndex)}
          y2={PAD_T + innerH}
        />
        {teams.map((team) => {
          const series = points
            .filter((point) => point.teamId === team.id)
            .sort((a, b) => a.day.localeCompare(b.day))
          if (series.length === 0) return null
          const color = teamColor(team.image)
          const segments: string[] = []
          let segment: string[] = []
          for (const point of series) {
            const value = valueOf(point)
            if (value == null) {
              if (segment.length > 0) segments.push(segment.join(' '))
              segment = []
              continue
            }
            segment.push(`${xOf(dayIndex.get(point.day) ?? 0)},${yOf(value)}`)
          }
          if (segment.length > 0) segments.push(segment.join(' '))
          return (
            <g key={team.id} style={{ pointerEvents: 'none' }}>
              {segments.map((line) => (
                <polyline
                  key={line}
                  points={line}
                  fill="none"
                  stroke={color}
                  strokeWidth="2.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
              {series.map((point) => {
                const value = valueOf(point)
                if (value == null) return null
                const index = dayIndex.get(point.day) ?? 0
                const chosen = point.day === active
                return (
                  <circle
                    key={point.day}
                    cx={xOf(index)}
                    cy={yOf(value)}
                    r={chosen ? 4.5 : 2.75}
                    fill={color}
                    stroke="#fff"
                    strokeWidth={chosen ? 1.5 : 0}
                  />
                )
              })}
            </g>
          )
        })}
        {ticks.map((index) => (
          <text key={days[index]} x={xOf(index)} y={HEIGHT - 6} textAnchor="middle" className="challenge-chart-tick">
            {formatDay(days[index])}
          </text>
        ))}
        {days.map((day, index) => {
          const left = index === 0 ? PAD_L : (xOf(index - 1) + xOf(index)) / 2
          const right = index === days.length - 1 ? WIDTH - PAD_R : (xOf(index) + xOf(index + 1)) / 2
          return (
            <rect
              key={day}
              x={left}
              y={PAD_T}
              width={right - left}
              height={innerH}
              fill="transparent"
              className="challenge-chart-hit"
              onClick={() => onPick(day)}
            />
          )
        })}
      </svg>
      <div className="challenge-chart-readout">
        <p>
          {formatDay(active)} · {unit}
        </p>
        <ul>
          {dayPoints.map(({ team, value }) => (
            <li key={team.id}>
              <i style={{ background: teamColor(team.image) }} />
              <span>{team.name}</span>
              <strong>{value == null ? '—' : value.toLocaleString(locale)}</strong>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
