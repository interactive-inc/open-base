import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { importAesKey } from "@system/application/attachments/lib/import-aes-key"
import { toBase64 } from "@system/application/attachments/lib/to-base64"
import { toSha256Hex } from "@system/application/attachments/lib/to-sha256-hex"
import type { AttachmentKek } from "@system/application/attachments/lib/attachment-kek-registry"
import {
  ATTACHMENT_DEK_BYTE_LENGTH,
  ATTACHMENT_IV_BYTE_LENGTH,
} from "@system/application/attachments/lib/attachment-key-material"

export type EncryptedAttachment = Readonly<{
  ciphertext: AttachmentBytes
  contentIv: string
  wrappedDek: string
  wrappedDekIv: string
  kekVersion: number
  plaintextSha256: string
}>

/**
 * 添付本体を封筒暗号化する。オブジェクトごとの DEK で本体を暗号化し、DEK は KEK で包む。
 * object storage には暗号文しか渡らないため、レプリカやバックアップ世代にも平文は残らない。
 */
export async function encryptAttachment(
  plaintext: AttachmentBytes,
  kek: AttachmentKek,
): Promise<EncryptedAttachment> {
  const dek = crypto.getRandomValues(new Uint8Array(ATTACHMENT_DEK_BYTE_LENGTH))

  const contentIv = crypto.getRandomValues(new Uint8Array(ATTACHMENT_IV_BYTE_LENGTH))

  const dekIv = crypto.getRandomValues(new Uint8Array(ATTACHMENT_IV_BYTE_LENGTH))

  const contentKey = await importAesKey(dek, "encrypt")

  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: contentIv },
    contentKey,
    plaintext,
  )

  const wrappingKey = await importAesKey(kek.key, "encrypt")

  const wrappedDek = await crypto.subtle.encrypt({ name: "AES-GCM", iv: dekIv }, wrappingKey, dek)

  return {
    ciphertext: new Uint8Array(ciphertext),
    contentIv: toBase64(contentIv),
    wrappedDek: toBase64(new Uint8Array(wrappedDek)),
    wrappedDekIv: toBase64(dekIv),
    kekVersion: kek.version,
    plaintextSha256: await toSha256Hex(plaintext),
  }
}
