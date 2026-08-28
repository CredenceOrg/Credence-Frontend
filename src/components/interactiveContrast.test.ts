/**
 * Contrast regression guard for interactive states — links, buttons, and focus
 * rings — in both themes.
 *
 * Every case resolves colours out of the real stylesheets (`index.css` plus the
 * relevant component CSS) rather than a copied colour table, so swapping a
 * token or a `color:` declaration back to a failing value breaks a test here.
 *
 * Targets: 4.5:1 for text (SC 1.4.3), 3:1 for control boundaries and focus
 * indicators (SC 1.4.11).
 *
 * Disabled controls are deliberately absent: SC 1.4.3 exempts "inactive user
 * interface components", and raising their contrast would make them read as
 * enabled. See docs/interactive-contrast-audit.md.
 */
import { describe, it, expect } from 'vitest'
import {
  NON_TEXT,
  TEXT_AA,
  getRuleDeclarations,
  getThemeTokens,
  ratio,
  readCss,
  resolveCssValue,
} from '../test/contrast'

const indexCss = readCss('src/index.css')
const buttonCss = readCss('src/components/Button.css')

const THEMES = [
  { name: 'light', selector: undefined },
  { name: 'dark', selector: "[data-theme='dark']" },
] as const

/** Token values as the browser would resolve them for a given theme. */
function tokensFor(themeSelector?: string) {
  const tokens = getThemeTokens(indexCss, themeSelector)
  const token = (name: string) => resolveCssValue(`var(${name})`, tokens)

  return {
    token,
    page: token('--credence-surface-page'),
    card: token('--credence-surface-card'),
    primary: token('--credence-color-primary'),
    primaryStrong: token('--credence-color-primary-strong'),
    onPrimary: token('--credence-color-on-primary'),
    focusRing: token('--credence-color-focus-ring'),
    textPrimary: token('--credence-text-primary'),
    textSecondary: token('--credence-text-secondary'),
    /** Resolve a declaration taken from a component rule. */
    resolve: (value: string) => resolveCssValue(value, tokens),
  }
}

/** Read one declaration out of a component rule and resolve it. */
function declaration(css: string, selector: string, property: string, themeSelector?: string) {
  const value = getRuleDeclarations(css, selector).get(property)

  if (!value) {
    throw new Error(`Expected ${selector} to declare ${property}`)
  }

  return tokensFor(themeSelector).resolve(value)
}

