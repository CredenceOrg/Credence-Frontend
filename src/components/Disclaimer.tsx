import './Disclaimer.css'
import LINKS from '../config/links'

interface DisclaimerProps {
  /** Page-specific risk note prepended before the standard non-financial-advice line */
  context?: string
  /** URL for the full terms link — defaults to LINKS.terms */
  termsHref?: string
  /** Optional link to a docs anchor for additional context */
  learnMoreHref?: string
}

/**
 * Whether `href` is safe to render as a clickable link.
 *
 * Only relative paths, `#` fragments, and absolute `http(s)` URLs are
 * accepted. Everything else, including a blank/whitespace-only string,
 * an unrecognized scheme, and in particular `javascript:`/`data:`/`vbscript:`
 * URIs, is rejected: `termsHref` and `learnMoreHref` both ultimately trace
 * back to build-time config (`../config/links`) today, but this component
 * has no way to guarantee that stays true for every future caller, and a
 * disclaimer that silently turned a config or prop-passing mistake into a
 * script-executing link would be exactly the kind of security regression
 * this component must never produce. An unsafe href is treated the same as
 * a missing one: rendered as the disabled placeholder, never as a link.
 */
function isSafeHref(href: string): boolean {
  const trimmed = href.trim()
  if (trimmed === '') return false
  // A leading "//" is protocol-relative and resolves to whatever external
  // host follows it, not a same-site relative path — reject it here rather
  // than let the startsWith('/') check below treat it as one.
  if (trimmed.startsWith('//')) return false
  if (trimmed === '#' || trimmed.startsWith('/')) return true
  try {
    const url = new URL(trimmed, 'https://placeholder.invalid')
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Unobtrusive risk / non-financial-advice disclaimer.
 * Placed below primary page content; styled as secondary text.
 * Replace termsHref with the real URL once available from backend.
 */
export default function Disclaimer({
  context,
  termsHref = LINKS.terms,
  learnMoreHref,
}: DisclaimerProps) {
  const isPlaceholder = !termsHref || termsHref === '#' || !isSafeHref(termsHref)

  return (
    <aside className="disclaimer" aria-label="Risk disclaimer">
      {context && <p>{context}</p>}
      <p>
        This is not financial advice. Credence protocol interactions involve smart contract risk and
        potential loss of funds. Participate only with amounts you can afford to lose.{' '}
        {isPlaceholder ? (
          <span
            aria-disabled="true"
            className="disclaimer-terms-disabled"
            title="Coming soon"
            tabIndex={-1}
          >
            Full terms &amp; conditions
          </span>
        ) : (
          <a href={termsHref} aria-label="Read full terms and conditions">
            Full terms &amp; conditions
          </a>
        )}
        {learnMoreHref && (
          <>
            {' '}
            {/* optional learn more link */}{' '}
            {learnMoreHref === '#' || !isSafeHref(learnMoreHref) ? (
              <span
                aria-disabled="true"
                className="disclaimer-terms-disabled"
                title="Coming soon"
                tabIndex={-1}
              >
                Learn more
              </span>
            ) : (
              <a href={learnMoreHref} aria-label="Learn more about the terms">
                Learn more
              </a>
            )}
          </>
        )}
        .
      </p>
    </aside>
  )
}
