import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import TrustHistoryChart from './TrustHistoryChart'
import {
  getContrastRatio,
  getThemeTokens,
  readCss,
  resolveCssValue,
} from '../test/contrast'

vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

const points = [
  { score: 200, recordedAt: '2026-01-01T12:00:00Z' },
  { score: 650, recordedAt: '2026-02-01T12:00:00Z' },
  { score: 800, recordedAt: '2026-03-01T12:00:00Z' },
]

describe('TrustHistoryChart', () => {
  it('renders a labeled chart and keyboard-focusable points', () => {
    render(<TrustHistoryChart points={points} />)

    expect(screen.getByRole('heading', { name: 'Trust Score History' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: /Trust Score History/ })).toBeInTheDocument()

    const pointButtons = screen.getAllByRole('button', { name: /tier/ })
    expect(pointButtons).toHaveLength(3)
    pointButtons[1]?.focus()
    expect(pointButtons[1]).toHaveFocus()
  })

  it('toggles an accessible data table', () => {
    render(<TrustHistoryChart points={points} />)

    fireEvent.click(screen.getByRole('button', { name: 'Show data table' }))
    expect(screen.getByRole('table', { name: 'Trust score history data' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4)
  })

  it('degrades gracefully for no history', () => {
    render(<TrustHistoryChart points={[]} />)
    expect(screen.getByText('No trust score history is available yet.')).toBeInTheDocument()
  })

  it('degrades gracefully for a single observation', () => {
    render(<TrustHistoryChart points={[points[0]!]} />)
    expect(screen.getByText(/Only one score has been recorded/i)).toBeInTheDocument()
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('renders loading and error states', () => {
    const { rerender } = render(<TrustHistoryChart points={[]} isLoading />)
    expect(screen.getByRole('status')).toHaveTextContent('Loading trust score history')

    rerender(<TrustHistoryChart points={[]} error="History unavailable" />)
    expect(screen.getByRole('alert')).toHaveTextContent('History unavailable')
  })

  it('uses tier band and text tokens that meet contrast in both themes', () => {
    const css = readCss('src/index.css')

    for (const theme of [undefined, "[data-theme='dark']"] as const) {
      const tokens = getThemeTokens(css, theme)
      const text = resolveCssValue('var(--credence-text-primary)', tokens)
      const card = resolveCssValue('var(--credence-surface-card)', tokens)

      expect(getContrastRatio(text, card)).toBeGreaterThanOrEqual(4.5)

      for (const tier of ['bronze', 'silver', 'gold', 'platinum']) {
        const surface = resolveCssValue(
          `var(--credence-color-${tier}-surface)`,
          tokens
        )
        const border = resolveCssValue(
          `var(--credence-color-${tier}-border)`,
          tokens
        )
        expect(getContrastRatio(border, surface)).toBeGreaterThanOrEqual(3)
      }
    }
  })
})
