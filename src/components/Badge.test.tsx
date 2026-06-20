import { render, screen } from '@testing-library/react'
import Badge from './Badge'

// Mock the CSS import so Vitest doesn't choke on it
vi.mock('./Badge.css', () => ({}))

const KNOWN_VARIANTS = [
  { variant: 'bronze', label: 'Bronze' },
  { variant: 'silver', label: 'Silver' },
  { variant: 'gold', label: 'Gold' },
  { variant: 'platinum', label: 'Platinum' },
  { variant: 'active', label: 'Active' },
  { variant: 'locked', label: 'Locked' },
  { variant: 'slashed', label: 'Slashed' },
  { variant: 'grace-period', label: 'Grace Period' },
  { variant: 'unknown', label: 'Unknown' },
] as const

describe('Badge', () => {
  describe('known variants', () => {
    it.each(KNOWN_VARIANTS)(
      '$variant renders badge--$variant class and default label "$label"',
      ({ variant, label }) => {
        render(<Badge variant={variant} />)
        const el = screen.getByText(label)
        expect(el).toHaveClass('badge', `badge--${variant}`)
      },
    )
  })

  describe('case-insensitive normalization', () => {
    it('uppercased Gold → badge--gold class and label "Gold"', () => {
      render(<Badge variant="GOLD" />)
      const el = screen.getByText('Gold')
      expect(el).toHaveClass('badge--gold')
    })

    it('mixed-case Grace-Period → badge--grace-period', () => {
      render(<Badge variant="Grace-Period" />)
      const el = screen.getByText('Grace Period')
      expect(el).toHaveClass('badge--grace-period')
    })
  })

  describe('unknown fallback', () => {
    it('unrecognized string → badge--unknown class and label "Unknown"', () => {
      render(<Badge variant="foobar" />)
      const el = screen.getByText('Unknown')
      expect(el).toHaveClass('badge--unknown')
      expect(el).not.toHaveClass('badge--foobar')
    })

    it('empty string → badge--unknown', () => {
      render(<Badge variant="" />)
      const el = screen.getByText('Unknown')
      expect(el).toHaveClass('badge--unknown')
    })

    it('whitespace-only string → badge--unknown', () => {
      render(<Badge variant="   " />)
      const el = screen.getByText('Unknown')
      expect(el).toHaveClass('badge--unknown')
    })
  })

  describe('explicit label override', () => {
    it('overrides default label for a known variant', () => {
      render(<Badge variant="gold" label="Custom Gold" />)
      expect(screen.getByText('Custom Gold')).toHaveClass('badge--gold')
      expect(screen.queryByText('Gold')).toBeNull()
    })

    it('overrides label even for an unknown variant', () => {
      render(<Badge variant="foobar" label="My Label" />)
      expect(screen.getByText('My Label')).toHaveClass('badge--unknown')
    })
  })

  describe('className passthrough', () => {
    it('appends extra className to the badge element', () => {
      render(<Badge variant="active" className="extra-class" />)
      expect(screen.getByText('Active')).toHaveClass('badge', 'badge--active', 'extra-class')
    })
  })
})
