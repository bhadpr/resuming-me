import { addDays } from '../lib/dates'

interface MetricTrendChartProps {
  values: Array<{ date: string; value: number }>
  unit: string
  min: number | null
  max: number | null
  /** When set to 7, render a full-week bar chart (missing days as empty bars). */
  windowDays?: number
  today?: string
}

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const

export function MetricTrendChart({
  values,
  unit,
  min,
  max,
  windowDays,
  today,
}: MetricTrendChartProps) {
  const useBars = windowDays === 7 && today != null

  if (values.length === 0 && !useBars) {
    return (
      <div className="trend-chart trend-chart-empty">
        <p>No values in this window yet. Log from Today to see a trend.</p>
      </div>
    )
  }

  if (useBars) {
    const byDate = new Map(values.map((v) => [v.date, v.value]))
    const days = Array.from({ length: 7 }, (_, i) => {
      const date = addDays(today, -(6 - i))
      const value = byDate.get(date)
      return {
        date,
        value: value ?? null,
        label: DOW[new Date(`${date}T12:00:00`).getDay()],
      }
    })
    const nums = days.map((d) => d.value).filter((v): v is number => v != null)
    const hi = Math.max(...(nums.length ? nums : [1]), max ?? 0, 1) * 1.15
    const hasAny = nums.length > 0

    return (
      <div className="trend-chart">
        {hasAny ? (
          <div className="bar-grid insight-bar-grid" role="img" aria-label={`${unit} 7-day chart`}>
            {days.map((d) => {
              const empty = d.value == null
              const heightPct = empty ? 0 : Math.max(4, Math.round((d.value! / hi) * 100))
              return (
                <div
                  key={d.date}
                  className="bar-grid-item"
                  title={empty ? `${d.date}: no log` : `${d.date}: ${d.value} ${unit}`}
                >
                  <div className="bar-grid-track">
                    <div
                      className={`bar-grid-fill bar-grid-fill-primary${empty ? ' bar-grid-fill-empty' : ''}`}
                      style={{ height: empty ? '3px' : `${heightPct}%` }}
                    />
                  </div>
                  <span className="bar-grid-label">{d.label}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="trend-chart-empty">
            <p>No values in this window yet. Log from Today to see a trend.</p>
          </div>
        )}
        {hasAny ? (
          <div className="trend-chart-caption">
            <span>
              {days[0].date} → {days[6].date}
            </span>
            <span>{unit}</span>
          </div>
        ) : null}
      </div>
    )
  }

  const width = 320
  const height = 140
  const padX = 12
  const padY = 16
  const innerW = width - padX * 2
  const innerH = height - padY * 2

  const lo = min ?? values[0].value
  const hi = max ?? values[0].value
  const span = hi - lo || 1

  const points = values.map((v, i) => {
    const x =
      values.length === 1
        ? padX + innerW / 2
        : padX + (i / (values.length - 1)) * innerW
    const y = padY + innerH - ((v.value - lo) / span) * innerH
    return { x, y, ...v }
  })

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="trend-chart-svg"
        role="img"
        aria-label={`${unit} trend chart`}
      >
        <line
          x1={padX}
          y1={padY + innerH}
          x2={padX + innerW}
          y2={padY + innerH}
          className="trend-axis"
        />
        <polyline points={polyline} className="trend-line" fill="none" />
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={3.5} className="trend-dot" />
        ))}
      </svg>
      <div className="trend-chart-caption">
        <span>
          {values[0].date} → {values[values.length - 1].date}
        </span>
        <span>{unit}</span>
      </div>
    </div>
  )
}
