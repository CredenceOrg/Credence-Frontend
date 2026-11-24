import { HORIZON_URLS } from '../lib/horizon'

const SCRIPT_SRC = "'self'"
const STYLE_SRC = "'self' 'unsafe-inline'"
const DEV_CONNECT_SRC = ["'self'", 'ws://localhost:*'] as const
const PRODUCTION_API_ORIGIN = 'https://api.credence.org'

export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: [SCRIPT_SRC],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  connectSrc: DEV_CONNECT_SRC,
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
} as const

function getApiOrigin(apiOrigin: string): string {
  const parsed = new URL(apiOrigin)
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('CSP API origin must use HTTP or HTTPS')
  }
  return parsed.origin
}

export function buildCsp({
  isDev,
  apiOrigin = PRODUCTION_API_ORIGIN,
}: {
  isDev: boolean
  apiOrigin?: string
}): string {
  const connectSrc = isDev
    ? [...DEV_CONNECT_SRC]
    : ["'self'", ...Object.values(HORIZON_URLS), getApiOrigin(apiOrigin)]
  const directives = { ...CSP_DIRECTIVES, connectSrc }

  return Object.entries(directives)
    .map(
      ([name, sources]) =>
        `${name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)} ${sources.join(' ')}`
    )
    .join('; ')
}

export const CSP = buildCsp({ isDev: true })
