/**
 * suggestRoute.ts
 *
 * Provides a helper to suggest the closest matching route for a given attempted path.
 * Uses a simple Levenshtein distance algorithm to compute similarity between the attempted
 * path segment and a list of known routes. Returns the best suggestion with a confidence
 * score between 0 and 1.
 */

/**
 * Compute the Levenshtein distance between two strings.
 * @param a First string.
 * @param b Second string.
 * @returns Number of edit operations required to transform `a` into `b`.
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = []
  const alen = a.length
  const blen = b.length

  for (let i = 0; i <= alen; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= blen; j++) {
    matrix[0][j] = j
  }

  for (let i = 1; i <= alen; i++) {
    const ca = a.charAt(i - 1)
    for (let j = 1; j <= blen; j++) {
      const cb = b.charAt(j - 1)
      const cost = ca === cb ? 0 : 1
      const deletion = matrix[i - 1][j] + 1
      const insertion = matrix[i][j - 1] + 1
      const substitution = matrix[i - 1][j - 1] + cost
      matrix[i][j] = Math.min(deletion, insertion, substitution)
    }
  }
  return matrix[alen][blen]
}

/**
 * Suggest the closest matching route.
 * @param attemptedPath The raw pathname from `useLocation()` (e.g. "/bondz").
 * @param routes Array of canonical routes (including leading slash).
 * @returns An object containing an optional `suggestion` and a confidence score.
 */
export function suggestRoute(attemptedPath: string, routes: string[]): {
  suggestion?: string
  confidence: number
} {
  const normalized = attemptedPath.trim().toLowerCase()
  let best: { route: string; distance: number } | null = null

  for (const route of routes) {
    const dist = levenshtein(normalized, route.toLowerCase())
    if (!best || dist < best.distance) {
      best = { route, distance: dist }
    }
  }

  if (!best) {
    return { confidence: 0 }
  }

  const maxLen = Math.max(normalized.length, best.route.length)
  const confidence = 1 - best.distance / maxLen

  if (confidence > 0.5 && best.route !== normalized) {
    return { suggestion: best.route, confidence }
  }
  return { confidence }
}
