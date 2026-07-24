export class SessionReauthRequiredError extends Error {
  public readonly name = 'SessionReauthRequiredError';
  constructor(message = 'Session re-authentication required to view balances') {
    super(message);
    Object.setPrototypeOf(this, SessionReauthRequiredError.prototype);
  }
}
