import { useState } from 'react'
import { useLocale } from '../hooks/useLocale'
import { addDays, daysBetween, parseLocalDate } from '../lib/dates'
import { localeTag } from '../lib/i18n'
import {
  bpEnds,
  formatPair,
  pointStatus,
  withinTarget,
  type VitalPoint,
  type VitalTarget,
} from '../lib/vitalChart'

interface MetricTrendChartProps {
  values: VitalPoint[]
  unit: string
  target: VitalTarget | null
  /** The chart always spans this many days ending today, so missing days show as gaps. */
  windowDays: number
  today: string
}

const WIDTH = 320
const HEIGHT = 176
const PAD_L = 30
const PAD_R = 28
/** Keeps the first and last dot clear of the axis numbers and the target numbers. */
const DOT_INSET = 10
const PAD_T = 22
const PAD_B = 26
/** Numbers above the dots only while they fit. Beyond this, tap a dot. */
const MAX_LABELLED = 14

/** 10000 becomes 10k so a row of step counts still fits. */
function shortNumber(n: number): string {
  if (Math.abs(n) >= 1000) {
    const k = Math.round(n / 100) / 10
    return `${k}k`
  }
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

function targetNumbers(target: VitalTarget | null): number[] {
  if (!target) return []
  if (target.kind === 'bp') return [target.upper, target.lower]
  if (target.kind === 'band') return [target.low, target.high]
  return [target.value]
}

export function MetricTrendChart({ values, unit, target, windowDays, today }: MetricTrendChartProps) {
  const { t, locale } = useLocale()
  const [selected, setSelected] = useState<string | null>(null)

  if (values.length === 0) {
    return (
      <div className="trend-chart trend-chart-empty">
        <p>No values in this window yet. Log from Today to see a trend.</p>
      </div>
    )
  }

  const from = addDays(today, -(windowDays - 1))
  const innerW = WIDTH - PAD_L - PAD_R
  const innerH = HEIGHT - PAD_T - PAD_B
  const isBp = target?.kind === 'bp'

  const numbers = [
    ...values.map((v) => v.value),
    ...values.flatMap((v) => (v.secondary == null ? [] : [v.secondary])),
    ...targetNumbers(target),
  ]
  const rawLo = Math.min(...numbers)
  const rawHi = Math.max(...numbers)
  const pad = (rawHi - rawLo || Math.max(1, Math.abs(rawHi) * 0.1)) * 0.12
  const lo = rawLo - pad
  const hi = rawHi + pad
  const span = hi - lo || 1

  const yOf = (v: number) => PAD_T + innerH - ((v - lo) / span) * innerH
  const xOf = (date: string) =>
    PAD_L +
    DOT_INSET +
    (Math.min(Math.max(daysBetween(from, date), 0), windowDays - 1) / Math.max(windowDays - 1, 1)) *
      (innerW - 2 * DOT_INSET)

  const tag = localeTag(locale)
  const short = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' })
  const long = new Intl.DateTimeFormat(tag, { weekday: 'short', day: 'numeric', month: 'short' })
  const midDate = addDays(from, Math.floor((windowDays - 1) / 2))

  const labelled = values.length <= MAX_LABELLED
  const points = values.map((v) => ({ ...v, x: xOf(v.date) }))
  const line = points.map((p) => `${p.x},${yOf(p.value)}`).join(' ')
  const yTicks = [rawHi, (rawHi + rawLo) / 2, rawLo].map((v) => Math.round(v * 10) / 10)
  const summary = withinTarget(target, values)
  const picked = selected ? values.find((v) => v.date === selected) ?? null : null

  const dotClass = (status: 'on' | 'off' | null) =>
    status === 'on' ? 'vital-dot-ok' : status === 'off' ? 'vital-dot-off' : 'trend-dot'

  return (
    <div className="trend-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="trend-chart-svg"
        role="img"
        aria-label={`${unit} trend chart`}
      >
        {yTicks.map((tick, i) => (
          <g key={`yt-${i}`}>
            <line x1={PAD_L} y1={yOf(tick)} x2={PAD_L + innerW} y2={yOf(tick)} className="trend-grid" />
            <text x={PAD_L - 4} y={yOf(tick) + 3} className="trend-axis-label" textAnchor="end">
              {shortNumber(tick)}
            </text>
          </g>
        ))}
        <line x1={PAD_L} y1={PAD_T + innerH} x2={PAD_L + innerW} y2={PAD_T + innerH} className="trend-axis" />

        {target?.kind === 'band' && (
          <rect
            x={PAD_L}
            y={yOf(target.high)}
            width={innerW}
            height={Math.max(yOf(target.low) - yOf(target.high), 0)}
            className="vital-band"
          />
        )}
        {targetNumbers(target).map((n) => (
          <g key={`tg-${n}`}>
            <line x1={PAD_L} y1={yOf(n)} x2={PAD_L + innerW} y2={yOf(n)} className="trend-target-line" />
            <text x={PAD_L + innerW + 4} y={yOf(n) + 3} className="vital-target-label">
              {shortNumber(n)}
            </text>
          </g>
        ))}

        {!isBp && points.length > 1 && <polyline points={line} className="trend-line" fill="none" />}

        {points.map((p) => {
          const status = pointStatus(target, p)
          const yUpper = yOf(p.value)
          const yLower = p.secondary == null ? yUpper : yOf(p.secondary)
          const ends = isBp && target?.kind === 'bp' ? bpEnds(target, p) : null
          return (
            <g key={p.date} className={selected === p.date ? 'vital-point vital-point-selected' : 'vital-point'}>
              {isBp && p.secondary != null && (
                <line x1={p.x} y1={yUpper} x2={p.x} y2={yLower} className="vital-bp-stem" />
              )}
              <circle cx={p.x} cy={yUpper} r={4} className={dotClass(ends ? ends.upper : status)} />
              {isBp && p.secondary != null && (
                <circle cx={p.x} cy={yLower} r={4} className={dotClass(ends?.lower ?? null)} />
              )}
              {labelled && (
                <text x={p.x} y={yUpper - 8} className="vital-point-label" textAnchor="middle">
                  {isBp && p.secondary != null ? `${shortNumber(p.value)}/${shortNumber(p.secondary)}` : shortNumber(p.value)}
                </text>
              )}
              <circle
                cx={p.x}
                cy={(yUpper + yLower) / 2}
                r={Math.max(11, Math.abs(yLower - yUpper) / 2 + 6)}
                className="vital-hit"
                role="button"
                tabIndex={0}
                aria-label={`${long.format(parseLocalDate(p.date))}: ${formatPair(p.value, p.secondary)} ${unit}`}
                onClick={() => setSelected((prev) => (prev === p.date ? null : p.date))}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelected((prev) => (prev === p.date ? null : p.date))
                  }
                }}
              />
            </g>
          )
        })}

        {[from, midDate, today].map((date, i) => (
          <text
            key={`xl-${date}`}
            x={PAD_L + (i / 2) * innerW}
            y={HEIGHT - 8}
            className="trend-axis-label"
            textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}
          >
            {short.format(parseLocalDate(date))}
          </text>
        ))}
      </svg>

      <div className="trend-chart-caption">
        <span>
          {picked
            ? `${long.format(parseLocalDate(picked.date))}: ${formatPair(picked.value, picked.secondary)} ${unit}`
            : !labelled
              ? t('vitalChart.tap')
              : null}
        </span>
        <span>{unit}</span>
      </div>

      {summary && (
        <div className="vital-summary">
          <p>{t('vitalChart.withinTarget', { met: summary.met, total: summary.total })}</p>
          <p className="vital-legend">
            <span className="vital-legend-dot vital-legend-ok" aria-hidden /> {t('vitalChart.on')}
            <span className="vital-legend-dot vital-legend-off" aria-hidden /> {t('vitalChart.off')}
          </p>
        </div>
      )}
    </div>
  )
}
