import './Disclaimer.css'
import LINKS from '../config/links'
import { isExternalUrl } from '../lib/isExternalUrl'

interface DisclaimerProps {
  /** Page-specific risk note prepended before the standard non-financial-advice line */
  context?: string
  /** URL for the full terms link — defaults to LINKS.terms */
  termsHref?: string
  /** Optional link to a docs anchor for additional context */
  learnMoreHref?: string
}

/**
 * Unobtrusive risk / non-financial-advice disclaimer.
 * Placed below primary page content; styled as secondary text.
 * Replace termsHref with the real URL once available from backend.
 */
export default function Disclaimer({ context, termsHref = LINKS.terms, learnMoreHref }: DisclaimerProps) {
  const isPlaceholder = !termsHref || termsHref === '#'
  const isExternal = isExternalUrl(termsHref)

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
            <> {/* optional learn more link */}
              {' '}
              {learnMoreHref === '#' || !learnMoreHref ? (
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