describe.each(THEMES)('interactive contrast — $name theme', ({ selector }) => {
  const t = tokensFor(selector)

  describe('links', () => {
    it('body link meets AA on the page and on cards', () => {
      const linkColor = declaration(indexCss, 'a', 'color', selector)

      expect(ratio(linkColor, t.page)).toBeGreaterThanOrEqual(TEXT_AA)
      expect(ratio(linkColor, t.card)).toBeGreaterThanOrEqual(TEXT_AA)
    })

    it('link hover meets AA', () => {
      const hoverColor = declaration(indexCss, 'a:hover', 'color', selector)

      expect(ratio(hoverColor, t.page)).toBeGreaterThanOrEqual(TEXT_AA)
      expect(ratio(hoverColor, t.card)).toBeGreaterThanOrEqual(TEXT_AA)
    })

    it('footer link meets AA on the card surface it sits on', () => {
      const footerColor = declaration(indexCss, '.footer-link', 'color', selector)

      expect(ratio(footerColor, t.card)).toBeGreaterThanOrEqual(TEXT_AA)
    })

    it('skip link meets AA against its primary fill', () => {
      const rule = getRuleDeclarations(indexCss, '.skip-link')

      expect(
        ratio(t.resolve(rule.get('color')!), t.resolve(rule.get('background')!))
      ).toBeGreaterThanOrEqual(TEXT_AA)
    })
  })

  describe('primary button', () => {
    // Regression: --credence-color-primary flips to a light tint in dark mode.
    // A hard-coded white label rendered at 1.67:1 there.
    it('label meets AA on the base fill', () => {
      const rule = getRuleDeclarations(buttonCss, '.credence-button--primary')

      expect(
        ratio(t.resolve(rule.get('color')!), t.resolve(rule.get('background')!))
      ).toBeGreaterThanOrEqual(TEXT_AA)
    })

    it('label meets AA on the hover fill', () => {
      const label = declaration(buttonCss, '.credence-button--primary', 'color', selector)

      expect(ratio(label, t.primaryStrong)).toBeGreaterThanOrEqual(TEXT_AA)
    })

    it('fill is distinguishable from the page', () => {
      expect(ratio(t.primary, t.page)).toBeGreaterThanOrEqual(NON_TEXT)
    })
  })

  describe('secondary button', () => {
    // The fill matches the surface behind it, so the border is the only thing
    // identifying the control and must clear the non-text floor.
    it('border is distinguishable from the surface', () => {
      // Read the declaration, not the token, so pointing the button back at a
      // decorative border colour fails here.
      const border = declaration(buttonCss, '.credence-button--secondary', 'border-color', selector)
      const fill = selector
        ? declaration(
            buttonCss,
            "[data-theme='dark'] .credence-button--secondary",
            'background',
            selector
          )
        : declaration(buttonCss, '.credence-button--secondary', 'background', selector)

      expect(ratio(border, fill)).toBeGreaterThanOrEqual(NON_TEXT)
      expect(ratio(border, t.card)).toBeGreaterThanOrEqual(NON_TEXT)
    })

    it('hover border is distinguishable from the hover fill', () => {
      const border = declaration(
        buttonCss,
        '.credence-button--secondary:hover:not(:disabled)',
        'border-color',
        selector
      )
      const hoverFill = selector
        ? declaration(
            buttonCss,
            "[data-theme='dark'] .credence-button--secondary:hover:not(:disabled)",
            'background',
            selector
          )
        : declaration(
            buttonCss,
            '.credence-button--secondary:hover:not(:disabled)',
            'background',
            selector
          )

      expect(ratio(border, hoverFill)).toBeGreaterThanOrEqual(NON_TEXT)
    })

    it('label meets AA on the base fill', () => {
      const fill = selector
        ? declaration(
            buttonCss,
            "[data-theme='dark'] .credence-button--secondary",
            'background',
            selector
          )
        : declaration(buttonCss, '.credence-button--secondary', 'background', selector)

      expect(ratio(t.textPrimary, fill)).toBeGreaterThanOrEqual(TEXT_AA)
    })
  })

  describe('ghost and link buttons', () => {
    it('ghost label meets AA over the page', () => {
      const label = declaration(buttonCss, '.credence-button--ghost', 'color', selector)

      expect(ratio(label, t.page)).toBeGreaterThanOrEqual(TEXT_AA)
    })

    it('link-variant label meets AA over cards', () => {
      const label = declaration(buttonCss, '.credence-button--link', 'color', selector)

      expect(ratio(label, t.card)).toBeGreaterThanOrEqual(TEXT_AA)
    })
  })

  describe('danger button', () => {
    // Regression: hover previously lightened the fill to #ef4444, dropping the
    // white label to 3.76:1.
    it('label meets AA on base, hover and active fills', () => {
      const label = declaration(buttonCss, '.credence-button--danger', 'color', selector)

      const fills = [
        declaration(buttonCss, '.credence-button--danger', 'background', selector),
        declaration(
          buttonCss,
          '.credence-button--danger:hover:not(:disabled)',
          'background',
          selector
        ),
        declaration(
          buttonCss,
          '.credence-button--danger:active:not(:disabled)',
          'background',
          selector
        ),
      ]

      for (const fill of fills) {
        expect(ratio(label, fill)).toBeGreaterThanOrEqual(TEXT_AA)
      }
    })

    it('keeps a distinguishable edge against the page in every state', () => {
      const borders = [
        declaration(buttonCss, '.credence-button--danger', 'border-color', selector),
        declaration(
          buttonCss,
          '.credence-button--danger:hover:not(:disabled)',
          'border-color',
          selector
        ),
        declaration(
          buttonCss,
          '.credence-button--danger:active:not(:disabled)',
          'border-color',
          selector
        ),
      ]

      for (const border of borders) {
        expect(ratio(border, t.page)).toBeGreaterThanOrEqual(NON_TEXT)
      }
    })
  })

  describe('focus indicators', () => {
    it('focus ring is visible against the page and cards', () => {
      expect(ratio(t.focusRing, t.page)).toBeGreaterThanOrEqual(NON_TEXT)
      expect(ratio(t.focusRing, t.card)).toBeGreaterThanOrEqual(NON_TEXT)
    })

    it('danger focus ring is visible against the page', () => {
      const ringColor = declaration(
        buttonCss,
        '.credence-button--danger:focus-visible',
        'outline-color',
        selector
      )

      expect(ratio(ringColor, t.page)).toBeGreaterThanOrEqual(NON_TEXT)
    })
  })
})

describe('primary-filled controls outside Button.css', () => {
  // Every control that paints --credence-color-primary as its background must
  // take its label from --credence-color-on-primary, otherwise it regresses to
  // white-on-light-blue in dark mode.
  const cases = [
    ['src/components/SpeedDial.css', '.speedDial__fab'],
    ['src/components/BackToTop.css', '.back-to-top'],
    ['src/components/controls/controls.css', ".control-toggle[aria-checked='true']"],
    ['src/components/controls/controls.css', '.control-segmented__option--selected'],
    ['src/components/navigation/MobileNav.css', '.mobileNav-link--active'],
  ] as const

  it.each(cases)('%s %s pairs its primary fill with on-primary', (file, selector) => {
    const rule = getRuleDeclarations(readCss(file), selector)

    expect(rule.get('background')).toContain('--credence-color-primary')
    expect(rule.get('color')).toContain('--credence-color-on-primary')
  })

  it.each(THEMES)('on-primary label meets AA in the $name theme', ({ selector }) => {
    const t = tokensFor(selector)

    expect(ratio(t.onPrimary, t.primary)).toBeGreaterThanOrEqual(TEXT_AA)
    expect(ratio(t.onPrimary, t.primaryStrong)).toBeGreaterThanOrEqual(TEXT_AA)
  })
})
