# Upload Handling

This document explains how Credence handles large file uploads, including chunked transfer, retry mechanisms, and progress reporting.

**Audience:** Contributors and developers working on the frontend upload components.

## Chunked Uploads

To reliably support large files (e.g., attestation evidence or large reports) over unstable networks, the frontend splits files into 5MB chunks before transmission.

### How it works

1. The user selects a file via `FileInput` or drag-and-drop.
2. The `uploadService` calculates the total number of chunks.
3. Each chunk is read via the `File.slice()` API and uploaded sequentially.
4. The backend reconstructs the file once all chunks are received.

```typescript
// Example: Chunking logic
const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB

async function uploadFile(file: File) {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

  for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
    const start = chunkIndex * CHUNK_SIZE
    const end = Math.min(start + CHUNK_SIZE, file.size)
    const chunk = file.slice(start, end)

    await uploadChunk(chunk, chunkIndex, totalChunks, file.name)
  }
}
```

## Retries

Network requests can fail. We use exponential backoff with jitter to retry failed chunk uploads.

- **Max Retries:** 3 per chunk.
- **Base Delay:** 1000ms.
- **Strategy:** If a chunk fails, wait for `delay * (2 ^ retryCount) + jitter` before retrying.

```typescript
// Example: Retry mechanism
async function uploadWithRetry(chunk: Blob, retries = 0): Promise<void> {
  try {
    await api.post('/upload/chunk', chunk)
  } catch (error) {
    if (retries >= 3) throw error

    const delay = 1000 * Math.pow(2, retries) + Math.random() * 500
    await new Promise((resolve) => setTimeout(resolve, delay))

    return uploadWithRetry(chunk, retries + 1)
  }
}
```

## Progress Reporting

Users need visual feedback during long uploads. Progress is calculated based on the number of successfully uploaded chunks.

```typescript
// Example: Progress calculation
let uploadedBytes = 0

function onChunkSuccess(chunkSize: number, totalSize: number) {
  uploadedBytes += chunkSize
  const percentComplete = Math.round((uploadedBytes / totalSize) * 100)

  // Update UI (e.g., progress bar, aria-valuenow)
  updateProgressBar(percentComplete)
}
```

This ensures the user sees a smoothly advancing progress bar rather than an indefinite spinner.
