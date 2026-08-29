/**
 * Public surface of the Credence API client.
 *
 * Anything not listed below (e.g. `DEFAULT_API_RATE_LIMIT`,
 * `readApiRateLimitOverrides`, `defaultApiRateLimiter`, `resetApiRateLimiter`,
 * `apiRateLimiterSnapshot`) is intentionally kept module-private so this
 * barrel stays narrow. Test/ops-only escape hatches are imported directly
 * from `./api/client` rather than re-exported here, so a casual reader of
 * `from '../api'` does not see them as supported public API.
 *
 * Identity epoch helpers (`getIdentityEpoch`, `advanceIdentityEpoch`) are
 * re-exported as part of the public surface because session-boundary callers
 * (WalletContext, session expiry handlers) need them at the component layer.
 * `resetIdentityEpoch` is test-only and is intentionally omitted here.
 */
export { apiFetch, ApiError, ApiRateLimitError, ApiAmountError } from './client'
export type { ApiFetchOptions, ApiAmountFields, ApiAmountErrorCode } from './client'

export {
  AmountError,
  parseAmount,
  tryParseAmount,
  compareAmounts,
  resolveAmountRules,
  MAX_INT64,
  USDC_SCALE,
  MAX_SCALE,
} from './amount'
export type {
  AmountRules,
  ResolvedAmountRules,
  AmountErrorCode,
  TryParseAmountResult,
} from './amount'
export {
  apiFetch,
  ApiError,
  ApiRateLimitError,
  ApiSessionConflictError,
  ApiBodyTooLargeError,
  MAX_REQUEST_BODY_BYTES,
  getIdentityEpoch,
  advanceIdentityEpoch,
  resetApiRateLimiter,
  apiRateLimiterSnapshot,
} from './client'
export type { ApiFetchOptions } from './client'

export { ApiRateLimiter } from './rateLimit'
export type { ApiRateLimiterDecision, ApiRateLimiterOptions } from './rateLimit'

export * from './types'
