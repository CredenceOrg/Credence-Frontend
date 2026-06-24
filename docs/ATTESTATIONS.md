# Attestation Payload Shape & Validation Contract

This document specifies the on-chain registry payload structure, component properties, and validation contracts for the Credence Attestation Submission Flow.

## Component Properties

### `AttestationForm`

Path: `src/components/AttestationForm.tsx`

Allows trust validators and peers to attest verification data for any Stellar public key.

Props:

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `onSubmitSuccess` | `(payload: AttestationPayload) => void` | `undefined` | Callback invoked with the finalized payload upon successful form confirmation. |
| `disabled` | `boolean` | `false` | Disables form fields and button interaction during processing or wallet interactions. |

---

## Attestation Payload Schema

The submitted attestation follows this structural representation:

```typescript
export interface AttestationPayload {
  /** The Stellar public key (56 characters starting with 'G') of the subject. */
  subject: string
  /** The category of verification. */
  type: 'identity' | 'peer-vouch' | 'credential'
  /** Supporting text evidence or signature hash. Max 500 characters. */
  evidence: string
}
```

---

## Validation Contract

Every field is subject to strict constraints before the submission is allowed:

1. **Subject Address**:
   - Must be non-empty.
   - Must be a valid Stellar public key (regex: `/^G[A-Z0-9]{55}$/`).
   - If invalid, displays: `Invalid address. Stellar public keys are 56 characters starting with G.`

2. **Attestation Type**:
   - Dropdown options:
     - `identity`: Identity Verification
     - `peer-vouch`: Peer Vouch
     - `credential`: Credential / Certification

3. **Evidence**:
   - Must be non-empty.
   - Must not exceed 500 characters.
   - Character count is continuously displayed (e.g. `X / 500 characters`).
   - HTML `maxLength={500}` enforces input ceiling, and React state checks raise validation errors if violated.
