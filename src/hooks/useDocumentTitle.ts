import { useEffect } from 'react'

/** The product brand appended to every route title. */
export const BRAND = 'Credence'

/** The separator placed between a page title and the brand, e.g. `Bond · Credence`. */
export const BRAND_SEPARATOR = '·'

/** The fully-rendered brand suffix, e.g. `· Credence`. */
export const BRAND_SUFFIX = `${BRAND_SEPARATOR} ${BRAND}`

export interface UseDocumentTitleOptions {
  /**
   * Append the consistent ` · Credence` brand suffix. A title that already ends
   * with the suffix (or that is the brand itself) is never double-suffixed.
   * @defaultValue true
   */
  brandSuffix?: boolean
  /**
   * Restore the document title that was present when the hook mounted once the
   * component unmounts. When `false`, the title set by the hook is left in place.
   * @defaultValue true
   */
  restoreOnUnmount?: boolean
}

/**
 * Builds the final `document.title` for a page, applying the brand suffix while
 * guarding against an empty title or an already-suffixed value (no double suffix).
 *
 * @param title - The descriptive, page-specific title (e.g. `Bond`).
 * @param brandSuffix - Whether to append the ` · Credence` brand suffix.
 * @returns The title string to assign to `document.title`.
 */
export function formatDocumentTitle(title: string, brandSuffix = true): string {
  const trimmed = title.trim()

  if (!brandSuffix) {
    return trimmed.length === 0 ? BRAND : trimmed
  }

  if (trimmed.length === 0 || trimmed === BRAND) {
    return BRAND
  }

  if (trimmed.endsWith(BRAND_SUFFIX)) {
    return trimmed
  }

  return `${trimmed} ${BRAND_SUFFIX}`
}

/**
 * Sets `document.title` to a descriptive, branded title for the lifetime of the
 * calling component and restores the previous title on unmount.
 *
 * Keeping the document title in sync with the active route is an accessibility
 * win: screen readers announce the title on navigation, and the tab strip,
 * history, and bookmarks become distinguishable per page.
 *
 * The hook is SSR-safe — it never touches `document` during server rendering —
 * and runs entirely inside an effect, so it has no impact on the rendered output.
 *
 * @param title - The page-specific title (e.g. `Bond`), branded to `Bond · Credence`.
 * @param options - Optional {@link UseDocumentTitleOptions} overrides.
 *
 * @example
 * ```tsx
 * function Bond() {
 *   useDocumentTitle('Bond') // document.title === 'Bond · Credence'
 *   return <main>…</main>
 * }
 * ```
 */
export function useDocumentTitle(
  title: string,
  options: UseDocumentTitleOptions = {}
): void {
  const { brandSuffix = true, restoreOnUnmount = true } = options

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const previousTitle = document.title
    document.title = formatDocumentTitle(title, brandSuffix)

    return () => {
      if (restoreOnUnmount) {
        document.title = previousTitle
      }
    }
  }, [title, brandSuffix, restoreOnUnmount])
}
