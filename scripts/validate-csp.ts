/**
 * CI validation script for Content-Security-Policy header.
 * Fails with exit code 1 if CSP is missing or contains unsafe-inline (except style-src with nonce).
 * Run with: npx tsx scripts/validate-csp.ts
 */

import { CSP, validateCSP, CSPValidationError } from '../src/config/security.js'

const validationError = validateCSP(CSP)

if (validationError) {
  console.error('❌ CSP Validation Failed')
  console.error(`Error Type: ${validationError.type}`)
  console.error(`Message: ${validationError.message}`)
  console.error(`Current CSP: ${CSP}`)
  process.exit(1)
}

console.log('✅ CSP Validation Passed')
console.log(`CSP: ${CSP}`)
process.exit(0)
