export const MAX_EVIDENCE_FILE_SIZE_BYTES = 10 * 1024 * 1024
export const EVIDENCE_FILE_ACCEPT =
  '.pdf,.png,.jpg,.jpeg,.txt,application/pdf,image/png,image/jpeg,text/plain'
export const FILE_HASH_CHUNK_SIZE = 1024 * 1024

export interface HashFileOptions {
  signal?: AbortSignal
  onProgress?: (progress: number) => void
  chunkSize?: number
  maxFileSizeBytes?: number
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('File hashing aborted', 'AbortError')
  }
}

function createFallbackBlobStream(
  file: Blob,
  chunkSize: number
): ReadableStream<Uint8Array> {
  let offset = 0
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (offset >= file.size) {
        controller.close()
        return
      }
      const end = Math.min(file.size, offset + Math.max(1, chunkSize))
      controller.enqueue(new Uint8Array(await file.slice(offset, end).arrayBuffer()))
      offset = end
    },
  })
}

export async function hashFile(file: Blob, options: HashFileOptions = {}): Promise<string> {
  const maxFileSizeBytes = options.maxFileSizeBytes ?? MAX_EVIDENCE_FILE_SIZE_BYTES
  if (file.size > maxFileSizeBytes) {
    throw new RangeError(`File exceeds the ${maxFileSizeBytes}-byte maximum.`)
  }

  const cryptoApi = globalThis.crypto
  if (!cryptoApi?.subtle) {
    throw new Error('SHA-256 hashing is unavailable in this browser.')
  }

  throwIfAborted(options.signal)
  // Web Crypto's digest API requires a complete ArrayBuffer. Read the file
  // incrementally and enforce a strict size bound before allocating it.
  const stream =
    typeof file.stream === 'function'
      ? file.stream()
      : createFallbackBlobStream(file, options.chunkSize ?? FILE_HASH_CHUNK_SIZE)
  const reader = stream.getReader()
  let buffer: ArrayBuffer
  try {
    buffer = await collectChunkBuffer(reader, file.size, options.signal, options.onProgress)
  } catch (error) {
    await reader.cancel(error)
    throw error
  }
  const digest = await cryptoApi.subtle.digest('SHA-256', buffer)
  throwIfAborted(options.signal)

  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('')
}

async function collectChunkBuffer(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  totalSize: number,
  signal?: AbortSignal,
  onProgress?: (progress: number) => void
): Promise<ArrayBuffer> {
  const result = new Uint8Array(totalSize)
  let bytesRead = 0

  while (true) {
    throwIfAborted(signal)
    const { done, value } = await reader.read()
    throwIfAborted(signal)
    if (done) break
    if (value) {
      if (bytesRead + value.byteLength > totalSize) {
        throw new Error('File stream exceeded its reported size.')
      }
      result.set(value, bytesRead)
      bytesRead += value.byteLength
      onProgress?.(totalSize > 0 ? Math.min(100, Math.round((bytesRead / totalSize) * 100)) : 100)
    }
  }

  if (bytesRead !== totalSize) throw new Error('File stream size did not match its metadata.')
  onProgress?.(100)
  return result.buffer
}
