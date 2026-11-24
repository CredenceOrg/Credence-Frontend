/**
 * Shared WCAG contrast helpers for design-system regression tests.
 *
 * These read the real stylesheets and resolve `var()` chains against the theme
 * token blocks, so a test asserts what the app actually renders rather than a
 * hand-copied colour table that can silently drift from the CSS.
 *
 * Thresholds: WCAG 2.1 SC 1.4.3 requires 4.5:1 for normal-size text; SC 1.4.11
 * requires 3:1 for the visual boundary of an interactive control and for focus
 * indicators.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export const TEXT_AA = 4.5
export const NON_TEXT = 3

export type Rgb = [number, number, number]
export type Rgba = [number, number, number, number]
export type ColorValue = string | Rgb | Rgba

/**
 * Read a stylesheet from the project root, with comments stripped.
 *
 * Comments must go before anything parses declarations: prose containing a colon
 * and a later semicolon (e.g. "…at 1.67:1. Consume this token instead…") reads
 * as a declaration and swallows the real one that follows it.
 */
export function readCss(relativePath: string): string {
  return stripComments(readFileSync(resolve(process.cwd(), relativePath), 'utf8'))
}

export function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, '')
}

function escapeSelector(selector: string): string {
  return selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Extract a rule's declarations, keyed by property name.
 *
 * The selector must match at the start of a line so that
 * `.credence-button--primary` does not accidentally return the body of
 * `[data-theme='dark'] .credence-button--primary`.
 */
export function getRuleDeclarations(css: string, selector: string): Map<string, string> {
  const pattern = new RegExp(`(?:^|\\n)\\s*${escapeSelector(selector)}\\s*\\{([^}]*)\\}`)
  const match = stripComments(css).match(pattern)

  if (!match?.[1]) {
    throw new Error(`Unable to locate CSS rule for selector: ${selector}`)
  }

  const declarations = new Map<string, string>()

  for (const declaration of match[1].matchAll(/([\w-]+)\s*:\s*([^;]+);/g)) {
    declarations.set(declaration[1].trim(), declaration[2].trim())
  }

  return declarations
}

/** Resolve a `var(--token, fallback)` chain to a literal colour value. */
export function resolveCssValue(value: string, tokens: Map<string, string>): string {
  const match = value.match(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/)

  if (!match) {
    return value.trim()
  }

  const resolved = tokens.get(match[1]) ?? match[2]

  if (resolved === undefined) {
    throw new Error(`Unresolved CSS custom property: ${match[1]}`)
  }

  return resolveCssValue(resolved.trim(), tokens)
}

/**
 * Build the token map for a theme: `:root` declarations with the theme block's
 * declarations layered on top, matching the cascade.
 */
export function getThemeTokens(css: string, themeSelector?: string): Map<string, string> {
  const tokens = new Map<string, string>()

  const collect = (selector: string) => {
    for (const [property, value] of getRuleDeclarations(css, selector)) {
      if (property.startsWith('--')) {
        tokens.set(property, value)
      }
    }
  }

  collect(':root')

  if (themeSelector) {
    collect(themeSelector)
  }

  return tokens
}

export function parseColor(value: ColorValue): Rgb | Rgba {
  if (Array.isArray(value)) {
    return value
  }

  const trimmed = value.trim()

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1)
    const normalized =
      hex.length === 3
        ? hex
            .split('')
            .map((char) => char + char)
            .join('')
        : hex

    return [
      Number.parseInt(normalized.slice(0, 2), 16) / 255,
      Number.parseInt(normalized.slice(2, 4), 16) / 255,
      Number.parseInt(normalized.slice(4, 6), 16) / 255,
    ]
  }

  if (trimmed.startsWith('rgb(') || trimmed.startsWith('rgba(')) {
    const parts = trimmed
      .slice(trimmed.indexOf('(') + 1, trimmed.lastIndexOf(')'))
      .split(/[,/]/)
      .map((part) => Number.parseFloat(part.trim()))

    const [r, g, b, alpha] = parts

    if (r === undefined || g === undefined || b === undefined) {
      throw new Error(`Malformed rgb()/rgba() color value: ${trimmed}`)
    }

    return alpha === undefined ? [r / 255, g / 255, b / 255] : [r / 255, g / 255, b / 255, alpha]
  }

  throw new Error(`Unsupported CSS color value: ${trimmed}`)
}

/** Flatten a translucent colour onto an opaque backdrop. */
export function compositeColor(foreground: ColorValue, backdrop: ColorValue): Rgb {
  const fg = parseColor(foreground)
  const bg = parseColor(backdrop)
  const tint = fg.slice(0, 3) as Rgb
  const alpha = fg.length < 4 ? 1 : (fg[3] as number)

  if (alpha >= 1) {
    return tint
  }

  const base = bg.slice(0, 3) as Rgb

  return [
    tint[0] * alpha + base[0] * (1 - alpha),
    tint[1] * alpha + base[1] * (1 - alpha),
    tint[2] * alpha + base[2] * (1 - alpha),
  ]
}

/** Apply a CSS `opacity` value to a colour over a known backdrop. */
export function applyOpacity(color: ColorValue, backdrop: ColorValue, opacity: number): Rgb {
  const rgb = parseColor(color).slice(0, 3) as Rgb
  return compositeColor([...rgb, opacity] as Rgba, backdrop)
}

export function getRelativeLuminance(color: Rgb): number {
  const normalize = (channel: number) =>
    channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4

  return 0.2126 * normalize(color[0]) + 0.7152 * normalize(color[1]) + 0.0722 * normalize(color[2])
}

export function getContrastRatio(foreground: ColorValue, background: ColorValue): number {
  const backgroundRgb = parseColor(background).slice(0, 3) as Rgb
  // A translucent foreground is only meaningful once flattened onto its backdrop.
  const foregroundRgb = compositeColor(foreground, backgroundRgb)

  const a = getRelativeLuminance(foregroundRgb)
  const b = getRelativeLuminance(backgroundRgb)
  const lighter = Math.max(a, b)
  const darker = Math.min(a, b)

  return (lighter + 0.05) / (darker + 0.05)
}

/** Round to 2dp for readable assertion messages. */
export function ratio(foreground: ColorValue, background: ColorValue): number {
  return Math.round(getContrastRatio(foreground, background) * 100) / 100
}
