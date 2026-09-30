import { InputError } from "@/lib/errors"

const MAX_JSON_BYTES = 64 * 1024

export async function readJsonObjectFile(path: string): Promise<Record<string, unknown>> {
  let bytes: Uint8Array
  try {
    const buffer = await Bun.file(path)
      .slice(0, MAX_JSON_BYTES + 1)
      .arrayBuffer()
    bytes = new Uint8Array(buffer)
  } catch {
    throw new InputError("JSON入力ファイルを読み取れませんでした")
  }
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_JSON_BYTES) {
    throw new InputError("JSON入力ファイルのサイズが不正です")
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
    if (value === null || Array.isArray(value) || typeof value !== "object") {
      throw new Error("not an object")
    }
    return value as Record<string, unknown>
  } catch {
    throw new InputError("JSON入力ファイルはUTF-8のJSON objectである必要があります")
  }
}
