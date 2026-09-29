import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import Badge from './Badge'

const indexCssPath = resolve(process.cwd(), 'src/index.css')
const indexCss = readFileSync(indexCssPath, 'utf8')

function getCssDeclarations(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = indexCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))

  if (!match?.[1]) {
    throw new Error(`Unable to locate CSS declarations for ${selector}`)
  }

  const declarations = new Map<string, string>()
  const declarationPattern = /--([a-z0-9-]+):\s*([^;]+);/g

  for (const declaration of match[1].matchAll(declarationPattern)) {
    declarations.set(`--${declaration[1]}`, declaration[2].trim())
  }

  return declarations
}

function resolveCssValue(value: string, declarations: Map<string, string>): string {
  const variableMatch = value.match(/var\((--[^)]+)\)/)

  if (!variableMatch) {
    return value.trim()
  }

  const resolvedValue = declarations.get(variableMatch[1])

  if (!resolvedValue) {
    return value.trim()
  }

  return resolveCssValue(resolvedValue, declarations)
}

function parseColor(value: string | [number, number, number] | [number, number, number, number]) {
  if (Array.isArray(value)) {
    return value
  }

  const trimmedValue = value.trim()

  if (trimmedValue.startsWith('#')) {
    const hex = trimmedValue.replace('#', '')
    const normalizedHex =
      hex.length === 3
        ? hex
            .split('')
            .map((char) => char + char)
            .join('')
        : hex

    return [
      Number.parseInt(normalizedHex.slice(0, 2), 16) / 255,
      Number.parseInt(normalizedHex.slice(2, 4), 16) / 255,
      Number.parseInt(normalizedHex.slice(4, 6), 16) / 255,
    ]
  }

  if (trimmedValue.startsWith('rgb(')) {
    const [r, g, b] = trimmedValue
      .slice(4, -1)
      .split(',')
      .map((part) => Number.parseFloat(part.trim()) / 255)

    return [r, g, b]
  }

  if (trimmedValue.startsWith('rgba(')) {
    const [r, g, b, alpha] = trimmedValue
      .slice(5, -1)
      .split(',')
      .map((part, index) =>
        index < 3 ? Number.parseFloat(part.trim()) / 255 : Number.parseFloat(part.trim())
      )

    return [r, g, b, alpha]
  }

  throw new Error(`Unsupported CSS color value: ${trimmedValue}`)
}

function compositeColor(surfaceValue: string, pageValue: string) {
  const surface = parseColor(surfaceValue)
  const page = parseColor(pageValue)

  if (!Array.isArray(surface) || surface.length < 4 || surface[3] >= 1) {
    return surface
  }

  const alpha = surface[3]
  return [
    surface[0] * alpha + page[0] * (1 - alpha),
    surface[1] * alpha + page[1] * (1 - alpha),
    surface[2] * alpha + page[2] * (1 - alpha),
  ] as [number, number, number]
}

function getRelativeLuminance(color: [number, number, number]) {
  const normalize = (channel: number) => {
    if (channel <= 0.04045) {
      return channel / 12.92
    }

    return ((channel + 0.055) / 1.055) ** 2.4
  }

  return 0.2126 * normalize(color[0]) + 0.7152 * normalize(color[1]) + 0.0722 * normalize(color[2])
}

function getContrastRatio(
  foreground: string | [number, number, number] | [number, number, number, number],
  background: string | [number, number, number] | [number, number, number, number]
) {
  const foregroundColor = parseColor(foreground)
  const backgroundColor = parseColor(background)
  const foregroundRgb = foregroundColor.slice(0, 3) as [number, number, number]
  const backgroundRgb = backgroundColor.slice(0, 3) as [number, number, number]
  const foregroundLuminance = getRelativeLuminance(foregroundRgb)
  const backgroundLuminance = getRelativeLuminance(backgroundRgb)
  const lighter = Math.max(foregroundLuminance, backgroundLuminance)
  const darker = Math.min(foregroundLuminance, backgroundLuminance)

  return (lighter + 0.05) / (darker + 0.05)
}

