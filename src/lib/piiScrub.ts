/**
 * Scrub personally-identifiable information (PII) from data before it enters
 * the in-memory widget/query cache (`src/widgetCache`).
 *
 * Threat model
 * ------------
 * `WidgetCacheStore` holds whatever a fetcher resolves with, in memory, for
 * the lifetime of the tab, keyed by a stable widget id. Any component that
 * mounts with that key can read it back, including widgets added later by
 * developers who never saw what the original fetcher returned. If a backend
 * response embeds PII (email, full name, national ID, phone number, home
 * address, date of birth, ...), it survives in the cache long after the
 * component that fetched it unmounts. Concretely, that means:
 *   - a devtools heap snapshot, or any future "export cache for debugging"
 *     helper, would leak it;
 *   - a widget that only needs one field of the payload (e.g. a trust-score
 *     number) still receives the PII fields on `data`, widening the blast
 *     radius of an unrelated bug (accidental `console.log`, a rendering
 *     mistake, a third-party child component).
 * Scrubbing at the single `setEntry` choke point, rather than trusting every
 * fetcher to sanitize its own response, means new widgets get this
 * protection automatically.
 */

const PII_KEY_PATTERN =
  /^(e[-_]?mail|phone([-_]?number)?|mobile|ssn|social[-_]?security(?:[-_]?number)?|passport(?:[-_]?number)?|national[-_]?id|date[-_]?of[-_]?birth|dob|full[-_]?name|first[-_]?name|last[-_]?name|home[-_]?address|mailing[-_]?address|street[-_]?address|postal[-_]?code|zip[-_]?code)$/i

const EMAIL_VALUE_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i
const EMAIL_SUBSTRING_PATTERN = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
const STELLAR_ADDRESS_PATTERN = /\b[GSCM][A-Z2-7]{55,68}\b/g
const HEX_ADDRESS_PATTERN = /\b0x[a-fA-F0-9]{40,}\b/g

/**
 * Global twin of {@link EMAIL_VALUE_PATTERN} used when rewriting free-form
 * text (crash reports), where every occurrence must be replaced, not just the
 * first one.
 */
const EMAIL_VALUE_PATTERN_GLOBAL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi

/**
 * Stellar account (`G…`) and contract (`C…`) identifiers: a type prefix
 * followed by 55 base-32 characters. Wallet addresses are the most sensitive
 * value this app handles, so they are stripped from anything leaving the
 * browser.
 */
const STELLAR_ADDRESS_PATTERN = /\b[GC][A-Z2-7]{55}\b/g

/**
 * Money-shaped keys. Crash reports keep the *shape* of a failure but not the
 * user's balances, so these are redacted alongside classic PII.
 */
const TELEMETRY_AMOUNT_KEY_PATTERN =
  /^(amount|amounts|amount[-_]?usdc|balance|balances|total[-_]?amount)$/i

const CIRCULAR_PLACEHOLDER = '[Circular]'

const REDACTED = '[REDACTED]'

/**
 * Thrown instead of letting a circular structure crash the scrub with a
 * generic "Maximum call stack size exceeded" — the widget cache surfaces
 * this via `entry.error` like any other fetch failure.
 */
export class PIIScrubError extends Error {
  public readonly name = 'PIIScrubError'
  public readonly cause?: unknown

  constructor(message: string, cause?: unknown) {
    super(message)
    this.cause = cause
    Object.setPrototypeOf(this, PIIScrubError.prototype)
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === Object.prototype || proto === null
}

function scrubValue(value: unknown, key: string | undefined, seen: WeakSet<object>): unknown {
  if (key !== undefined && PII_KEY_PATTERN.test(key)) {
    return REDACTED
  }

  if (typeof value === 'string') {
    return EMAIL_VALUE_PATTERN.test(value) ? REDACTED : value
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubValue(item, undefined, seen))
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) {
      throw new PIIScrubError(
        'Refusing to cache circular data: cannot safely scrub PII from a self-referential object.'
      )
    }
    seen.add(value)
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = scrubValue(v, k, seen)
    }
    seen.delete(value)
    return result
  }

  return value
}

/**
 * Deep-clone `value`, redacting known-PII object keys (case-insensitive,
 * e.g. `email`, `fullName`, `homeAddress`) and any string that looks like an
 * email address, at any nesting depth, in plain objects and arrays.
 *
 * Non-plain objects (`Date`, `Map`, class instances, ...) and primitives
 * other than "email-shaped" strings pass through unchanged — the widget
 * cache stores whatever shape a fetcher returns, and this targets the
 * plain-object/array/string cases that can actually carry PII.
 *
 * @throws {PIIScrubError} if `value` contains a circular reference. Such a
 * structure cannot be safely deep-cloned, and silently caching a live
 * reference back into the store would defeat the point of scrubbing.
 */
export function scrubPII<T>(value: T): T {
  return scrubValue(value, undefined, new WeakSet<object>()) as T
}

function scrubTelemetryString(value: string): string {
  return value
    .replace(EMAIL_VALUE_PATTERN_GLOBAL, REDACTED)
    .replace(STELLAR_ADDRESS_PATTERN, REDACTED)
}

function scrubTelemetryValue(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>
): unknown {
  if (key !== undefined && (PII_KEY_PATTERN.test(key) || TELEMETRY_AMOUNT_KEY_PATTERN.test(key))) {
    return REDACTED
  }

  if (typeof value === 'string') {
    return scrubTelemetryString(value)
  }

  // Errors are reported to Sentry as the exception itself, but they can also
  // arrive inside `extra`/`contexts`. Keep the class name, drop the raw
  // message and stack, which routinely embed addresses and amounts.
  if (value instanceof Error) {
    return { name: value.name, message: scrubTelemetryString(value.message) }
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubTelemetryValue(item, undefined, seen))
  }

  if (isPlainObject(value)) {
    if (seen.has(value)) return CIRCULAR_PLACEHOLDER
    seen.add(value)
    const result: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      result[k] = scrubTelemetryValue(v, k, seen)
    }
    seen.delete(value)
    return result
  }

  return value
}

/**
 * Deep-clone `value` for transmission to a third-party error reporter,
 * redacting:
 *   - known PII object keys (same list as {@link scrubPII});
 *   - amount/balance keys, so balances never leave the device;
 *   - any Stellar account (`G…`) or contract (`C…`) address inside a string;
 *   - any email address inside a string;
 *   - `Error` instances, reduced to their class name.
 *
 * Unlike {@link scrubPII} this never throws: crash reporting must survive
 * whatever shape a failing component hands it. Circular references collapse to
 * a `'[Circular]'` marker instead of aborting the report.
 */
export function scrubTelemetryPII<T>(value: T): T {
  return scrubTelemetryValue(value, undefined, new WeakSet<object>()) as T
/**
 * Scrub PII and address-like substrings (emails, Stellar StrKey addresses/keys,
 * and 0x-prefixed hex addresses) from a free-text diagnostic string while
 * preserving the surrounding message text.
 */
export function scrubDiagnosticText(text: string): string {
  return text
    .replace(EMAIL_SUBSTRING_PATTERN, REDACTED)
    .replace(STELLAR_ADDRESS_PATTERN, REDACTED)
    .replace(HEX_ADDRESS_PATTERN, REDACTED)
}
