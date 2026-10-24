import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"

/** 平文の整合性検証に使うダイジェスト。 */
export async function toSha256Hex(bytes: AttachmentBytes): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)

  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}
