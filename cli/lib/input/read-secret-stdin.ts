import { InputError } from "@/lib/errors"

const MAX_SECRET_BYTES = 4096

async function readBoundedStdin(): Promise<string> {
  const reader = Bun.stdin.stream().getReader()
  const chunks: Uint8Array[] = []
  let size = 0

  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > MAX_SECRET_BYTES) {
        await reader.cancel()
        throw new InputError("標準入力のシークレットが長すぎます")
      }
      chunks.push(next.value)
    }
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    throw new InputError("標準入力のシークレットはUTF-8で入力してください")
  }
}

export async function readSecretStdin(
  read: () => Promise<string> = readBoundedStdin,
): Promise<string> {
  const raw = await read()
  if (new TextEncoder().encode(raw).byteLength > MAX_SECRET_BYTES) {
    throw new InputError("標準入力のシークレットが長すぎます")
  }
  const value = raw.replace(/[\r\n]+$/, "")
  if (value.length === 0) throw new InputError("標準入力のシークレットが空です")
  return value
}
