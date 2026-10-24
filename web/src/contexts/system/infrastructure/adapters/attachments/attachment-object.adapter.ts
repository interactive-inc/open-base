import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { SystemAttachmentError } from "@system/domain/errors"
import type { SystemAttachmentStorageContext } from "@system/configuration/system-context"
type Context = SystemAttachmentStorageContext

/**
 * 添付本体の保管。暗号文だけを扱い、同じキーへの上書き API を持たない（write-once）。
 * 物理削除は掃除バッチと消去運用からだけ呼ぶ。
 */
export class AttachmentObjectAdapter {
  constructor(private readonly c: Context) {
    Object.freeze(this)
  }

  private bucket(): R2Bucket | Error {
    const bucket = this.c.env.ATTACHMENTS

    if (bucket === undefined) {
      return new SystemAttachmentError(
        "unavailable",
        "attachment_storage_unconfigured",
        "添付機能が設定されていません（ATTACHMENTS binding 未設定）",
      )
    }

    return bucket
  }

  async put(objectKey: string, ciphertext: AttachmentBytes): Promise<void | Error> {
    const bucket = this.bucket()

    if (bucket instanceof Error) return bucket

    try {
      const stored = await bucket.put(objectKey, ciphertext, {
        onlyIf: { etagDoesNotMatch: "*" },
      })

      if (stored === null) {
        return new SystemAttachmentError(
          "validation",
          "attachment_object_exists",
          "保存済みの添付は上書きできません",
        )
      }

      return undefined
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_store_failed",
        "添付の保存に失敗しました",
        { cause: error },
      )
    }
  }

  async get(objectKey: string): Promise<AttachmentBytes | Error> {
    const bucket = this.bucket()

    if (bucket instanceof Error) return bucket

    try {
      const object = await bucket.get(objectKey)

      if (object === null) {
        return new SystemAttachmentError(
          "not_found",
          "attachment_object_missing",
          "添付の実体が見つかりません",
        )
      }

      return new Uint8Array(await object.arrayBuffer())
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_read_failed",
        "添付の取得に失敗しました",
        { cause: error },
      )
    }
  }

  async exists(objectKey: string): Promise<boolean | Error> {
    const bucket = this.bucket()

    if (bucket instanceof Error) return bucket

    try {
      return (await bucket.head(objectKey)) !== null
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_head_failed",
        "添付の存在確認に失敗しました",
        { cause: error },
      )
    }
  }

  /** 掃除バッチと消去運用専用。通常の業務経路からは呼ばない。 */
  async delete(objectKey: string): Promise<void | Error> {
    const bucket = this.bucket()

    if (bucket instanceof Error) return bucket

    try {
      await bucket.delete(objectKey)

      return undefined
    } catch (error) {
      return new SystemAttachmentError(
        "unexpected",
        "attachment_delete_failed",
        "添付の削除に失敗しました",
        { cause: error },
      )
    }
  }
}
