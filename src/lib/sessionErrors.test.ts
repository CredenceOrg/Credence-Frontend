import { describe, it, expect } from 'vitest'
import { SessionReauthRequiredError } from './sessionErrors'

describe('SessionReauthRequiredError', () => {
  it('uses the default message when none is provided', () => {
    const error = new SessionReauthRequiredError()

    expect(error.message).toBe('Session re-authentication required to view balances')
    expect(error.name).toBe('SessionReauthRequiredError')
  })

  it('uses a custom message when provided', () => {
    const error = new SessionReauthRequiredError('Custom session expired message')

    expect(error.message).toBe('Custom session expired message')
    expect(error.name).toBe('SessionReauthRequiredError')
  })

  it('preserves instanceof checks for Error and SessionReauthRequiredError', () => {
    const error = new SessionReauthRequiredError()

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SessionReauthRequiredError)
  })

  it('preserves instanceof SessionReauthRequiredError when subclassed', () => {
    class CustomSessionReauthError extends SessionReauthRequiredError {}

    const error = new CustomSessionReauthError('Subclassed re-auth error')

    expect(error).toBeInstanceOf(Error)
    expect(error).toBeInstanceOf(SessionReauthRequiredError)
    expect(error.message).toBe('Subclassed re-auth error')
    expect(error.name).toBe('SessionReauthRequiredError')
  })

  it('includes a stack trace', () => {
    const error = new SessionReauthRequiredError()

    expect(typeof error.stack).toBe('string')
    expect(error.stack).toBeTruthy()
  })
})
