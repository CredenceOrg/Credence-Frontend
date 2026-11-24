import { useId, useState } from 'react'
import type { TrustScoreHistoryPoint } from '../api/types'
import { useReducedMotion } from '../hooks/useReducedMotion'
import { MAX_SCORE } from '../lib/tiers'
import { TIER_THRESHOLDS, tierForScore } from '../lib/tier'
import './TrustHistoryChart.css'

interface TrustHistoryChartProps {
  points: TrustScoreHistoryPoint[]
  isLoading?: boolean
  error?: string
}

const WIDTH = 720
const HEIGHT = 260
const PADDING = { top: 20, right: 24, bottom: 40, left: 48 }

function formatDate(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function TrustHistoryChart({
  points,
  isLoading = false,
  error,
}: TrustHistoryChartProps) {
  const [showTable, setShowTable] = useState(false)
  const [activePoint, setActivePoint] = useState<number | null>(null)
  const reducedMotion = useReducedMotion()
  const titleId = useId()
  const descriptionId = useId()
  const tableId = useId()

  if (isLoading) {
    return (
      <section className="trustHistory" aria-label="Trust score history" aria-busy="true">
        <p role="status">Loading trust score history</p>
      </section>
    )
  }

  if (error) {
    return (
      <section className="trustHistory" aria-label="Trust score history">
        <p role="alert">{error}</p>
      </section>
    )
  }

  if (points.length === 0) {
    return (
      <section className="trustHistory" aria-label="Trust score history">
        <h3 className="trustHistory__title">Trust Score History</h3>
        <p>No trust score history is available yet.</p>
      </section>
    )
  }

  if (points.length === 1) {
    const point = points[0]
    return (
      <section className="trustHistory" aria-label="Trust score history">
        <h3 className="trustHistory__title">Trust Score History</h3>
        <p>Only one score has been recorded: <strong>{point.score}</strong> on {formatDate(point.recordedAt)}.</p>
        <table className="trustHistory__table">
          <caption>Trust score history</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Score</th><th scope="col">Tier</th></tr></thead>
          <tbody><tr><td>{formatDate(point.recordedAt)}</td><td>{point.score}</td><td>{tierForScore(point.score)}</td></tr></tbody>
        </table>
      </section>
    )
  }

  const plotWidth = WIDTH - PADDING.left - PADDING.right
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom
  const x = (index: number) => PADDING.left + (index / (points.length - 1)) * plotWidth
  const y = (score: number) => PADDING.top + (1 - score / MAX_SCORE) * plotHeight
  const coords = points.map((point, index) => ({ x: x(index), y: y(point.score), point }))
  const linePath = coords.map((coord, index) => `${index === 0 ? 'M' : 'L'} ${coord.x} ${coord.y}`).join(' ')

  const bands = [
    { name: 'Bronze', min: TIER_THRESHOLDS.bronze.min, max: TIER_THRESHOLDS.bronze.max, className: 'bronze' },
    { name: 'Silver', min: TIER_THRESHOLDS.silver.min, max: TIER_THRESHOLDS.silver.max, className: 'silver' },
    { name: 'Gold', min: TIER_THRESHOLDS.gold.min, max: TIER_THRESHOLDS.gold.max, className: 'gold' },
    { name: 'Platinum', min: TIER_THRESHOLDS.platinum.min, max: 1000, className: 'platinum' },
  ]

  return (
    <section className="trustHistory" aria-labelledby={titleId}>
      <div className="trustHistory__header">
        <h3 id={titleId} className="trustHistory__title">Trust Score History</h3>
        <button
          type="button"
          className="trustHistory__tableToggle"
          aria-expanded={showTable}
          aria-controls={tableId}
          onClick={() => setShowTable((visible) => !visible)}
        >
          {showTable ? 'Hide data table' : 'Show data table'}
        </button>
      </div>

      <svg
        className="trustHistory__chart"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-labelledby={`${titleId} ${descriptionId}`}
        aria-describedby={descriptionId}
      >
        <desc id={descriptionId}>Line chart of trust score observations across four tier bands.</desc>
        {bands.map((band) => {
          const top = y(band.max)
          const bottom = y(band.min)
          return (
            <rect
              key={band.name}
              className={`trustHistory__band trustHistory__band--${band.className}`}
              x={PADDING.left}
              y={top}
              width={plotWidth}
              height={Math.max(0, bottom - top)}
              aria-label={`${band.name} tier band`}
            />
          )
        })}
        {[0, 250, 500, 750, 1000].map((tick) => (
          <g key={tick} className="trustHistory__tick">
            <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y(tick)} y2={y(tick)} />
            <text x={PADDING.left - 8} y={y(tick) + 4} textAnchor="end">{tick}</text>
          </g>
        ))}
        <path
          className={`trustHistory__line${reducedMotion ? ' trustHistory__line--noMotion' : ''}`}
          d={linePath}
          fill="none"
        />
        {coords.map(({ x: cx, y: cy, point }, index) => (
          <g key={`${point.recordedAt}-${index}`}>
            <circle
              className="trustHistory__point"
              cx={cx}
              cy={cy}
              r="7"
              tabIndex={0}
              role="button"
              aria-label={`${formatDate(point.recordedAt)}, score ${point.score}, ${tierForScore(point.score)} tier`}
              onFocus={() => setActivePoint(index)}
              onBlur={() => setActivePoint(null)}
              onMouseEnter={() => setActivePoint(index)}
              onMouseLeave={() => setActivePoint(null)}
            />
            {activePoint === index && (
              <g className="trustHistory__tooltip" role="tooltip" aria-hidden="true">
                <rect x={Math.min(WIDTH - 170, Math.max(PADDING.left, cx - 75))} y={Math.max(4, cy - 58)} width="150" height="44" rx="6" />
                <text x={Math.min(WIDTH - 95, Math.max(PADDING.left + 75, cx))} y={Math.max(26, cy - 36)} textAnchor="middle">
                  {point.score} · {formatDate(point.recordedAt)}
                </text>
              </g>
            )}
          </g>
        ))}
      </svg>

      {showTable && (
        <table id={tableId} className="trustHistory__table">
          <caption>Trust score history data</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">Score</th><th scope="col">Tier</th></tr></thead>
          <tbody>
            {points.map((point, index) => (
              <tr key={`${point.recordedAt}-${index}`}>
                <td>{formatDate(point.recordedAt)}</td>
                <td>{point.score}</td>
                <td>{tierForScore(point.score)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
