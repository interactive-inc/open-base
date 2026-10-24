import { importAesKey } from "@system/application/attachments/lib/import-aes-key"
import { toBase64 } from "@system/application/attachments/lib/to-base64"
import { unwrapDek } from "@system/application/attachments/lib/unwrap-dek"
import type { AttachmentKek } from "@system/application/attachments/lib/attachment-kek-registry"
import type { WrappedKeyMaterial } from "@system/application/attachments/lib/attachment-key-material"
import { ATTACHMENT_IV_BYTE_LENGTH } from "@system/application/attachments/lib/attachment-key-material"

/**
 * KEK ローテーションの包み直し。DEK を旧 KEK で取り出して新 KEK で包み直すだけで、
 * object storage の本体には触れないため、添付数が増えても実行時間は行更新に比例する。
 */
export async function rewrapAttachmentKey(
  material: WrappedKeyMaterial,
  currentKek: AttachmentKek,
  nextKek: AttachmentKek,
): Promise<WrappedKeyMaterial | Error> {
  const dek = await unwrapDek(material, currentKek)

  if (dek instanceof Error) return dek

  const dekIv = crypto.getRandomValues(new Uint8Array(ATTACHMENT_IV_BYTE_LENGTH))

  const wrappingKey = await importAesKey(nextKek.key, "encrypt")

  const wrappedDek = await crypto.subtle.encrypt({ name: "AES-GCM", iv: dekIv }, wrappingKey, dek)

  return {
    wrappedDek: toBase64(new Uint8Array(wrappedDek)),
    wrappedDekIv: toBase64(dekIv),
    kekVersion: nextKek.version,
  }
}
