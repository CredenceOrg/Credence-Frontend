import { render, screen } from '@testing-library/react'
import Disclaimer from './Disclaimer'

vi.mock('./Disclaimer.css', () => ({}))

vi.mock('../config/links', () => ({
  default: { docs: '#', terms: '#', privacy: '#' },
  LINKS: { docs: '#', terms: '#', privacy: '#' },
}))

/**
 * Disclaimer is a stateless, synchronous component with no data loading,
 * retries, or permission checks of its own — the "loading/error/retry/
 * stale/permission" language in this issue's generic template does not map
 * onto it literally. What genuinely applies, and what these tests cover:
 * deterministic rendering across valid/invalid/boundary prop values, and
 * the one real failure-boundary concern a link-rendering component like
 * this has — never turning an unexpected or malformed href into a
 * clickable, potentially script-executing link.
 */
describe('Disclaimer', () => {
  describe('termsHref — deterministic rendering for valid, invalid, and boundary inputs', () => {
    it('renders the terms line as a disabled placeholder when termsHref is omitted (defaults to LINKS.terms = "#")', () => {
      render(<Disclaimer />)
      const placeholder = screen.getByText('Full terms & conditions')
      expect(placeholder.tagName).toBe('SPAN')
      expect(placeholder).toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    })

    it('renders a disabled placeholder when termsHref is explicitly "#"', () => {
      render(<Disclaimer termsHref="#" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
      expect(screen.getByText('Full terms & conditions')).toHaveAttribute('aria-disabled', 'true')
    })

    it('renders a disabled placeholder when termsHref is an empty string', () => {
      render(<Disclaimer termsHref="" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    })

    it('renders a disabled placeholder when termsHref is whitespace-only', () => {
      render(<Disclaimer termsHref="   " />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
      expect(screen.getByText('Full terms & conditions')).toHaveAttribute('aria-disabled', 'true')
    })

    it('renders a real link for a same-site relative path', () => {
      render(<Disclaimer termsHref="/legal/terms" />)
      const link = screen.getByRole('link', { name: /read full terms/i })
      expect(link).toHaveAttribute('href', '/legal/terms')
    })

    it('renders a real link for an absolute https URL', () => {
      render(<Disclaimer termsHref="https://example.com/terms" />)
      const link = screen.getByRole('link', { name: /read full terms/i })
      expect(link).toHaveAttribute('href', 'https://example.com/terms')
    })

    it('renders a real link for an absolute http URL', () => {
      render(<Disclaimer termsHref="http://example.com/terms" />)
      expect(screen.getByRole('link', { name: /read full terms/i })).toHaveAttribute(
        'href',
        'http://example.com/terms'
      )
    })

    it('does not render a link, and shows the disabled placeholder instead, for a javascript: URI', () => {
      // The canonical XSS-via-href payload. If this ever renders as a real
      // <a href>, clicking the disclaimer's terms link executes script.
      render(<Disclaimer termsHref="javascript:alert(1)" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
      expect(screen.getByText('Full terms & conditions')).toHaveAttribute('aria-disabled', 'true')
    })

    it('does not render a link for a data: URI', () => {
      render(<Disclaimer termsHref="data:text/html,<script>alert(1)</script>" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    })

    it('does not render a link for a vbscript: URI', () => {
      render(<Disclaimer termsHref="vbscript:msgbox(1)" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    })

    it('does not render a link for a protocol-relative URL (resolves to an external host, not same-site)', () => {
      render(<Disclaimer termsHref="//evil.example/terms" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    })

    it('does not render a link for a malformed absolute URL that the URL constructor itself rejects', () => {
      // "http://" (a scheme with no host) throws from `new URL()` even with a
      // base supplied — the one case that actually exercises isSafeHref's
      // own catch branch, as opposed to a resolvable-but-harmless string.
      render(<Disclaimer termsHref="http://" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
    })

    it('treats a non-scheme string as a same-site relative reference, not a security concern', () => {
      // "not a url" has no recognizable scheme, so the URL constructor
      // resolves it against the same-origin base rather than throwing —
      // it becomes an odd-looking but harmless relative link, not a
      // javascript:/data:-style execution vector. This is accepted,
      // documented behavior, not a gap: isSafeHref's job is blocking
      // dangerous schemes, not validating that every href is well-formed.
      render(<Disclaimer termsHref="not a url" />)
      expect(screen.getByRole('link', { name: /read full terms/i })).toBeInTheDocument()
    })
  })

  describe('learnMoreHref — optional, independent of termsHref', () => {
    it('renders nothing extra when learnMoreHref is omitted', () => {
      render(<Disclaimer />)
      expect(screen.queryByText('Learn more')).not.toBeInTheDocument()
    })

    it('renders nothing extra when learnMoreHref is an empty string', () => {
      render(<Disclaimer learnMoreHref="" />)
      expect(screen.queryByText('Learn more')).not.toBeInTheDocument()
    })

    it('renders a disabled placeholder when learnMoreHref is "#"', () => {
      render(<Disclaimer learnMoreHref="#" />)
      expect(screen.getByText('Learn more')).toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByRole('link', { name: /learn more/i })).not.toBeInTheDocument()
    })

    it('renders a disabled placeholder when learnMoreHref is whitespace-only rather than a broken link', () => {
      render(<Disclaimer learnMoreHref="   " />)
      expect(screen.getByText('Learn more')).toHaveAttribute('aria-disabled', 'true')
      expect(screen.queryByRole('link', { name: /learn more/i })).not.toBeInTheDocument()
    })

    it('renders a real link for a valid learnMoreHref', () => {
      render(<Disclaimer learnMoreHref="/docs/risks" />)
      expect(screen.getByRole('link', { name: /learn more/i })).toHaveAttribute(
        'href',
        '/docs/risks'
      )
    })

    it('does not render a link for a javascript: learnMoreHref', () => {
      render(<Disclaimer learnMoreHref="javascript:alert(1)" />)
      expect(screen.queryByRole('link', { name: /learn more/i })).not.toBeInTheDocument()
      expect(screen.getByText('Learn more')).toHaveAttribute('aria-disabled', 'true')
    })

    it('termsHref and learnMoreHref are validated independently: an unsafe termsHref does not suppress a safe learnMoreHref', () => {
      render(<Disclaimer termsHref="javascript:alert(1)" learnMoreHref="/docs/risks" />)
      expect(screen.queryByRole('link', { name: /read full terms/i })).not.toBeInTheDocument()
      expect(screen.getByRole('link', { name: /learn more/i })).toHaveAttribute(
        'href',
        '/docs/risks'
      )
    })
  })

  describe('context — optional page-specific note', () => {
    it('renders no extra paragraph when context is omitted', () => {
      const { container } = render(<Disclaimer />)
      // Exactly one <p>: the standard disclaimer line.
      expect(container.querySelectorAll('p')).toHaveLength(1)
    })

    it('renders no extra paragraph when context is an empty string', () => {
      const { container } = render(<Disclaimer context="" />)
      expect(container.querySelectorAll('p')).toHaveLength(1)
    })

    it('renders the context as its own paragraph, before the standard line, when provided', () => {
      render(<Disclaimer context="This page involves leveraged positions." />)
      expect(screen.getByText('This page involves leveraged positions.').tagName).toBe('P')
      expect(screen.getByText(/this is not financial advice/i)).toBeInTheDocument()
    })
  })

  describe('structure and stability', () => {
    it('always renders as an <aside role="complementary"> with the risk disclaimer label, regardless of props', () => {
      render(<Disclaimer context="x" termsHref="/t" learnMoreHref="/l" />)
      expect(screen.getByRole('complementary', { name: /risk disclaimer/i })).toBeInTheDocument()
    })

    it('is a pure function of its props: identical props render identical output', () => {
      const props = { context: 'note', termsHref: '/legal/terms', learnMoreHref: '/docs' } as const
      const first = render(<Disclaimer {...props} />)
      const firstHtml = first.container.innerHTML
      first.unmount()
      const second = render(<Disclaimer {...props} />)
      expect(second.container.innerHTML).toBe(firstHtml)
    })

    it('renders two independent instances with different props without either leaking state into the other', () => {
      render(
        <>
          <Disclaimer termsHref="/a" />
          <Disclaimer termsHref="javascript:alert(1)" />
        </>
      )
      const links = screen.getAllByRole('link', { name: /read full terms/i })
      expect(links).toHaveLength(1)
      expect(links[0]).toHaveAttribute('href', '/a')
    })
  })
})
