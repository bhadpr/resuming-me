import type { CSSProperties, ReactNode } from 'react'
import {
  compactNumber,
  donutSegments,
  donutSlices,
  formatInt,
  funnelRows,
  percentText,
  sparkHeights,
  type ChartRow,
  type FunnelStep,
  type Tone,
} from '../../lib/analyticsViz'
import './analytics-ui.css'

/**
 * Building blocks for the two admin analytics pages. Every block has a plain-language title, an
 * optional "What does this mean?", and its own color, so a page reads like a report and not a list.
 */

function toneStyle(tone: Tone): CSSProperties {
  return { ['--tone' as string]: `var(--an-${tone})` }
}

export function AnalyticsPage({ children }: { children: ReactNode }) {
  return <div className="analytics-screen an">{children}</div>
}

/** A short welcome that says what the page is for and how to read it. */
export function PageIntro({ title, also, children }: { title: string; also?: ReactNode; children: ReactNode }) {
  return (
    <header className="an-intro">
      <h2 className="an-intro-title">{title}</h2>
      <p className="an-intro-text">{children}</p>
      {also && <p className="an-intro-also">{also}</p>}
    </header>
  )
}

export interface NavItem {
  id: string
  label: string
}

/** Stays at the top while scrolling: the date range on one side, jump links to each section. */
export function StickyBar({ items, range }: { items: NavItem[]; range?: ReactNode }) {
  return (
    <div className="an-bar">
      {range && <div className="an-bar-range">{range}</div>}
      <nav className="an-bar-nav" aria-label="Sections">
        {items.map((item) => (
          <a
            key={item.id}
            href={`#${item.id}`}
            className="an-bar-link"
            onClick={(event) => {
              const target = document.getElementById(item.id)
              if (!target) return
              event.preventDefault()
              target.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </div>
  )
}

/** The 7 / 30 / 90 days switch. */
export function RangeToggle<T extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  label: string
}) {
  return (
    <div className="an-range" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={String(option.value)}
          type="button"
          className={`an-range-btn ${option.value === value ? 'an-range-btn-active' : ''}`}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** One section of a page: a colored card with a title, a one-line answer to "what is this?", and the content. */
export function Panel({
  id,
  title,
  lead,
  scope,
  tone = 'blue',
  help,
  children,
}: {
  id?: string
  title: string
  lead?: ReactNode
  /** The period the numbers cover, such as "Last 7 days". */
  scope?: string
  tone?: Tone
  /** Longer explanation, hidden until asked for. */
  help?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="an-panel" style={toneStyle(tone)}>
      <div className="an-panel-head">
        <div className="an-panel-titlebar">
          <h3 className="an-panel-title">{title}</h3>
          {scope && <span className="an-scope">{scope}</span>}
        </div>
        {lead && <p className="an-panel-lead">{lead}</p>}
        {help && (
          <details className="an-help">
            <summary>What does this mean?</summary>
            <div className="an-help-body">{help}</div>
          </details>
        )}
      </div>
      <div className="an-panel-body">{children}</div>
    </section>
  )
}

/** A smaller titled block inside a panel, such as one chart. */
export function Block({
  title,
  note,
  section = false,
  children,
}: {
  title: string
  note?: ReactNode
  /** A bigger heading for a group of charts, such as "Marketing site". */
  section?: boolean
  children: ReactNode
}) {
  return (
    <div className={`an-block ${section ? 'an-block-section' : ''}`}>
      <h4 className="an-block-title">{title}</h4>
      {note && <p className="an-block-note">{note}</p>}
      {children}
    </div>
  )
}

export function Grid({ children, columns = 2 }: { children: ReactNode; columns?: 2 | 3 }) {
  return <div className={`an-grid an-grid-${columns}`}>{children}</div>
}

export function KpiGrid({ children }: { children: ReactNode }) {
  return <div className="an-kpis">{children}</div>
}

/** One big number with a name and a plain hint. The spark line is optional. */
export function Kpi({
  label,
  value,
  hint,
  tone = 'blue',
  spark,
}: {
  label: string
  value: string
  hint?: string
  tone?: Tone
  spark?: number[]
}) {
  return (
    <div className="an-kpi" style={toneStyle(tone)}>
      <span className="an-kpi-label">{label}</span>
      <span className="an-kpi-value">{value}</span>
      {hint && <span className="an-kpi-hint">{hint}</span>}
      {spark && spark.length > 1 && <Sparkline values={spark} />}
    </div>
  )
}

export function Sparkline({ values }: { values: number[] }) {
  const heights = sparkHeights(values)
  return (
    <span className="an-spark" aria-hidden>
      {heights.map((height, index) => (
        <span key={index} className="an-spark-bar" style={{ height: `${Math.max(height, 6)}%` }} />
      ))}
    </span>
  )
}

/** A callout for the small print: what a number leaves out. */
export function Note({ title = 'Good to know', tone = 'slate', children }: { title?: string; tone?: Tone; children: ReactNode }) {
  return (
    <aside className="an-note" style={toneStyle(tone)}>
      <strong className="an-note-title">{title}</strong>
      <span>{children}</span>
    </aside>
  )
}

export function Loading({ children = 'Loading…' }: { children?: ReactNode }) {
  return (
    <div className="an-loading" role="status">
      <span className="an-skeleton" />
      <span className="an-skeleton an-skeleton-short" />
      <span className="an-visually-hidden">{children}</span>
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="an-empty">{children}</p>
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p className="an-error" role="alert">
      {children}
    </p>
  )
}

const RING = 2 * Math.PI * 46

/**
 * A pie (donut) with the share of each part beside it. Only the biggest parts get their own
 * slice; the rest are grouped as "Other" so it stays readable.
 */
export function Donut({
  rows,
  centerValue,
  centerLabel,
  max = 6,
  label,
  empty = 'Nothing to show yet.',
}: {
  rows: ChartRow[]
  centerValue?: string
  centerLabel?: string
  max?: number
  label?: string
  empty?: string
}) {
  const slices = donutSlices(rows, max)
  if (slices.length === 0) return <Empty>{empty}</Empty>
  const total = slices.reduce((sum, slice) => sum + slice.count, 0)
  const segments = donutSegments(slices, RING)
  const summary = slices.map((slice) => `${slice.label} ${Math.round(slice.share * 100)}%`).join(', ')
  return (
    <div className="an-donut">
      <div className="an-donut-ring">
        <svg viewBox="0 0 120 120" role="img" aria-label={`${label ?? 'Share'}: ${summary}`}>
          <circle className="an-donut-track" cx="60" cy="60" r="46" />
          {slices.map((slice, index) => (
            <circle
              key={slice.key}
              className="an-donut-slice"
              cx="60"
              cy="60"
              r="46"
              style={{ stroke: `var(--an-${slice.tone})` }}
              strokeDasharray={`${segments[index].dash} ${segments[index].gap}`}
              strokeDashoffset={segments[index].offset}
              transform="rotate(-90 60 60)"
            />
          ))}
        </svg>
        <div className="an-donut-center">
          <span className="an-donut-total">{centerValue ?? compactNumber(total)}</span>
          {(centerLabel ?? 'total') && <span className="an-donut-caption">{centerLabel ?? 'total'}</span>}
        </div>
      </div>
      <ul className="an-legend">
        {slices.map((slice) => (
          <li key={slice.key} className="an-legend-row">
            <span className="an-dot" style={{ background: `var(--an-${slice.tone})` }} aria-hidden />
            <span className="an-legend-label">{slice.label}</span>
            <span className="an-legend-value">
              {Math.round(slice.share * 100)}% <small>{formatInt(slice.count)}</small>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** A ranked list with a colored bar behind each value. */
export function BarList({
  rows,
  tone = 'blue',
  empty = 'Nothing to show yet.',
  showShare = false,
}: {
  rows: Array<ChartRow & { note?: string }>
  tone?: Tone
  empty?: string
  /** Add the share of the total next to each value. */
  showShare?: boolean
}) {
  if (rows.length === 0) return <Empty>{empty}</Empty>
  const max = Math.max(...rows.map((row) => row.count), 1)
  const total = rows.reduce((sum, row) => sum + row.count, 0)
  return (
    <ul className="an-bars" style={toneStyle(tone)}>
      {rows.map((row) => (
        <li key={row.key} className="an-bars-row">
          <div className="an-bars-meta">
            <span className="an-bars-label">{row.label}</span>
            <span className="an-bars-value">
              {formatInt(row.count)}
              {showShare && <small> {percentText(row.count, total)}</small>}
            </span>
          </div>
          <div className="an-bars-track" aria-hidden>
            <div className="an-bars-fill" style={{ width: `${Math.max(2, Math.round((row.count / max) * 100))}%` }} />
          </div>
          {row.note && <span className="an-bars-note">{row.note}</span>}
        </li>
      ))}
    </ul>
  )
}

/**
 * Steps people go through, each bar sized against the first. Under each step: how many are left
 * and how many dropped off since the step before, so the weak spot is easy to see.
 */
export function Funnel({ steps, tone = 'blue' }: { steps: FunnelStep[]; tone?: Tone }) {
  const rows = funnelRows(steps)
  if (rows.length === 0 || rows[0].value === 0) return <Empty>Nobody has reached the first step yet.</Empty>
  const worst = rows.reduce<number | null>((pick, row, index) => {
    if (index === 0 || row.ofPrevious == null) return pick
    return pick == null || row.ofPrevious < (rows[pick].ofPrevious ?? 1) ? index : pick
  }, null)
  return (
    <ol className="an-funnel" style={toneStyle(tone)}>
      {rows.map((row, index) => (
        <li key={`${row.label}-${index}`} className="an-funnel-row">
          <div className="an-funnel-meta">
            <span className="an-funnel-label">{row.label}</span>
            <span className="an-funnel-value">{formatInt(row.value)}</span>
          </div>
          <div className="an-funnel-track" aria-hidden>
            <div
              className="an-funnel-fill"
              style={{ width: `${Math.max(1.5, Math.round((row.ofFirst ?? 0) * 100))}%`, opacity: 1 - Math.min(index, 6) * 0.08 }}
            />
          </div>
          <div className="an-funnel-sub">
            {index === 0 ? (
              <span>Start</span>
            ) : (
              <>
                <span>{percentText(row.value, rows[0].value)} of the start</span>
                {row.ofPrevious != null && (
                  <span className={index === worst ? 'an-funnel-worst' : 'an-funnel-lost'}>
                    {row.lost > 0 ? `−${formatInt(row.lost)} lost (${percentText(row.lost, rows[index - 1].value)})` : 'nobody lost'}
                    {index === worst && row.lost > 0 ? ' · biggest drop' : ''}
                  </span>
                )}
              </>
            )}
            {row.hint && <span className="an-funnel-hint">{row.hint}</span>}
          </div>
        </li>
      ))}
    </ol>
  )
}

export interface ColumnPoint {
  label: string
  title?: string
  values: number[]
  /** The period is still running, so it is drawn lighter. */
  partial?: boolean
}

/**
 * Columns over time. One series is a single column per point; two series sit side by side, such
 * as "added" and "done". Value labels show only when there is room.
 */
export function Columns({
  points,
  series,
  labelEvery = 1,
  peakLabel = 'Peak',
  empty = 'Nothing yet.',
}: {
  points: ColumnPoint[]
  series: Array<{ name: string; tone: Tone }>
  labelEvery?: number
  peakLabel?: string
  empty?: string
}) {
  const max = Math.max(...points.flatMap((point) => point.values), 0)
  if (points.length === 0 || max === 0) return <Empty>{empty}</Empty>
  const showValues = points.length <= 16
  return (
    <figure className="an-columns">
      {series.length > 1 && (
        <figcaption className="an-columns-legend">
          {series.map((item) => (
            <span key={item.name} className="an-columns-key">
              <span className="an-dot" style={{ background: `var(--an-${item.tone})` }} aria-hidden />
              {item.name}
            </span>
          ))}
        </figcaption>
      )}
      <p className="an-columns-peak">
        {peakLabel}: {formatInt(max)}
      </p>
      <div className="an-columns-plot" style={{ gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))` }}>
        {points.map((point, index) => (
          <div
            key={`${point.label}-${index}`}
            className={`an-col ${point.partial ? 'an-col-partial' : ''}`}
            title={point.title ?? `${point.label}: ${point.values.map(formatInt).join(' / ')}`}
          >
            <div className="an-col-bars">
              {point.values.map((value, seriesIndex) => (
                <div key={seriesIndex} className="an-col-slot">
                  {showValues && <span className="an-col-value">{value > 0 ? compactNumber(value) : ''}</span>}
                  <div
                    className="an-col-bar"
                    style={{
                      height: `${value > 0 ? Math.max(3, Math.round((value / max) * 100)) : 0}%`,
                      background: `var(--an-${series[seriesIndex]?.tone ?? 'blue'})`,
                    }}
                  />
                </div>
              ))}
            </div>
            <span className="an-col-label">{index % labelEvery === 0 ? point.label : ''}</span>
          </div>
        ))}
      </div>
    </figure>
  )
}

/** A colored pill, such as a kind of error or a version. */
export function Pill({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className="an-pill" style={toneStyle(tone)}>
      {children}
    </span>
  )
}
