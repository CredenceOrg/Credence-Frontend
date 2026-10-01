import { isExternalUrl } from '../lib/isExternalUrl'

export default function FooterLink({ label, href }: { label: string; href: string }) {
  const normalizedHref = href.trim()
  const isPlaceholder = !normalizedHref || normalizedHref === '#'
  // Footer navigation only permits web links and mail links as explicit schemes.
  const hasUnsupportedScheme =
    /^[a-z][a-z\d+.-]*:/i.test(normalizedHref) && !/^(https?|mailto):/i.test(normalizedHref)
  const hasMalformedWebUrl = /^https?:/i.test(normalizedHref) && !isValidWebUrl(normalizedHref)
  const isDisabled = isPlaceholder || hasUnsupportedScheme || hasMalformedWebUrl
  const isExternal = isExternalUrl(normalizedHref)

  if (isDisabled) {
    return (
      <span
        className="footer-link footer-link--disabled"
        aria-disabled="true"
        title={isPlaceholder ? 'Coming soon' : 'Unavailable link'}
        tabIndex={-1}
      >
        {label}
      </span>
    )
  }

  return (
    <a
      href={normalizedHref}
      className="footer-link"
      {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {label}
    </a>
  )
}

function isValidWebUrl(href: string): boolean {
  try {
    new URL(href)
    return true
  } catch {
    return false
  }
}
