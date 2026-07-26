import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import AnalyticsWidget from './AnalyticsWidget'
import type { AnalyticsPeriodData } from './AnalyticsWidget'

// CSS modules are not processed in the test environment.
vi.mock('./AnalyticsWidget.css', () => ({}))
vi.mock('./controls/Toggle.css', () => ({}))
vi.mock('./controls/controls.css', () => ({}))

// ── Fixtures ─────────────────────────────────────────────────────────────────

const currentPeriod: AnalyticsPeriodData = {
  label: 'Jul 2026',
  metrics: [
    { label: 'Trust Score', value: 684 },
    { label: 'Active Bonds', value: 3 },
    {
      label: 'Total Bonded',
      value: 4250,
      format: (v) => v.toLocaleString(),
      unit: 'USDC',
    },
  ],
}

const previousPeriod: AnalyticsPeriodData = {
  label: 'Jun 2026',
  metrics: [
    { label: 'Trust Score', value: 612 },
    { label: 'Active Bonds', value: 2 },
    {
      label: 'Total Bonded',
      value: 3100,
      format: (v) => v.toLocaleString(),
      unit: 'USDC',
    },
  ],
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AnalyticsWidget', () => {
  // ── Rendering ──────────────────────────────────────────────────────────────

  describe('rendering', () => {
    it('renders the widget title', () => {
      render(<AnalyticsWidget title="Analytics Overview" currentPeriod={currentPeriod} />)
      expect(screen.getByRole('heading', { name: 'Analytics Overview' })).toBeInTheDocument()
    })

    it('renders the current period label', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      expect(screen.getByText('Jul 2026')).toBeInTheDocument()
    })

    it('renders metric labels and values for the current period', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      expect(screen.getByText('Trust Score')).toBeInTheDocument()
      expect(screen.getByText('684')).toBeInTheDocument()
      expect(screen.getByText('Active Bonds')).toBeInTheDocument()
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('formats metric values using the format function', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      // 4250 with .toLocaleString() + unit 'USDC'
      expect(screen.getByText(/4,250 USDC/)).toBeInTheDocument()
    })

    it('renders the unit suffix after the formatted value', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      expect(screen.getByText(/USDC/)).toBeInTheDocument()
    })

    it('uses String(value) as fallback when no format function is given', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      // Active Bonds — value 3 with no format
      expect(screen.getByText('3')).toBeInTheDocument()
    })

    it('renders as a <section> landmark with an accessible name', () => {
      render(<AnalyticsWidget title="Analytics Overview" currentPeriod={currentPeriod} />)
      expect(screen.getByRole('region', { name: 'Analytics Overview' })).toBeInTheDocument()
    })
  })

  // ── Compare toggle absent when no previousPeriod ───────────────────────────

  describe('no previousPeriod', () => {
    it('does not render the compare toggle when previousPeriod is omitted', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      expect(screen.queryByRole('switch')).toBeNull()
      expect(screen.queryByText('Compare periods')).toBeNull()
    })

    it('does not render the previous period label', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      expect(screen.queryByText('Jun 2026')).toBeNull()
    })
  })

  // ── Compare toggle present when previousPeriod is provided ─────────────────

  describe('with previousPeriod', () => {
    it('renders the compare toggle when previousPeriod is provided', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )
      expect(screen.getByRole('switch', { name: /compare/i })).toBeInTheDocument()
    })

    it('renders a visible "Compare periods" label next to the toggle', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )
      expect(screen.getByText('Compare periods')).toBeInTheDocument()
    })

    it('toggle is off by default (uncontrolled)', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )
      expect(screen.getByRole('switch')).not.toBeChecked()
    })

    it('previous period column is hidden when toggle is off', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )
      expect(screen.queryByText('Jun 2026')).toBeNull()
    })

    it('current period column is always visible', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )
      expect(screen.getByText('Jul 2026')).toBeInTheDocument()
    })
  })

  // ── Uncontrolled toggle behaviour ──────────────────────────────────────────

  describe('uncontrolled toggle', () => {
    it('shows previous period column after toggling on', async () => {
      const user = userEvent.setup()
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )

      await user.click(screen.getByRole('switch'))

      expect(screen.getByText('Jun 2026')).toBeInTheDocument()
      expect(screen.getByText('Jul 2026')).toBeInTheDocument()
    })

    it('hides previous period column after toggling back off', async () => {
      const user = userEvent.setup()
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          defaultCompare
        />,
      )

      // Start with comparison on — previous period should be visible
      expect(screen.getByText('Jun 2026')).toBeInTheDocument()

      await user.click(screen.getByRole('switch'))

      expect(screen.queryByText('Jun 2026')).toBeNull()
    })

    it('respects defaultCompare=true by showing both columns immediately', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          defaultCompare
        />,
      )
      expect(screen.getByText('Jun 2026')).toBeInTheDocument()
      expect(screen.getByText('Jul 2026')).toBeInTheDocument()
    })

    it('toggle is checked when defaultCompare=true', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          defaultCompare
        />,
      )
      expect(screen.getByRole('switch')).toBeChecked()
    })

    it('both period metric values are visible when comparing', async () => {
      const user = userEvent.setup()
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )

      await user.click(screen.getByRole('switch'))

      // Current period values
      expect(screen.getByText('684')).toBeInTheDocument()
      // Previous period values
      expect(screen.getByText('612')).toBeInTheDocument()
    })

    it('calls onCompareChange with true when toggling on', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          onCompareChange={handleChange}
        />,
      )

      await user.click(screen.getByRole('switch'))

      expect(handleChange).toHaveBeenCalledOnce()
      expect(handleChange).toHaveBeenCalledWith(true)
    })

    it('calls onCompareChange with false when toggling off', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          defaultCompare
          onCompareChange={handleChange}
        />,
      )

      await user.click(screen.getByRole('switch'))

      expect(handleChange).toHaveBeenCalledOnce()
      expect(handleChange).toHaveBeenCalledWith(false)
    })
  })

  // ── Controlled toggle behaviour ────────────────────────────────────────────

  describe('controlled toggle', () => {
    it('shows previous period when compareEnabled=true', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          compareEnabled
          onCompareChange={vi.fn()}
        />,
      )
      expect(screen.getByText('Jun 2026')).toBeInTheDocument()
    })

    it('hides previous period when compareEnabled=false', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          compareEnabled={false}
          onCompareChange={vi.fn()}
        />,
      )
      expect(screen.queryByText('Jun 2026')).toBeNull()
    })

    it('toggle reflects the compareEnabled prop value', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          compareEnabled
          onCompareChange={vi.fn()}
        />,
      )
      expect(screen.getByRole('switch')).toBeChecked()
    })

    it('fires onCompareChange with the next value when toggled', async () => {
      const user = userEvent.setup()
      const handleChange = vi.fn()
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          compareEnabled
          onCompareChange={handleChange}
        />,
      )

      await user.click(screen.getByRole('switch'))

      expect(handleChange).toHaveBeenCalledOnce()
      expect(handleChange).toHaveBeenCalledWith(false)
    })

    it('does not change internal state when toggle is clicked in controlled mode', async () => {
      const user = userEvent.setup()
      // onCompareChange is a no-op — the parent decides not to update the prop.
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
          compareEnabled={false}
          onCompareChange={vi.fn()}
        />,
      )

      await user.click(screen.getByRole('switch'))

      // Previous period should remain hidden because compareEnabled is still false.
      expect(screen.queryByText('Jun 2026')).toBeNull()
    })
  })

  // ── className prop ─────────────────────────────────────────────────────────

  describe('className prop', () => {
    it('appends extra class names to the root element', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          className="my-custom-class"
        />,
      )
      expect(document.querySelector('.analytics-widget')).toHaveClass('my-custom-class')
    })

    it('does not add trailing whitespace to className when empty', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      const root = document.querySelector('.analytics-widget')
      expect(root?.className).not.toMatch(/^\s|\s$/)
    })
  })

  // ── Accessibility ──────────────────────────────────────────────────────────

  describe('accessibility', () => {
    it('toggle has a descriptive accessible name', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )
      const toggle = screen.getByRole('switch')
      expect(toggle).toHaveAttribute('aria-label')
      expect(toggle.getAttribute('aria-label')?.length).toBeGreaterThan(0)
    })

    it('toggle label is associated with the toggle via htmlFor/id', () => {
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )
      const label = screen.getByText('Compare periods').closest('label')
      const toggle = screen.getByRole('switch')
      expect(label).not.toBeNull()
      expect(label?.htmlFor).toBe(toggle.id)
    })

    it('period columns have aria-label for assistive technology', async () => {
      const user = userEvent.setup()
      render(
        <AnalyticsWidget
          title="Test"
          currentPeriod={currentPeriod}
          previousPeriod={previousPeriod}
        />,
      )

      await user.click(screen.getByRole('switch'))

      const currentCol = screen.getByLabelText('Jul 2026 metrics')
      const previousCol = screen.getByLabelText('Jun 2026 metrics')
      expect(currentCol).toBeInTheDocument()
      expect(previousCol).toBeInTheDocument()
    })

    it('metrics use a <dl> definition list', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      expect(document.querySelector('dl.analytics-widget__metrics')).not.toBeNull()
    })

    it('metric labels render as <dt> elements', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      const terms = document.querySelectorAll('dt.analytics-widget__metric-label')
      expect(terms.length).toBeGreaterThan(0)
    })

    it('metric values render as <dd> elements', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      const defs = document.querySelectorAll('dd.analytics-widget__metric-value')
      expect(defs.length).toBeGreaterThan(0)
    })

    it('title is an <h2> element', () => {
      render(<AnalyticsWidget title="Analytics Overview" currentPeriod={currentPeriod} />)
      const heading = screen.getByRole('heading', { name: 'Analytics Overview', level: 2 })
      expect(heading).toBeInTheDocument()
    })
  })

  // ── Edge cases ─────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('renders multiple metrics correctly', () => {
      render(<AnalyticsWidget title="Test" currentPeriod={currentPeriod} />)
      expect(screen.getByText('Trust Score')).toBeInTheDocument()
      expect(screen.getByText('Active Bonds')).toBeInTheDocument()
      expect(screen.getByText('Total Bonded')).toBeInTheDocument()
    })

    it('renders with a single metric', () => {
      render(
        <AnalyticsWidget
          title="Single"
          currentPeriod={{ label: 'Jul', metrics: [{ label: 'Score', value: 100 }] }}
        />,
      )
      expect(screen.getByText('Score')).toBeInTheDocument()
      expect(screen.getByText('100')).toBeInTheDocument()
    })

    it('renders zero value metrics', () => {
      render(
        <AnalyticsWidget
          title="Zero"
          currentPeriod={{ label: 'Jul', metrics: [{ label: 'Bonds', value: 0 }] }}
        />,
      )
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('renders large numbers', () => {
      render(
        <AnalyticsWidget
          title="Big"
          currentPeriod={{
            label: 'Jul',
            metrics: [
              {
                label: 'Volume',
                value: 1000000,
                format: (v) => v.toLocaleString(),
              },
            ],
          }}
        />,
      )
      expect(screen.getByText('1,000,000')).toBeInTheDocument()
    })
  })
})
