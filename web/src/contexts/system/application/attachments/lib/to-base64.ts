import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"

/** バイト列を base64 にする。D1 へ鍵と IV を載せるために使う。 */
export function toBase64(bytes: AttachmentBytes): string {
  let binary = ""

  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary)
}
