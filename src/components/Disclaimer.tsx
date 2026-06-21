import './Disclaimer.css'
import LINKS from '../config/links'

interface DisclaimerProps {
  /** Page-specific risk note prepended before the standard non-financial-advice line */
  context?: string
  /** URL for the full terms link — use '#' as placeholder until backend provides it */
  termsHref?: string
}

/**
 * Unobtrusive risk / non-financial-advice disclaimer.
 * Placed below primary page content; styled as secondary text.
 * Replace termsHref with the real URL once available from backend.
 */
export default function Disclaimer({ context, termsHref = LINKS.terms }: DisclaimerProps) {
  const isPlaceholder = !termsHref || termsHref === '#'

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
        .
      </p>
    </aside>
  )
}
