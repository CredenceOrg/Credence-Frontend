import { useEffect } from 'react'
import { formatDocumentTitle } from './useDocumentTitle'

export interface UseSeoOptions {
  /** The page-specific title (e.g. 'Bond') — branded to 'Bond · Credence'. */
  title: string
  /** Per-route meta description surfaced by search engines and social card scrapers. */
  description?: string
  /**
   * Append the '· Credence' brand suffix to the title.
   * @defaultValue true
   */
  brandSuffix?: boolean
  /**
   * Restore the prior document title and meta description on unmount.
   * @defaultValue true
   */
  restoreOnUnmount?: boolean
}

/**
 * Sets `document.title` and the `<meta name="description">` tag for the lifetime
 * of the calling component, restoring the previous values on unmount.
 *
 * This is a drop-in superset of `useDocumentTitle` — it forwards the title /
 * brandSuffix / restoreOnUnmount semantics while additionally managing the
 * description meta tag so every route can own its own SEO metadata without a
 * central registry.
 *
 * SSR-safe: all DOM access is deferred to effects and guarded by a
 * `typeof document === 'undefined'` check.
 *
 * @example
 * ```tsx
 * function Bond() {
 *   useSeo({
 *     title: 'Bond',
 *     description: 'Lock USDC into the Credence contract to build your on-chain reputation.',
 *   })
 *   return <main>…</main>
 * }
 * ```
 */
export function useSeo({
  title,
  description,
  brandSuffix = true,
  restoreOnUnmount = true,
}: UseSeoOptions): void {
  // ── Title ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined') return

    const previousTitle = document.title
    document.title = formatDocumentTitle(title, brandSuffix)

    return () => {
      if (restoreOnUnmount) document.title = previousTitle
    }
  }, [title, brandSuffix, restoreOnUnmount])

  // ── Meta description ───────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof document === 'undefined' || description === undefined) return

    let metaEl = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const previousContent = metaEl?.getAttribute('content') ?? null
    const wasCreated = metaEl === null

    if (wasCreated) {
      metaEl = document.createElement('meta')
      metaEl.setAttribute('name', 'description')
      document.head.appendChild(metaEl)
    }

    metaEl!.setAttribute('content', description)

    return () => {
      if (!restoreOnUnmount) return
      if (wasCreated) {
        metaEl?.parentNode?.removeChild(metaEl)
      } else if (previousContent !== null && metaEl) {
        metaEl.setAttribute('content', previousContent)
      }
    }
  }, [description, restoreOnUnmount])
}