function getResolvedThemeTokens(selector: string) {
  const declarations = new Map(getCssDeclarations(':root'))
  const selectorDeclarations = getCssDeclarations(selector)

  for (const [name, value] of selectorDeclarations) {
    declarations.set(name, value)
  }

  return {
    page: resolveCssValue(declarations.get('--credence-surface-page') ?? '#f8fafc', declarations),
    textSecondary: resolveCssValue(declarations.get('--text-secondary') ?? '#64748b', declarations),
    bronzeSurface: resolveCssValue(
      declarations.get('--credence-color-bronze-surface') ?? '#fef3c7',
      declarations
    ),
    bronzeText: resolveCssValue(
      declarations.get('--credence-color-bronze-text') ?? '#92400e',
      declarations
    ),
    bronzeBorder: resolveCssValue(
      declarations.get('--credence-color-bronze-border') ?? '#b45309',
      declarations
    ),
    silverSurface: resolveCssValue(
      declarations.get('--credence-color-silver-surface') ?? '#f1f5f9',
      declarations
    ),
    silverText: resolveCssValue(
      declarations.get('--credence-color-silver-text') ?? '#475569',
      declarations
    ),
    silverBorder: resolveCssValue(
      declarations.get('--credence-color-silver-border') ?? '#64748b',
      declarations
    ),
    goldSurface: resolveCssValue(
      declarations.get('--credence-color-gold-surface') ?? '#fefce8',
      declarations
    ),
    goldText: resolveCssValue(
      declarations.get('--credence-color-gold-text') ?? '#854d0e',
      declarations
    ),
    goldBorder: resolveCssValue(
      declarations.get('--credence-color-gold-border') ?? '#a16207',
      declarations
    ),
    platinumSurface: resolveCssValue(
      declarations.get('--credence-color-platinum-surface') ?? '#dbeafe',
      declarations
    ),
    platinumText: resolveCssValue(
      declarations.get('--credence-color-platinum-text') ?? '#1e3a8a',
      declarations
    ),
    platinumBorder: resolveCssValue(
      declarations.get('--credence-color-platinum-border') ?? '#2563eb',
      declarations
    ),
    graceSurface: resolveCssValue(
      declarations.get('--credence-color-grace-surface') ?? '#f5f3ff',
      declarations
    ),
    graceText: resolveCssValue(
      declarations.get('--credence-color-grace-text') ?? '#5b21b6',
      declarations
    ),
    graceBorder: resolveCssValue(
      declarations.get('--credence-color-grace-border') ?? '#7c3aed',
      declarations
    ),
    successSurface: resolveCssValue(
      declarations.get('--credence-color-success-surface') ?? '#f0fdf4',
      declarations
    ),
    successText: resolveCssValue(
      declarations.get('--credence-color-success-text') ?? '#166534',
      declarations
    ),
    successBorder: resolveCssValue(
      declarations.get('--credence-color-success-border') ?? '#15803d',
      declarations
    ),
    dangerSurface: resolveCssValue(
      declarations.get('--credence-color-danger-surface') ?? '#fef2f2',
      declarations
    ),
    dangerText: resolveCssValue(
      declarations.get('--credence-color-danger-text') ?? '#991b1b',
      declarations
    ),
    dangerBorder: resolveCssValue(
      declarations.get('--credence-color-danger-border') ?? '#ef4444',
      declarations
    ),
  }
}

function evaluateBadgeContrast(
  themeTokens: ReturnType<typeof getResolvedThemeTokens>,
  variant: string
) {
  const palette = {
    bronze: {
      surface: themeTokens.bronzeSurface,
      text: themeTokens.bronzeText,
      border: themeTokens.bronzeBorder,
    },
    silver: {
      surface: themeTokens.silverSurface,
      text: themeTokens.silverText,
      border: themeTokens.silverBorder,
    },
    gold: {
      surface: themeTokens.goldSurface,
      text: themeTokens.goldText,
      border: themeTokens.goldBorder,
    },
    platinum: {
      surface: themeTokens.platinumSurface,
      text: themeTokens.platinumText,
      border: themeTokens.platinumBorder,
    },
    active: {
      surface: themeTokens.successSurface,
      text: themeTokens.successText,
      border: themeTokens.successBorder,
    },
    locked: {
      surface: themeTokens.page,
      text: themeTokens.textSecondary,
      border: themeTokens.textSecondary,
    },
    slashed: {
      surface: themeTokens.dangerSurface,
      text: themeTokens.dangerText,
      border: themeTokens.dangerBorder,
    },
    'grace-period': {
      surface: themeTokens.graceSurface,
      text: themeTokens.graceText,
      border: themeTokens.graceBorder,
    },
  } as const

  const selectedPalette = palette[variant as keyof typeof palette]

  if (!selectedPalette) {
    throw new Error(`Unsupported badge variant: ${variant}`)
  }

  const background = selectedPalette.surface.startsWith('rgba(')
    ? compositeColor(selectedPalette.surface, themeTokens.page)
    : selectedPalette.surface
  const textRatio = getContrastRatio(selectedPalette.text, background)
  const borderRatio = getContrastRatio(selectedPalette.border, background)

  return { textRatio, borderRatio }
}

