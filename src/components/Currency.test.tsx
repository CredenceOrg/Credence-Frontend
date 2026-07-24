import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Currency from './Currency'

vi.mock('./Currency.css', () => ({}))

const NBSP = ' '

describe('Currency', () => {
  describe('locale-specific formatting (CLDR)', () => {
    it('formats USD in en-US with symbol prefix, comma grouping, and two decimals', () => {
      render(<Currency amount={1234.5} currency="USD" locale="en-US" />)
      expect(screen.getByText('$1,234.50')).toBeInTheDocument()
    })

    it('formats EUR in es-ES with symbol suffix, dot grouping, and comma decimals', () => {
      const { container } = render(<Currency amount={1234.5} currency="EUR" locale="es-ES" />)
      expect(container.textContent).toBe(`1234,50${NBSP}€`)
    })

    it('formats JPY in ja-JP with zero fraction digits per CLDR', () => {
      render(<Currency amount={1234.5} currency="JPY" locale="ja-JP" />)
      expect(screen.getByText('￥1,235')).toBeInTheDocument()
    })

    it('rounds JPY down when the fraction is below half a yen', () => {
      render(<Currency amount={1234.4} currency="JPY" locale="ja-JP" />)
      expect(screen.getByText('￥1,234')).toBeInTheDocument()
    })

    it('keeps symbol placement locale-dependent (de-DE renders the symbol after)', () => {
      const { container } = render(<Currency amount={1234.5} currency="EUR" locale="de-DE" />)
      expect(container.textContent).toBe(`1.234,50${NBSP}€`)
    })

    it('matches the Intl.NumberFormat reference for each supported locale', () => {
      const cases = [
        ['en-US', 'USD'],
        ['es-ES', 'EUR'],
        ['ja-JP', 'JPY'],
      ] as const
      for (const [locale, currency] of cases) {
        const { container, unmount } = render(
          <Currency amount={9876543.21} currency={currency} locale={locale} />
        )
        const expected = new Intl.NumberFormat(locale, {
          style: 'currency',
          currency,
        }).format(9876543.21)
        expect(container.textContent).toBe(expected)
        unmount()
      }
    })

    it('falls back to the active i18n language when no locale prop is given', () => {
      // test-setup initializes i18next with lng: 'en'
      render(<Currency amount={1000} currency="USD" />)
      expect(screen.getByText('$1,000.00')).toBeInTheDocument()
    })
  })

  describe('fraction digit overrides', () => {
    it('respects explicit minimum/maximum fraction digits over CLDR defaults', () => {
      render(
        <Currency
          amount={1234.5}
          currency="JPY"
          locale="ja-JP"
          minimumFractionDigits={2}
          maximumFractionDigits={2}
        />
      )
      expect(screen.getByText('￥1,234.50')).toBeInTheDocument()
    })
  })

  describe('sad paths', () => {
    it('renders the fallback for NaN amounts', () => {
      render(<Currency amount={Number.NaN} locale="en-US" />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('renders the fallback for infinite amounts', () => {
      render(<Currency amount={Number.POSITIVE_INFINITY} locale="en-US" />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('uses a custom fallback when provided', () => {
      render(<Currency amount={Number.NaN} locale="en-US" fallback="n/a" />)
      expect(screen.getByText('n/a')).toBeInTheDocument()
    })

    it('marks invalid amounts with the currency--invalid class', () => {
      const { container } = render(<Currency amount={Number.NaN} locale="en-US" />)
      expect(container.querySelector('.currency--invalid')).not.toBeNull()
    })

    it('degrades to a plain number plus code for unknown currency codes', () => {
      render(<Currency amount={1234.5} currency="NOTACODE" locale="en-US" />)
      expect(screen.getByText('1,234.50 NOTACODE')).toBeInTheDocument()
    })

    it('formats negative amounts with a leading sign', () => {
      render(<Currency amount={-42} currency="USD" locale="en-US" />)
      expect(screen.getByText('-$42.00')).toBeInTheDocument()
    })
  })

  describe('root element', () => {
    it('appends a custom className to the root element', () => {
      const { container } = render(<Currency amount={1} locale="en-US" className="price-tag" />)
      const el = container.querySelector('.currency')
      expect(el).not.toBeNull()
      expect(el?.className).toContain('price-tag')
    })
  })
})
