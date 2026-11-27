import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'

/**
 * Guard test: Ensures that user-visible strings in Settings, BondDetail, Home,
 * and SignIn pages are externalized to en.json and not hardcoded as JSX text.
 *
 * This test scans the source files for literal text nodes that appear to be
 * user-facing copy (excluding JSX syntax, component names, and common code
 * patterns) and fails if any untranslated literals are found.
 */

const FILES_TO_CHECK = [
  'src/pages/Settings.tsx',
  'src/pages/BondDetail.tsx',
  'src/pages/Home.tsx',
  'src/pages/SignIn.tsx',
]

// Patterns that are allowed (not user-facing strings)
const ALLOWED_PATTERNS = [
  // Empty strings and whitespace
  /^$/,
  /^\s+$/,
  
  // Single characters or symbols
  /^[&→←—·•×+\-=#]$/,
  
  // Component syntax and interpolations
  /^\{.*\}$/,
  /^<.*>$/,
  
  // Numbers and formatting
  /^\d+$/,
  /^%$/,
  
  // CSS class names
  /^[a-z-_]+__[a-z-_]+$/i,
  
  // Common code patterns
  /^(true|false|null|undefined)$/,
  
  // Allowed single-word technical terms
  /^(USDC|ID|#\d+|Days)$/,
  
  // Interpolation markers
  /^\$\{.*\}$/,
  /^%s$/,
  
  // Code patterns that look like text but aren't
  /^\(null\)$/,
  /^\($/, // Opening parenthesis alone
  /^&&/,  // Logical operators
  /^0 &&/,
]

// Known exceptions that are intentionally hardcoded
const KNOWN_EXCEPTIONS = [
  'credence-settings.json', // Filename for export
  '22:00', // Default time values
  '07:00',
  'HH:mm', // Time format placeholder
  'light',
  'dark', 
  'system',
  'public',
  'test',
  'full',
  'short',
  'friendly',
  'off',
  '3s',
  '5s',
  '8s',
]

function extractJSXTextNodes(content: string): string[] {
  const textNodes: string[] = []
  
  // Remove comments
  let withoutComments = content.replace(/\/\*[\s\S]*?\*\//g, '')
  withoutComments = withoutComments.replace(/\/\/.*/g, '')
  
  // Remove template literals (backticks)
  withoutComments = withoutComments.replace(/`[^`]*`/g, '')
  
  // Remove string literals in code (but not JSX)
  // This regex looks for strings that are clearly in JS code context
  withoutComments = withoutComments.replace(
    /(['"])(?:(?=(\\?))\2.)*?\1/g,
    (match, quote, ...args) => {
      // If this is inside JSX (between > and <), keep it
      const offset = args[args.length - 2]
      const before = withoutComments.substring(Math.max(0, offset - 50), offset)
      const after = withoutComments.substring(offset, Math.min(withoutComments.length, offset + 50))
      
      // Check if we're in a JSX context (between > and <)
      const beforeLastGt = before.lastIndexOf('>')
      const beforeLastLt = before.lastIndexOf('<')
      const afterNextLt = after.indexOf('<')
      const afterNextGt = after.indexOf('>')
      
      if (beforeLastGt > beforeLastLt && afterNextLt > -1 && afterNextLt < afterNextGt) {
        return match // Keep it, it's JSX text
      }
      
      return '' // Remove it, it's code
    }
  )
  
  // Extract text between JSX tags: >text<
  const jsxTextRegex = />([^<>{}]+)</g
  let match
  
  while ((match = jsxTextRegex.exec(withoutComments)) !== null) {
    const text = match[1].trim()
    if (text) {
      textNodes.push(text)
    }
  }
  
  return textNodes
}

function isAllowed(text: string): boolean {
  // Check if it matches any allowed pattern
  if (ALLOWED_PATTERNS.some(pattern => pattern.test(text))) {
    return true
  }
  
  // Check if it's in known exceptions
  if (KNOWN_EXCEPTIONS.includes(text)) {
    return true
  }
  
  // Check if it looks like a translation call
  if (text.includes('t(') || text.includes('useTranslation')) {
    return true
  }
  
  // Filter out multi-line code snippets (contains newlines)
  if (text.includes('\n')) {
    return true
  }
  
  // Filter out code patterns with common operators
  if (text.includes('===') || text.includes('useState') || text.includes('useRef') || text.includes('useMemo')) {
    return true
  }
  
  return false
}

describe('Hardcoded strings guard test', () => {
  FILES_TO_CHECK.forEach((filePath) => {
    it(`${filePath} should not contain hardcoded user-facing strings`, () => {
      const fullPath = join(process.cwd(), filePath)
      const content = readFileSync(fullPath, 'utf-8')
      
      const textNodes = extractJSXTextNodes(content)
      const violations = textNodes.filter(text => !isAllowed(text))
      
      if (violations.length > 0) {
        const violationList = violations.map(v => `  - "${v}"`).join('\n')
        expect.fail(
          `Found ${violations.length} hardcoded string(s) in ${filePath}:\n${violationList}\n\n` +
          `All user-facing text should use t() from useTranslation.`
        )
      }
      
      expect(violations).toHaveLength(0)
    })
  })
  
  it('verifies that all checked files use useTranslation', () => {
    FILES_TO_CHECK.forEach((filePath) => {
      const fullPath = join(process.cwd(), filePath)
      const content = readFileSync(fullPath, 'utf-8')
      
      // Check that the file imports useTranslation
      const hasImport = content.includes("from 'react-i18next'")
      const usesTranslation = content.includes('useTranslation()')
      
      expect(
        hasImport && usesTranslation,
        `${filePath} should import and use useTranslation from react-i18next`
      ).toBe(true)
    })
  })
})
