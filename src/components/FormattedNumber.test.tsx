import { render, screen } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import FormattedNumber from './FormattedNumber'

// CSS module mock — consistent with the rest of the test suite
vi.mock('./FormattedNumber.css', () => ({}))

// Mock react-i18next so locale resolution from i18next is testable
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en-US' },
  }),
}))

// ---------------------------------------------------------------------------
// formatNumber (unit tests on the underlying utility)
// ---------------------------------------------------------------------------
import { formatNumber } from '../lib/format'

describe('formatNumber utility', () => {
  it('formats a decimal number with en-US locale by default', () => {
    expect(formatNumber(1234567.89)).toBe('1,234,567.89')
  })

  it('formats with de-DE locale — dot thousands, comma decimal', () => {
    // de-DE uses '.' as thousands separator and ',' as decimal separator
    const result = formatNumber(1234.5, { locale: 'de-DE' })
    expect(result).toContain('1')
    expect(result).toContain('234')
    // The result should contain a comma for the decimal
    expect(result).toContain(',')
    expect(result).toMatch(/1[.,\s]?234[,.]5/)
  })

  it('formats currency with symbol placement', () => {
    const result = formatNumber(99.99, {
      locale: 'en-US',
      style: 'currency',
      currency: 'USD',
    })
    expect(result).toContain('99.99')
    expect(result).toMatch(/\$/)
  })

  it('formats percent style — multiplies by 100 and appends %', () => {
    const result = formatNumber(0.125, { style: 'percent', locale: 'en-US' })
    expect(result).toContain('12')
    expect(result).toContain('%')
  })

  it('returns em-dash for NaN', () => {
    expect(formatNumber(NaN)).toBe('—')
  })

  it('returns em-dash for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('—')
  })

  it('returns em-dash for -Infinity', () => {
    expect(formatNumber(-Infinity)).toBe('—')
  })

  it('respects minimumFractionDigits and maximumFractionDigits', () => {
    expect(formatNumber(1.1, { minimumFractionDigits: 3, maximumFractionDigits: 3 })).toBe('1.100')
  })

  it('respects maximumFractionDigits = 0 for whole numbers', () => {
    expect(formatNumber(1234, { minimumFractionDigits: 0, maximumFractionDigits: 0 })).toBe('1,234')
  })

  it('handles zero correctly', () => {
    expect(formatNumber(0)).toBe('0.00')
  })

  it('handles negative numbers', () => {
    const result = formatNumber(-1234.5, { locale: 'en-US' })
    expect(result).toMatch(/-/)
    expect(result).toContain('1,234')
  })

  it('formats large numbers with correct grouping', () => {
    expect(formatNumber(1000000, { locale: 'en-US' })).toBe('1,000,000.00')
  })

  it('handles currency without explicit locale (defaults to en-US)', () => {
    const result = formatNumber(9.99, { style: 'currency', currency: 'EUR' })
    // Should contain EUR code or symbol
    expect(result).toMatch(/EUR|€/)
    expect(result).toContain('9.99')
  })

  it('uses USD as default currency when style=currency and no currency given', () => {
    const result = formatNumber(9.99, { style: 'currency', locale: 'en-US' })
    expect(result).toMatch(/\$/)
  })

  it('formats currency with narrowSymbol display', () => {
    const result = formatNumber(9.99, {
      style: 'currency',
      currency: 'USD',
      currencyDisplay: 'code',
      locale: 'en-US',
    })
    expect(result).toContain('USD')
  })

  it('formats percent with custom fraction digits', () => {
    const result = formatNumber(0.5, {
      style: 'percent',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      locale: 'en-US',
    })
    expect(result).toBe('50%')
  })

  it('respects significantDigits props (overrides fractionDigits)', () => {
    const result = formatNumber(123.456789, {
      minimumSignificantDigits: 3,
      maximumSignificantDigits: 5,
      locale: 'en-US',
    })
    // With 5 significant digits, 123.456789 → 123.46
    expect(result).toBe('123.46')
  })
})

