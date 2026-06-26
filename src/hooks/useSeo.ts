import { useEffect } from 'react'
import { BRAND, BRAND_SUFFIX, formatDocumentTitle } from './useDocumentTitle'

export interface SeoData {
  /** The page-specific title (e.g. `Bond`), branded to `Bond · Credence`. */
  title: string
  /** The meta description for the page. */
  description?: string
  /** Optional canonical URL for the page. */
  canonicalUrl?: string
}

const META_DESCRIPTION_SELECTOR = 'meta[name="description"]'
const META_OG_TITLE_SELECTOR = 'meta[property="og:title"]'
const META_OG_DESC_SELECTOR = 'meta[property="og:description"]'
const LINK_CANONICAL_SELECTOR = 'link[rel="canonical"]'

function setMetaContent(selector: string, content: string, attribute = 'content'): void {
  if (typeof document === 'undefined') return
  let el = document.querySelector<HTMLMetaElement>(selector)
  if (!el) {
    el = document.createElement('meta') as HTMLMetaElement
    if (selector.includes('og:')) {
      el.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] ?? '')
    } else {
      el.setAttribute('name', selector.match(/name="([^"]+)"/)?.[1] ?? '')
    }
    document.head.appendChild(el)
  }
  el.setAttribute(attribute, content)
}

function setLinkHref(selector: string, href: string): void {
  if (typeof document === 'undefined') return
  let el = document.querySelector<HTMLLinkElement>(selector)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', 'canonical')
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/**
 * Sets per-route SEO metadata: document title, meta description, Open Graph tags,
 * and canonical URL. SSR-safe — never touches `document` during server rendering.
 *
 * @param seo - The SEO data for the current route.
 *
 * @example
 * ```tsx
 * function Bond() {
 *   useSeo({
 *     title: 'Bond',
 *     description: 'Create and manage USDC reputation bonds on Stellar.',
 *   })
 *   return <main>…</main>
 * }
 * ```
 */
export function useSeo(seo: SeoData): void {
  useEffect(() => {
    if (typeof document === 'undefined') return

    const previousTitle = document.title
    document.title = formatDocumentTitle(seo.title)

    if (seo.description) {
      setMetaContent(META_DESCRIPTION_SELECTOR, seo.description)
      setMetaContent(META_OG_DESC_SELECTOR, seo.description)
    }

    const fullTitle = formatDocumentTitle(seo.title)
    setMetaContent(META_OG_TITLE_SELECTOR, fullTitle)

    if (seo.canonicalUrl) {
      setLinkHref(LINK_CANONICAL_SELECTOR, seo.canonicalUrl)
    }

    return () => {
      document.title = previousTitle
    }
  }, [seo.title, seo.description, seo.canonicalUrl])
}
