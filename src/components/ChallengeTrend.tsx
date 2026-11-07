import { useState } from 'react'

const COLORS = ['#2f6fad', '#2f8f5b', '#c4564a', '#c4a04a']

const WIDTH = 360
const HEIGHT = 196
const PAD_L = 40
const PAD_R = 14
const PAD_T = 14
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

/** One line per team. Tap a day to read that day’s steps. */
export function ChallengeTrend({
  teams,
  points,
  locale,
  unit,
}: {
  teams: { id: string; name: string; image: number }[]
  points: { teamId: string; day: string; steps: number }[]
  locale: string
  unit: string
}) {
  const days = [...new Set(points.map((point) => point.day))].sort()
  const [picked, setPicked] = useState<string | null>(null)
  if (days.length < 2 || teams.length === 0) return null

  const active = picked && days.includes(picked) ? picked : days[days.length - 1]
  const values = points.map((point) => point.steps)
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
  const label = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' })
  const formatDay = (day: string) => label.format(new Date(`${day}T12:00:00`))
  const ticks = [0, Math.round((days.length - 1) / 2), days.length - 1].filter(
    (value, index, all) => all.indexOf(value) === index,
  )
  const yTicks = axisTicks(lo, hi)
  const activeIndex = dayIndex.get(active) ?? days.length - 1
  const dayPoints = teams
    .map((team) => {
      const point = points.find((row) => row.teamId === team.id && row.day === active)
      return point ? { team, steps: point.steps } : null
    })
    .filter((row): row is { team: (typeof teams)[number]; steps: number } => row != null)
    .sort((a, b) => b.steps - a.steps)

  return (
    <figure className="challenge-chart">
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
          const line = series
            .map((point) => `${xOf(dayIndex.get(point.day) ?? 0)},${yOf(point.steps)}`)
            .join(' ')
          return (
            <g key={team.id} style={{ pointerEvents: 'none' }}>
              <polyline
                points={line}
                fill="none"
                stroke={color}
                strokeWidth="2.5"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {series.map((point) => {
                const index = dayIndex.get(point.day) ?? 0
                const chosen = point.day === active
                return (
                  <circle
                    key={point.day}
                    cx={xOf(index)}
                    cy={yOf(point.steps)}
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
              onClick={() => setPicked(day)}
            />
          )
        })}
      </svg>
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
      <figcaption className="challenge-chart-readout">
        <p>
          {formatDay(active)} · {unit}
        </p>
        <ul>
          {dayPoints.map(({ team, steps }) => (
            <li key={team.id}>
              <i style={{ background: teamColor(team.image) }} />
              <span>{team.name}</span>
              <strong>{steps.toLocaleString(locale)}</strong>
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  )
}
