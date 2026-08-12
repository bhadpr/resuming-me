interface MetricTrendChartProps {
  values: Array<{ date: string; value: number }>
  unit: string
  min: number | null
  max: number | null
}

export function MetricTrendChart({ values, unit, min, max }: MetricTrendChartProps) {
  if (values.length === 0) {
    return (
      <div className="trend-chart trend-chart-empty">
        <p>No values in this window yet. Log from Today to see a trend.</p>
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
