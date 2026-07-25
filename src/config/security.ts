const SCRIPT_SRC = "'self'"
const STYLE_SRC = "'self' 'unsafe-inline'"
const CONNECT_SRC = "'self' ws://localhost:*"

export const CSP = [
  `default-src 'self'`,
  `script-src ${SCRIPT_SRC}`,
  `style-src ${STYLE_SRC}`,
  `img-src 'self' data:`,
  `font-src 'self'`,
  `connect-src ${CONNECT_SRC}`,
  `base-uri 'self'`,
  `form-action 'self'`,
  `frame-ancestors 'none'`,
].join('; ')

export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:"],
  fontSrc: ["'self'"],
  connectSrc: ["'self'", "ws://localhost:*"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
} as const

export type CSPValidationErrorType =
  | 'MISSING_HEADER'
  | 'UNSAFE_INLINE_SCRIPT'
  | 'UNSAFE_INLINE_STYLE_WITHOUT_NONCE'
  | 'UNSAFE_INLINE_OTHER'

export class CSPValidationError extends Error {
  constructor(
    public readonly type: CSPValidationErrorType,
    message: string,
  ) {
    super(message)
    this.name = 'CSPValidationError'
  }
}

export function validateCSP(cspHeader: string | undefined | null): CSPValidationError | null {
  if (!cspHeader) {
    return new CSPValidationError('MISSING_HEADER', 'Content-Security-Policy header is missing')
  }

  const directives = cspHeader.split(';').map((d) => d.trim().toLowerCase())

  for (const directive of directives) {
    if (!directive) continue

    const [directiveName, ...values] = directive.split(/\s+/)
    const directiveValue = values.join(' ')

    // Check for unsafe-inline in script-src (never allowed)
    if (directiveName === 'script-src' && directiveValue.includes("'unsafe-inline'")) {
      return new CSPValidationError(
        'UNSAFE_INLINE_SCRIPT',
        "script-src must not contain 'unsafe-inline'",
      )
    }

    // Check for unsafe-inline in style-src (only allowed with nonce)
    if (directiveName === 'style-src' && directiveValue.includes("'unsafe-inline'")) {
      const hasNonce = /'nonce-/.test(directiveValue)
      if (!hasNonce) {
        return new CSPValidationError(
          'UNSAFE_INLINE_STYLE_WITHOUT_NONCE',
          "style-src 'unsafe-inline' is only allowed with nonce",
        )
      }
    }

    // Check for unsafe-inline in other directives (never allowed)
    if (
      directiveName !== 'style-src' &&
      directiveName !== 'script-src' &&
      directiveValue.includes("'unsafe-inline'")
    ) {
      return new CSPValidationError(
        'UNSAFE_INLINE_OTHER',
        `${directiveName} must not contain 'unsafe-inline'`,
      )
    }
  }

  return null
}
