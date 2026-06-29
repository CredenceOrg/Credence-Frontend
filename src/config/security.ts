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