vi.mock('./Badge.css', () => ({}))
vi.mock('./TooltipOnOverflow.css', () => ({}))
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

describe('Badge', () => {
  describe('variant normalization', () => {
    it('renders a known tier variant with the correct label', () => {
      render(<Badge variant="gold" />)
      expect(screen.getByText('Gold')).toBeInTheDocument()
    })

    it('renders a known status variant with the correct label', () => {
      render(<Badge variant="slashed" />)
      expect(screen.getByText('Slashed')).toBeInTheDocument()
    })

    it('renders grace-period with "Grace Period" label', () => {
      render(<Badge variant="grace-period" />)
      expect(screen.getByText('Grace Period')).toBeInTheDocument()
    })

    it('normalizes an unknown variant string to the unknown style', () => {
      render(<Badge variant="foo-bar" />)
      const el = document.querySelector('.badge--unknown')
      expect(el).not.toBeNull()
    })

    it('unknown variant normalizes to "Unknown" label (DEFAULT_LABELS takes precedence over raw string)', () => {
      render(<Badge variant="foo-bar" />)
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })

    it('treats an empty string as unknown', () => {
      render(<Badge variant="" />)
      expect(document.querySelector('.badge--unknown')).not.toBeNull()
    })

    it.each([
      ['bronze', 'Bronze'],
      ['silver', 'Silver'],
      ['gold', 'Gold'],
      ['platinum', 'Platinum'],
      ['active', 'Active'],
      ['locked', 'Locked'],
      ['slashed', 'Slashed'],
      ['grace-period', 'Grace Period'],
      ['unknown', 'Unknown'],
    ] as const)('variant "%s" renders label "%s"', (variant, expectedLabel) => {
      render(<Badge variant={variant} />)
      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
    })
  })

  describe('label override', () => {
    it('renders the custom label instead of the default', () => {
      render(<Badge variant="gold" label="Top tier" />)
      expect(screen.getByText('Top tier')).toBeInTheDocument()
      expect(screen.queryByText('Gold')).toBeNull()
    })

    it('custom label applies to an unknown variant', () => {
      render(<Badge variant="custom-tier" label="My Badge" />)
      expect(screen.getByText('My Badge')).toBeInTheDocument()
    })
  })

  describe('TooltipOnOverflow integration', () => {
    it('wraps badge in a TooltipOnOverflow with the display label as content', () => {
      render(<Badge variant="slashed" />)
      // The badge label is still rendered
      expect(screen.getByText('Slashed')).toBeInTheDocument()
      // The wrapper span from TooltipOnOverflow exists
      const wrapper = document.querySelector('.tooltip-on-overflow__wrapper')
      expect(wrapper).toBeInTheDocument()
    })

    it('passes custom label to TooltipOnOverflow content', () => {
      render(<Badge variant="gold" label="Custom label" />)
      expect(screen.getByText('Custom label')).toBeInTheDocument()
      const wrapper = document.querySelector('.tooltip-on-overflow__wrapper')
      expect(wrapper).toBeInTheDocument()
    })

    it('no longer renders a title attribute on the badge span', () => {
      render(<Badge variant="mystery-tier" />)
      const badge = document.querySelector('.badge')
      expect(badge).not.toHaveAttribute('title')
    })
  })

  describe('className prop', () => {
    it('appends extra class names to the badge root', () => {
      render(<Badge variant="active" className="my-extra-class" />)
      const badge = document.querySelector('.badge')
      expect(badge).toHaveClass('my-extra-class')
    })

    it('does not produce a trailing space in the class when no className is given', () => {
      render(<Badge variant="active" />)
      const badge = document.querySelector('.badge')
      // className should not start or end with a space
      expect(badge?.className).not.toMatch(/^\s|\s$/)
    })
  })

  describe('srPrefix — screen-reader-only context prefix', () => {
    it('is absent from the DOM when srPrefix is not supplied', () => {
      render(<Badge variant="slashed" />)
      // The .sr-only span should not be present
      expect(document.querySelector('.sr-only')).toBeNull()
    })

    it('renders a sr-only span when srPrefix is provided', () => {
      render(<Badge variant="slashed" srPrefix="Bond status:" />)
      const srSpan = document.querySelector('.sr-only')
      expect(srSpan).not.toBeNull()
      expect(srSpan).toHaveTextContent('Bond status:')
    })

    it('accessible name includes both prefix and visible label', () => {
      render(<Badge variant="slashed" srPrefix="Bond status:" />)
      // The full text content should be "Bond status:  Slashed" (note: trailing space after prefix)
      const badge = document.querySelector('.badge')
      expect(badge?.textContent).toContain('Bond status:')
      expect(badge?.textContent).toContain('Slashed')
    })

    it('srPrefix still applies when a custom label is used', () => {
      render(<Badge variant="locked" label="In lock-up" srPrefix="Status:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Status:')
      expect(screen.getByText('In lock-up')).toBeInTheDocument()
    })

    it('srPrefix works on an unknown variant (label normalizes to Unknown)', () => {
      render(<Badge variant="experimental" srPrefix="Tier:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Tier:')
      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })

  describe('aria-label', () => {
    it.each([
      ['bronze', 'Bronze'],
      ['silver', 'Silver'],
      ['gold', 'Gold'],
      ['platinum', 'Platinum'],
      ['active', 'Active'],
      ['locked', 'Locked'],
      ['slashed', 'Slashed'],
      ['grace-period', 'Grace Period'],
      ['unknown', 'Unknown'],
    ] as const)('variant "%s" sets aria-label to "%s"', (variant, expected) => {
      render(<Badge variant={variant} />)
      expect(screen.getByTitle(expected)).toHaveAttribute('aria-label', expected)
    })

    it('custom ariaLabel overrides the default', () => {
      render(<Badge variant="slashed" ariaLabel="Status: Slashed" />)
      expect(screen.getByTitle('Slashed')).toHaveAttribute('aria-label', 'Status: Slashed')
    })

    it('ariaLabel applies alongside a custom label', () => {
      render(<Badge variant="gold" label="Top Tier" ariaLabel="Tier: Gold" />)
      expect(screen.getByTitle('Top Tier')).toHaveAttribute('aria-label', 'Tier: Gold')
    })

    it('ariaLabel works on an unknown variant', () => {
      render(<Badge variant="experimental" ariaLabel="Experimental tier" />)
      const badge = document.querySelector('.badge')
      expect(badge).toHaveAttribute('aria-label', 'Experimental tier')
    })

    it('no variant produces an empty aria-label', () => {
      const variants = [
        'bronze',
        'silver',
        'gold',
        'platinum',
        'active',
        'locked',
        'slashed',
        'grace-period',
        'unknown',
        '',
      ]
      for (const v of variants) {
        const { unmount } = render(<Badge variant={v} />)
        const badge = document.querySelector('.badge')
        expect(badge).not.toBeNull()
        expect(badge?.getAttribute('aria-label')).toBeTruthy()
        unmount()
      }
    })

    it('aria-label is present when srPrefix is also provided', () => {
      render(<Badge variant="grace-period" srPrefix="Status:" ariaLabel="Grace Period" />)
      expect(screen.getByTitle('Grace Period')).toHaveAttribute('aria-label', 'Grace Period')
    })
  })

  describe('color-only regression — visible label is always non-empty', () => {
    it.each([
      'slashed',
      'grace-period',
      'locked',
      'active',
      'bronze',
      'silver',
      'gold',
      'platinum',
      'unknown',
    ] as const)('severity variant "%s" always has a non-empty text label', (variant) => {
      render(<Badge variant={variant} />)
      const badge = document.querySelector('.badge')
      // Strip whitespace from any sr-only prefix to get visible text
      const visibleText = badge?.querySelector('.sr-only')
        ? badge.textContent?.replace(badge.querySelector('.sr-only')!.textContent ?? '', '').trim()
        : badge?.textContent?.trim()
      expect(visibleText?.length).toBeGreaterThan(0)
    })
  })

  describe('contrast regression', () => {
    it.each([
      'bronze',
      'silver',
      'gold',
      'platinum',
      'active',
      'locked',
      'slashed',
      'grace-period',
    ] as const)('keeps %s badge colors above WCAG AA in light and dark themes', (variant) => {
      const lightTokens = getResolvedThemeTokens(':root')
      const darkTokens = getResolvedThemeTokens("[data-theme='dark']")

      const lightContrast = evaluateBadgeContrast(lightTokens, variant)
      const darkContrast = evaluateBadgeContrast(darkTokens, variant)

      expect(lightContrast.textRatio).toBeGreaterThanOrEqual(4.5)
      expect(lightContrast.borderRatio).toBeGreaterThanOrEqual(3)
      expect(darkContrast.textRatio).toBeGreaterThanOrEqual(4.5)
      expect(darkContrast.borderRatio).toBeGreaterThanOrEqual(3)
    })
  })
})
