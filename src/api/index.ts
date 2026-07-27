/**
 * Public surface of the Credence API client.
 *
 * Anything not listed below (e.g. `DEFAULT_API_RATE_LIMIT`,
 * `readApiRateLimitOverrides`, `defaultApiRateLimiter`, `resetApiRateLimiter`,
 * `apiRateLimiterSnapshot`) is intentionally kept module-private so this
 * barrel stays narrow. Test/ops-only escape hatches are imported directly
 * from `./api/client` rather than re-exported here, so a casual reader of
 * `from '../api'` does not see them as supported public API.
 */
export { apiFetch, ApiError, ApiRateLimitError, ApiFetchOptions } from './client'

export { ApiRateLimiter } from './rateLimit'
export type { ApiRateLimiterDecision, ApiRateLimiterOptions } from './rateLimit'

export * from './types'
