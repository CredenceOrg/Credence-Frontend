# Add CSP Header Validation to CI

## Summary
Implements automated validation to fail CI if the Content-Security-Policy header is missing or contains `unsafe-inline` (except for style-src with nonce).

## Threat Model

### What is the threat?
Without this validation, an attacker who can modify the CSP header (through misconfiguration, compromised build process, or malicious dependency) could introduce `unsafe-inline` directives that weaken the application's security posture.

### Attack Scenario
1. **Missing CSP**: If the CSP header is accidentally removed or not set, the browser applies no content restrictions, allowing:
   - Inline scripts to execute (XSS attacks become trivial)
   - External resources from any origin
   - Data exfiltration through unrestricted network requests

2. **unsafe-inline in script-src**: If `script-src` contains `'unsafe-inline'`, attackers can:
   - Execute arbitrary JavaScript through XSS vulnerabilities
   - Bypass nonce/hash protections entirely
   - Inject malicious scripts via DOM-based XSS

3. **unsafe-inline in style-src without nonce**: If `style-src` contains `'unsafe-inline'` without a nonce:
   - Attackers can inject malicious CSS that can:
     - Steal sensitive data via CSS exfiltration techniques
     - Perform clickjacking attacks
     - Modify the UI to trick users into performing actions
   - While less severe than script-src, still enables data theft attacks

### Defense in Depth
This check provides defense-in-depth by:
- Detecting accidental CSP misconfigurations before deployment
- Preventing regression of security controls
- Ensuring CSP hardening measures are maintained over time
- Providing automated enforcement in CI/CD pipeline

## Changes

### Added
- **CSPValidationError class**: Typed error class with discriminable error types
- **validateCSP function**: Validates CSP headers against security requirements
- **Comprehensive test suite**: 13 new tests covering positive and negative cases
- **CI validation script**: `scripts/validate-csp.ts` for automated CI checks
- **npm script**: `npm run validate:csp` for easy local validation

### Error Types
- `MISSING_HEADER`: CSP header is undefined, null, or empty
- `UNSAFE_INLINE_SCRIPT`: script-src contains 'unsafe-inline' (never allowed)
- `UNSAFE_INLINE_STYLE_WITHOUT_NONCE`: style-src contains 'unsafe-inline' without nonce
- `UNSAFE_INLINE_OTHER`: Other directives contain 'unsafe-inline'

## Testing

### Negative Tests (fail before fix, pass after)
- Missing CSP header (undefined, null, empty string)
- script-src with unsafe-inline
- style-src with unsafe-inline without nonce
- Other directives with unsafe-inline
- Case-insensitive detection

### Positive Tests
- Valid CSP without unsafe-inline
- style-src with nonce and unsafe-inline
- Complex multi-directive CSPs
- Whitespace handling

All 25 tests pass (including 13 new validation tests).

## Performance
The validation function operates on a single string and has negligible performance impact:
- O(n) time complexity where n is the length of the CSP string
- No external dependencies
- Suitable for hot path execution if needed

## Usage

### Local Development
```bash
npm run validate:csp
```

### CI Integration
Add to CI pipeline:
```yaml
- run: npm run validate:csp
```

## Current Status
The current CSP configuration fails validation because `style-src` contains `'unsafe-inline'` without a nonce. This is expected for development (Vite CSS modules require it). For production, the CSP should be updated to use nonces or hashes.

## Related
Closes #[ISSUE_NUMBER]
