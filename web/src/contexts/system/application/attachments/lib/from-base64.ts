import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"

/** base64 をバイト列に戻す。 */
export function fromBase64(value: string): AttachmentBytes {
  const binary = atob(value)

  const bytes = new Uint8Array(binary.length)

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }

  return bytes
}
