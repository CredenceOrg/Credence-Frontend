import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import StatusBadge from './StatusBadge'
import type { StatusBadgeVariant } from './StatusBadge'

vi.mock('./StatusBadge.css', () => ({}))
vi.mock('./TooltipOnOverflow.css', () => ({}))
vi.mock('../hooks/useReducedMotion', () => ({
  useReducedMotion: () => false,
}))

const ALL_VARIANTS: [StatusBadgeVariant, string][] = [
  ['pending', 'Pending'],
  ['active', 'Active'],
  ['completed', 'Completed'],
  ['failed', 'Failed'],
]

describe('StatusBadge', () => {
  describe('default labels', () => {
    it.each(ALL_VARIANTS)('variant "%s" renders label "%s"', (variant, expectedLabel) => {
      render(<StatusBadge variant={variant} />)
      expect(screen.getByText(expectedLabel)).toBeInTheDocument()
    })
  })

  describe('variant class names', () => {
    it.each(ALL_VARIANTS)('variant "%s" has .status-badge--%s class', (variant) => {
      render(<StatusBadge variant={variant} />)
      const el = document.querySelector(`.status-badge--${variant}`)
      expect(el).not.toBeNull()
    })

    it.each(ALL_VARIANTS)('root element always carries .status-badge base class', (variant) => {
      render(<StatusBadge variant={variant} />)
      expect(document.querySelector('.status-badge')).not.toBeNull()
    })
  })

  describe('label override', () => {
    it('renders the custom label instead of the default', () => {
      render(<StatusBadge variant="pending" label="Awaiting review" />)
      expect(screen.getByText('Awaiting review')).toBeInTheDocument()
      expect(screen.queryByText('Pending')).toBeNull()
    })

    it('custom label applies to completed variant', () => {
      render(<StatusBadge variant="completed" label="Done" />)
      expect(screen.getByText('Done')).toBeInTheDocument()
      expect(screen.queryByText('Completed')).toBeNull()
    })

    it.each(ALL_VARIANTS)('custom label on variant "%s" is rendered', (variant) => {
      render(<StatusBadge variant={variant} label="Custom" />)
      expect(screen.getByText('Custom')).toBeInTheDocument()
    })
  })

  describe('className prop', () => {
    it('appends extra class names to the badge root', () => {
      render(<StatusBadge variant="active" className="my-extra-class" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveClass('my-extra-class')
    })

    it('does not produce a trailing space in className when no className is given', () => {
      render(<StatusBadge variant="active" />)
      const badge = document.querySelector('.status-badge')
      expect(badge?.className).not.toMatch(/^\s|\s$/)
    })

    it('both base and variant class are present alongside custom className', () => {
      render(<StatusBadge variant="failed" className="extra" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveClass('status-badge', 'status-badge--failed', 'extra')
    })
  })

  describe('srPrefix — screen-reader-only context prefix', () => {
    it('is absent from the DOM when srPrefix is not supplied', () => {
      render(<StatusBadge variant="pending" />)
      expect(document.querySelector('.sr-only')).toBeNull()
    })

    it('renders a .sr-only span when srPrefix is provided', () => {
      render(<StatusBadge variant="failed" srPrefix="Bond status:" />)
      const srSpan = document.querySelector('.sr-only')
      expect(srSpan).not.toBeNull()
      expect(srSpan).toHaveTextContent('Bond status:')
    })

    it('full text content includes both prefix and visible label', () => {
      render(<StatusBadge variant="completed" srPrefix="Transaction status:" />)
      const badge = document.querySelector('.status-badge')
      expect(badge?.textContent).toContain('Transaction status:')
      expect(badge?.textContent).toContain('Completed')
    })

    it('srPrefix still applies when a custom label is used', () => {
      render(<StatusBadge variant="active" label="Running" srPrefix="Status:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Status:')
      expect(screen.getByText('Running')).toBeInTheDocument()
    })

    it.each(ALL_VARIANTS)('srPrefix renders on variant "%s"', (variant) => {
      render(<StatusBadge variant={variant} srPrefix="Step:" />)
      expect(document.querySelector('.sr-only')).toHaveTextContent('Step:')
    })
  })

  describe('aria-label', () => {
    it.each(ALL_VARIANTS)(
      'variant "%s" defaults aria-label to its display label "%s"',
      (variant, expectedLabel) => {
        render(<StatusBadge variant={variant} />)
        const badge = document.querySelector('.status-badge')
        expect(badge).toHaveAttribute('aria-label', expectedLabel)
      }
    )

    it('custom ariaLabel overrides the default', () => {
      render(<StatusBadge variant="pending" ariaLabel="Bond status: Pending review" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Bond status: Pending review')
    })

    it('ariaLabel applies alongside a custom label', () => {
      render(<StatusBadge variant="completed" label="Done" ariaLabel="Transaction completed" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Transaction completed')
    })

    it('aria-label reflects custom label when ariaLabel is not provided', () => {
      render(<StatusBadge variant="failed" label="Error" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Error')
    })

    it('aria-label is present on every variant', () => {
      for (const [variant] of ALL_VARIANTS) {
        const { unmount } = render(<StatusBadge variant={variant} />)
        const badge = document.querySelector('.status-badge')
        expect(badge?.getAttribute('aria-label')).toBeTruthy()
        unmount()
      }
    })

    it('aria-label is present when srPrefix is also provided', () => {
      render(<StatusBadge variant="active" srPrefix="Status:" ariaLabel="Active bond" />)
      const badge = document.querySelector('.status-badge')
      expect(badge).toHaveAttribute('aria-label', 'Active bond')
    })
  })

  describe('color-only regression — visible label is always non-empty', () => {
    it.each(ALL_VARIANTS)('variant "%s" always has a non-empty text label', (variant) => {
      render(<StatusBadge variant={variant} />)
      const badge = document.querySelector('.status-badge')
      const visibleText = badge?.querySelector('.sr-only')
        ? badge.textContent?.replace(badge.querySelector('.sr-only')!.textContent ?? '', '').trim()
        : badge?.textContent?.trim()
      expect(visibleText?.length).toBeGreaterThan(0)
    })
  })

  describe('TooltipOnOverflow integration', () => {
    it('wraps badge in a TooltipOnOverflow with the display label as content', () => {
      render(<StatusBadge variant="failed" />)
      expect(screen.getByText('Failed')).toBeInTheDocument()
      const wrapper = document.querySelector('.tooltip-on-overflow__wrapper')
      expect(wrapper).toBeInTheDocument()
    })

    it('passes custom label to TooltipOnOverflow content', () => {
      render(<StatusBadge variant="active" label="Custom label" />)
      expect(screen.getByText('Custom label')).toBeInTheDocument()
      const wrapper = document.querySelector('.tooltip-on-overflow__wrapper')
      expect(wrapper).toBeInTheDocument()
    })
  })

  describe('renders as a <span>', () => {
    it.each(ALL_VARIANTS)('root element is a <span> for variant "%s"', (variant) => {
      render(<StatusBadge variant={variant} />)
      const badge = document.querySelector('.status-badge')
      expect(badge?.tagName.toLowerCase()).toBe('span')
    })
  })

  describe('contrast regression', () => {
    const indexCssPath = resolve(process.cwd(), 'src/index.css')
    const indexCss = readFileSync(indexCssPath, 'utf8')

    function getCssDeclarations(selector: string) {
      const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      const match = indexCss.match(new RegExp(`${escapedSelector}\\s*\\{([\\s\\S]*?)\\}`))
      if (!match?.[1]) throw new Error(`Unable to locate CSS declarations for ${selector}`)
      const declarations = new Map<string, string>()
      const declarationPattern = /--([a-z0-9-]+):\s*([^;]+);/g
      for (const declaration of match[1].matchAll(declarationPattern)) {
        declarations.set(`--${declaration[1]}`, declaration[2].trim())
      }
      return declarations
    }

    function resolveCssValue(value: string, declarations: Map<string, string>): string {
      const variableMatch = value.match(/var\((--[^)]+)\)/)
      if (!variableMatch) return value.trim()
      const resolvedValue = declarations.get(variableMatch[1])
      if (!resolvedValue) return value.trim()
      return resolveCssValue(resolvedValue, declarations)
    }

    function parseColor(value: string | [number, number, number] | [number, number, number, number]) {
      if (Array.isArray(value)) return value
      const trimmedValue = value.trim()
      if (trimmedValue.startsWith('#')) {
        const hex = trimmedValue.replace('#', '')
        const normalizedHex = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex
        return [
          Number.parseInt(normalizedHex.slice(0, 2), 16) / 255,
          Number.parseInt(normalizedHex.slice(2, 4), 16) / 255,
          Number.parseInt(normalizedHex.slice(4, 6), 16) / 255,
        ]
      }
      if (trimmedValue.startsWith('rgb(')) {
        const [r, g, b] = trimmedValue.slice(4, -1).split(',').map((p) => Number.parseFloat(p.trim()) / 255)
        return [r, g, b]
      }
      if (trimmedValue.startsWith('rgba(')) {
        const [r, g, b, a] = trimmedValue.slice(5, -1).split(',').map((p, i) =>
          i < 3 ? Number.parseFloat(p.trim()) / 255 : Number.parseFloat(p.trim())
        )
        return [r, g, b, a]
      }
      throw new Error(`Unsupported CSS color value: ${trimmedValue}`)
    }

    function getRelativeLuminance(color: [number, number, number]) {
      const normalize = (channel: number) =>
        channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
      return 0.2126 * normalize(color[0]) + 0.7152 * normalize(color[1]) + 0.0722 * normalize(color[2])
    }

    function getContrastRatio(foreground: string, background: string) {
      const fg = parseColor(foreground).slice(0, 3) as [number, number, number]
      const bg = parseColor(background).slice(0, 3) as [number, number, number]
      const lighter = Math.max(getRelativeLuminance(fg), getRelativeLuminance(bg))
      const darker = Math.min(getRelativeLuminance(fg), getRelativeLuminance(bg))
      return (lighter + 0.05) / (darker + 0.05)
    }

    function getResolvedThemeTokens(selector: string) {
      const declarations = new Map(getCssDeclarations(':root'))
      const selectorDeclarations = getCssDeclarations(selector)
      for (const [name, value] of selectorDeclarations) {
        declarations.set(name, value)
      }
      return {
        warningSurface: resolveCssValue(declarations.get('--credence-color-warning-surface') ?? '#fffbeb', declarations),
        warningText: resolveCssValue(declarations.get('--credence-color-warning-text') ?? '#92400e', declarations),
        warningBorder: resolveCssValue(declarations.get('--credence-color-warning-border') ?? '#f59e0b', declarations),
        successSurface: resolveCssValue(declarations.get('--credence-color-success-surface') ?? '#f0fdf4', declarations),
        successText: resolveCssValue(declarations.get('--credence-color-success-text') ?? '#166534', declarations),
        successBorder: resolveCssValue(declarations.get('--credence-color-success-border') ?? '#15803d', declarations),
        infoSurface: resolveCssValue(declarations.get('--credence-color-info-surface') ?? '#eff6ff', declarations),
        infoText: resolveCssValue(declarations.get('--credence-color-info-text') ?? '#1e40af', declarations),
        infoBorder: resolveCssValue(declarations.get('--credence-color-info-border') ?? '#3b82f6', declarations),
        dangerSurface: resolveCssValue(declarations.get('--credence-color-danger-surface') ?? '#fef2f2', declarations),
        dangerText: resolveCssValue(declarations.get('--credence-color-danger-text') ?? '#991b1b', declarations),
        dangerBorder: resolveCssValue(declarations.get('--credence-color-danger-border') ?? '#ef4444', declarations),
      }
    }

    function evaluateContrast(tokens: ReturnType<typeof getResolvedThemeTokens>, variant: string) {
      const palette: Record<string, { surface: string; text: string; border: string }> = {
        pending: { surface: tokens.warningSurface, text: tokens.warningText, border: tokens.warningBorder },
        active: { surface: tokens.successSurface, text: tokens.successText, border: tokens.successBorder },
        completed: { surface: tokens.infoSurface, text: tokens.infoText, border: tokens.infoBorder },
        failed: { surface: tokens.dangerSurface, text: tokens.dangerText, border: tokens.dangerBorder },
      }
      const p = palette[variant]
      if (!p) throw new Error(`Unsupported variant: ${variant}`)
      return {
        textRatio: getContrastRatio(p.text, p.surface),
        borderRatio: getContrastRatio(p.border, p.surface),
      }
    }

    it.each(['pending', 'active', 'completed', 'failed'] as const)(
      'keeps %s badge colors above WCAG AA in light and dark themes',
      (variant) => {
        const lightTokens = getResolvedThemeTokens(':root')
        const darkTokens = getResolvedThemeTokens("[data-theme='dark']")
        const lightContrast = evaluateContrast(lightTokens, variant)
        const darkContrast = evaluateContrast(darkTokens, variant)
        expect(lightContrast.textRatio).toBeGreaterThanOrEqual(4.5)
        expect(lightContrast.borderRatio).toBeGreaterThanOrEqual(3)
        expect(darkContrast.textRatio).toBeGreaterThanOrEqual(4.5)
        expect(darkContrast.borderRatio).toBeGreaterThanOrEqual(3)
      }
    )
  })
})
