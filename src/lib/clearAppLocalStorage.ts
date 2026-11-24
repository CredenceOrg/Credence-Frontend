export function clearAppLocalStorage(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.clear()
  } catch {
    // ignore (storage unavailable in private browsing, etc.)
  }
}
