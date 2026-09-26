import type { ActivitySeriesPoint } from '../lib/insights'

interface ActivityInsightChartProps {
  points: ActivitySeriesPoint[]
  windowLabel: string
  /** Axis max is max(target, best day) × 1.2, with a target line when set. */
  target?: number | null
}

export function ActivityInsightChart({
  points,
  windowLabel,
  target = null,
}: ActivityInsightChartProps) {
  if (points.length === 0) {
    return (
      <div className="activity-insight-chart activity-insight-chart-empty">
        <p>No days in this window yet.</p>
      </div>
    )
  }

  const useBars = points.length <= 7
  const values = points.map((p) => p.value)
  const best = Math.max(...values, 0)
  const hi = Math.max(target ?? 0, best, 1) * 1.2
  const unit = points[0]?.unit ?? ''
  const avg = values.reduce((sum, v) => sum + v, 0) / Math.max(values.length, 1)
  const logged = points.filter((p) => p.value > 0)
  const avgLogged =
    logged.length === 0
      ? null
      : logged.reduce((sum, p) => sum + p.value, 0) / logged.length
  const met = points.filter((p) => p.status === 'done').length
  const partial = points.filter((p) => p.status === 'partial').length
  const postponed = points.filter((p) => p.status === 'skipped').length
  const showAverage = unit === 'min' || unit === '×'

  const caption = (
    <div className="activity-insight-chart-caption">
      <span>
        {met} done
        {partial > 0 ? ` · ${partial} partial` : ''}
        {postponed > 0 ? ` · ${postponed} skipped` : ''}
        {' · '}
        {points.length} {unit === '×' ? 'weeks' : 'days'}
        {showAverage ? ` · avg ${formatAvg(avg, unit)}${unit === '×' ? '/wk' : '/day'}` : ''}
        {showAverage && avgLogged != null && unit === 'min'
          ? ` · ${formatAvg(avgLogged, unit)} when logged`
          : ''}
      </span>
      <span className="activity-insight-legend">
        <span className="legend-swatch legend-met" /> Done
        <span className="legend-swatch legend-partial" /> Partial
        <span className="legend-swatch legend-postponed" /> Skipped
        <span className="legend-swatch legend-open" /> Open
      </span>
    </div>
  )

  if (useBars) {
    return (
      <div className="activity-insight-chart">
        <div
          className="bar-grid insight-bar-grid"
          role="img"
          aria-label={`${windowLabel} habit chart`}
        >
          {points.map((p) => {
            const heightPct = Math.max(2, Math.round((p.value / hi) * 100))
            const empty = p.value <= 0
            return (
              <div key={p.key} className="bar-grid-item" title={tooltip(p)}>
                <div className="bar-grid-track">
                  <div
                    className={`bar-grid-fill bar-fill-${p.status}${empty ? ' bar-grid-fill-empty' : ''}`}
                    style={{ height: empty ? '3px' : `${heightPct}%` }}
                  />
                </div>
                <span className="bar-grid-label">{p.label}</span>
              </div>
            )
          })}
        </div>
        {caption}
      </div>
    )
  }

  const width = 320
  const height = 150
  const padL = 28
  const padR = 12
  const padT = 14
  const padB = 28
  const innerW = width - padL - padR
  const innerH = height - padT - padB
  const lo = 0
  const span = hi - lo || 1
  const labelEvery = points.length <= 14 ? 2 : 5
  const yTicks = [hi, hi / 2, 0].map((v) => Math.round(v * 10) / 10)
  const avgY = padT + innerH - ((avg - lo) / span) * innerH

  const plotted = points.map((p, i) => {
    const x =
      points.length === 1
        ? padL + innerW / 2
        : padL + (i / (points.length - 1)) * innerW
    const y = padT + innerH - ((p.value - lo) / span) * innerH
    return { x, y, ...p }
  })
  const polyline = plotted.map((p) => `${p.x},${p.y}`).join(' ')

  return (
    <div className="activity-insight-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="activity-insight-svg"
        role="img"
        aria-label={`${windowLabel} habit chart`}
      >
        {yTicks.map((tick) => {
          const y = padT + innerH - ((tick - lo) / span) * innerH
          return (
            <g key={`yt-${tick}`}>
              <line
                x1={padL}
                y1={y}
                x2={padL + innerW}
                y2={y}
                className="trend-grid"
              />
              <text x={padL - 4} y={y + 3} className="trend-axis-label" textAnchor="end">
                {formatTick(tick, unit)}
              </text>
            </g>
          )
        })}
        <line
          x1={padL}
          y1={padT + innerH}
          x2={padL + innerW}
          y2={padT + innerH}
          className="trend-axis"
        />
        {target != null && target > 0 && target <= hi && (
          <line
            x1={padL}
            y1={padT + innerH - ((target - lo) / span) * innerH}
            x2={padL + innerW}
            y2={padT + innerH - ((target - lo) / span) * innerH}
            className="trend-target-line"
          />
        )}
        <polyline points={polyline} className="trend-line" fill="none" />
        {plotted.map((p) => (
          <circle
            key={p.key}
            cx={p.x}
            cy={p.y}
            r={points.length > 20 ? 2.5 : 3.5}
            className={`trend-dot trend-dot-${p.status}`}
          >
            <title>{tooltip(p)}</title>
          </circle>
        ))}
        {showAverage && avg > 0 && (
          <g className="trend-avg">
            <line
              x1={padL}
              y1={avgY}
              x2={padL + innerW - 54}
              y2={avgY}
              className="trend-avg-line"
            />
            <rect
              x={padL + innerW - 52}
              y={avgY - 9}
              width={52}
              height={12}
              rx={2}
              className="trend-avg-bg"
            />
            <text
              x={padL + innerW - 2}
              y={avgY + 1}
              className="trend-avg-label"
              textAnchor="end"
              dominantBaseline="middle"
            >
              avg {formatAvg(avg, unit)}
            </text>
          </g>
        )}
        {plotted.map((p, i) =>
          i === 0 || i === plotted.length - 1 || i % labelEvery === 0 ? (
            <text
              key={`xl-${p.key}`}
              x={p.x}
              y={height - 8}
              className="trend-axis-label"
              textAnchor="middle"
            >
              {p.label}
            </text>
          ) : null,
        )}
      </svg>
      {caption}
    </div>
  )
}

function formatTick(value: number, unit: string): string {
  if (unit === 'min') return `${value}`
  if (unit === '×') return `${value}`
  return String(value)
}

function formatAvg(value: number, unit: string): string {
  const n = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10
  if (unit === 'min') return `${n} min`
  if (unit === '×') return `${n}×`
  return String(n)
}

function tooltip(p: ActivitySeriesPoint): string {
  const status = p.status
  if (p.unit === 'min') return `${p.date}: ${p.value} min (${status})`
  if (p.unit === '×') return `${p.date}: ${p.value}× (${status})`
  return `${p.date}: ${status}`
}