// ---------------------------------------------------------------------------
// <FormattedNumber> component tests
// ---------------------------------------------------------------------------
describe('FormattedNumber component', () => {
  describe('basic rendering', () => {
    it('renders as a <span>', () => {
      render(<FormattedNumber value={1234} />)
      const el = document.querySelector('span.formatted-number')
      expect(el).not.toBeNull()
    })

    it('renders a formatted number string', () => {
      render(<FormattedNumber value={1234} />)
      const el = document.querySelector('.formatted-number')
      expect(el?.textContent).toContain('1,234')
    })

    it('applies default 2 decimal places', () => {
      render(<FormattedNumber value={1000} />)
      expect(document.querySelector('.formatted-number')?.textContent).toContain('1,000.00')
    })
  })

  describe('locale prop', () => {
    it('uses en-US formatting when locale="en-US"', () => {
      render(<FormattedNumber value={1234.5} locale="en-US" />)
      const text = document.querySelector('.formatted-number')?.textContent ?? ''
      expect(text).toContain('1,234')
    })

    it('renders em-dash for non-finite value', () => {
      render(<FormattedNumber value={NaN} />)
      expect(document.querySelector('.formatted-number')?.textContent).toBe('—')
    })
  })

  describe('style prop', () => {
    it('renders percent style', () => {
      render(
        <FormattedNumber
          value={0.5}
          numberStyle="percent"
          minimumFractionDigits={0}
          maximumFractionDigits={0}
          locale="en-US"
        />
      )
      expect(document.querySelector('.formatted-number')?.textContent).toContain('%')
    })

    it('renders currency style with USD symbol', () => {
      render(<FormattedNumber value={9.99} numberStyle="currency" currency="USD" locale="en-US" />)
      const text = document.querySelector('.formatted-number')?.textContent ?? ''
      expect(text).toMatch(/\$/)
      expect(text).toContain('9.99')
    })
  })

  describe('aria-label', () => {
    it('sets a default aria-label equal to the raw numeric value for decimal style', () => {
      render(<FormattedNumber value={1234} />)
      const el = document.querySelector('.formatted-number')
      expect(el).toHaveAttribute('aria-label', '1234')
    })

    it('uses the ariaLabel prop when provided', () => {
      render(<FormattedNumber value={1234} ariaLabel="Bond amount: 1234" />)
      expect(document.querySelector('.formatted-number')).toHaveAttribute(
        'aria-label',
        'Bond amount: 1234'
      )
    })

    it('sets aria-label to "not a number" for NaN', () => {
      render(<FormattedNumber value={NaN} />)
      expect(document.querySelector('.formatted-number')).toHaveAttribute(
        'aria-label',
        'not a number'
      )
    })

    it('sets aria-label to "not a number" for Infinity', () => {
      render(<FormattedNumber value={Infinity} />)
      expect(document.querySelector('.formatted-number')).toHaveAttribute(
        'aria-label',
        'not a number'
      )
    })

    it('includes currency in default aria-label for currency style', () => {
      render(<FormattedNumber value={99} numberStyle="currency" currency="EUR" locale="de-DE" />)
      const label = document.querySelector('.formatted-number')?.getAttribute('aria-label') ?? ''
      expect(label).toContain('EUR')
      expect(label).toContain('99')
    })

    it('includes "percent" in default aria-label for percent style', () => {
      render(<FormattedNumber value={0.12} numberStyle="percent" locale="en-US" />)
      const label = document.querySelector('.formatted-number')?.getAttribute('aria-label') ?? ''
      expect(label).toContain('percent')
    })
  })

  describe('srPrefix', () => {
    it('does not render a sr span when srPrefix is omitted', () => {
      render(<FormattedNumber value={100} />)
      expect(document.querySelector('.formatted-number__sr')).toBeNull()
    })

    it('renders a visually hidden sr span when srPrefix is provided', () => {
      render(<FormattedNumber value={100} srPrefix="Bond amount:" />)
      const srEl = document.querySelector('.formatted-number__sr')
      expect(srEl).not.toBeNull()
      expect(srEl?.textContent).toContain('Bond amount:')
    })

    it('full text content includes both prefix and formatted value', () => {
      render(<FormattedNumber value={50000} srPrefix="Total:" locale="en-US" />)
      const el = document.querySelector('.formatted-number')
      expect(el?.textContent).toContain('Total:')
      expect(el?.textContent).toContain('50,000')
    })
  })

  describe('className prop', () => {
    it('merges additional className with base class', () => {
      render(<FormattedNumber value={1} className="my-class" />)
      const el = document.querySelector('.formatted-number')
      expect(el).toHaveClass('my-class')
    })

    it('does not produce leading/trailing whitespace in className', () => {
      render(<FormattedNumber value={1} />)
      const el = document.querySelector('.formatted-number')
      expect(el?.className).not.toMatch(/^\s|\s$/)
    })
  })

  describe('precision props', () => {
    it('respects minimumFractionDigits=0 and maximumFractionDigits=0', () => {
      render(
        <FormattedNumber
          value={1234.56}
          minimumFractionDigits={0}
          maximumFractionDigits={0}
          locale="en-US"
        />
      )
      // Should round to whole number — no decimal point
      const text = document.querySelector('.formatted-number')?.textContent ?? ''
      expect(text).not.toContain('.')
    })

    it('respects minimumFractionDigits=4', () => {
      render(
        <FormattedNumber
          value={1.1}
          minimumFractionDigits={4}
          maximumFractionDigits={4}
          locale="en-US"
        />
      )
      expect(document.querySelector('.formatted-number')?.textContent).toContain('1.1000')
    })
  })

  describe('native HTML attributes are forwarded', () => {
    it('forwards data-testid', () => {
      render(<FormattedNumber value={1} data-testid="num" />)
      expect(screen.getByTestId('num')).toBeInTheDocument()
    })

    it('forwards id attribute', () => {
      render(<FormattedNumber value={1} id="price" />)
      expect(document.getElementById('price')).not.toBeNull()
    })
  })

  describe('locale resolution from i18next (mocked)', () => {
    it('uses i18next language when no locale prop is supplied', () => {
      // The vi.mock at the top of this file returns language: 'en-US'.
      // A value formatted with en-US should use commas as thousands separator.
      render(<FormattedNumber value={1000} />)
      const text = document.querySelector('.formatted-number')?.textContent ?? ''
      expect(text).toContain('1,000')
    })
  })
})
