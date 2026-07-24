const INSTALL_PROMPT_SESSION_KEY = 'credence:install-prompt-handled'

export function hasHandledInstallPrompt(): boolean {
  if (typeof window === 'undefined') return false

  return window.sessionStorage.getItem(INSTALL_PROMPT_SESSION_KEY) === 'handled'
}

export function markInstallPromptHandled(): void {
  if (typeof window === 'undefined') return

  window.sessionStorage.setItem(INSTALL_PROMPT_SESSION_KEY, 'handled')
}

export { INSTALL_PROMPT_SESSION_KEY }
