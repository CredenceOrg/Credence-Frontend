# Attestation Evidence Files

Attestation evidence files are processed locally in the browser. The app does
not upload, persist, or include file contents in an attestation payload.

## Supported files and limits

- PDF, PNG, JPEG, and plain-text files.
- Maximum size: 10 MiB (`MAX_EVIDENCE_FILE_SIZE_BYTES` in
  `src/lib/fileHash.ts`).
- SHA-256 is calculated client-side with the Web Crypto API.

`hashFile` reads the `Blob.stream()` incrementally, reports progress, and
supports cancellation through an `AbortSignal`. Web Crypto's `subtle.digest`
requires a complete `ArrayBuffer`, so the function enforces the maximum size
before allocating the bounded digest buffer.

## Attestation payload

When a file is selected, the form submits only its SHA-256 digest and safe
metadata (`name`, `size`, MIME `type`, and `lastModified`) alongside evidence
text. The `File`, `Blob`, and file bytes are never included in the payload.
The SHA-256 digest can be copied from the attestation detail drawer to verify
the evidence independently.

File type and size are checked by `FilePicker` before hashing. Failed
validation and hashing are surfaced to the user; changing or removing the
selected file cancels the previous digest operation.

The configured maximum is intentionally small because Web Crypto digests a
complete buffer rather than exposing incremental SHA-256 updates. Files over
the limit are rejected before reading.
