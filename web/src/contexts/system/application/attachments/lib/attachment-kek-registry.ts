import type { AttachmentBytes } from "@system/domain/definitions/attachments/attachment-bytes.definition"
import { SystemAttachmentError } from "@system/domain/errors"

/** KEK は 256bit。base64 で env に置く。 */
const KEK_BYTE_LENGTH = 32

export type AttachmentKek = Readonly<{
  version: number
  key: AttachmentBytes
}>

function decodeBase64(value: string): AttachmentBytes | Error {
  try {
    const binary = atob(value)

    const bytes = new Uint8Array(binary.length)

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }

    return bytes
  } catch {
    return new SystemAttachmentError(
      "validation",
      "attachment_kek_invalid",
      "KEK が base64 ではありません",
    )
  }
}

/**
 * env の KEK 一覧を読む。`{"1": "<base64 32 bytes>", "2": "..."}` 形式で、
 * 最大の version が現行鍵になる。ローテーション中は旧 version も残しておく。
 *
 * 未設定・不正な形は起動時ではなく利用時に拒否する（添付機能を使わない配備を止めないため）。
 */
export class AttachmentKekRegistry {
  private readonly keys: ReadonlyMap<number, AttachmentBytes>

  private constructor(keys: ReadonlyMap<number, AttachmentBytes>) {
    this.keys = keys

    Object.freeze(this)
  }

  static fromEnv(raw: string | undefined): AttachmentKekRegistry | Error {
    if (raw === undefined || raw.trim() === "") {
      return new SystemAttachmentError(
        "unavailable",
        "attachment_storage_unconfigured",
        "添付機能が設定されていません（ATTACHMENT_KEKS 未設定）",
      )
    }

    let parsed: unknown

    try {
      parsed = JSON.parse(raw)
    } catch {
      return new SystemAttachmentError(
        "validation",
        "attachment_kek_invalid",
        "ATTACHMENT_KEKS が JSON ではありません",
      )
    }

    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return new SystemAttachmentError(
        "validation",
        "attachment_kek_invalid",
        "ATTACHMENT_KEKS は version をキーにした object で指定してください",
      )
    }

    const keys = new Map<number, AttachmentBytes>()

    for (const entry of Object.entries(parsed)) {
      const version = Number(entry[0])

      if (!Number.isSafeInteger(version) || version <= 0) {
        return new SystemAttachmentError(
          "validation",
          "attachment_kek_invalid",
          "ATTACHMENT_KEKS のキーは 1 以上の整数にしてください",
        )
      }

      if (typeof entry[1] !== "string") {
        return new SystemAttachmentError(
          "validation",
          "attachment_kek_invalid",
          "ATTACHMENT_KEKS の値は base64 文字列にしてください",
        )
      }

      const decoded = decodeBase64(entry[1])

      if (decoded instanceof Error) return decoded

      if (decoded.length !== KEK_BYTE_LENGTH) {
        return new SystemAttachmentError(
          "validation",
          "attachment_kek_invalid",
          `ATTACHMENT_KEKS の鍵は ${KEK_BYTE_LENGTH} バイトにしてください`,
        )
      }

      keys.set(version, decoded)
    }

    if (keys.size === 0) {
      return new SystemAttachmentError(
        "validation",
        "attachment_kek_invalid",
        "ATTACHMENT_KEKS が空です",
      )
    }

    return new AttachmentKekRegistry(keys)
  }

  /** 新規暗号化に使う現行鍵。 */
  current(): AttachmentKek {
    const version = Math.max(...this.keys.keys())

    const key = this.keys.get(version)

    if (key === undefined) {
      throw new Error("現行 KEK の解決に失敗しました")
    }

    return { version, key }
  }

  /** 復号に使う鍵。無い version は復号を拒否する（fail-closed）。 */
  resolve(version: number): AttachmentKek | Error {
    const key = this.keys.get(version)

    if (key === undefined) {
      return new SystemAttachmentError(
        "unavailable",
        "attachment_kek_version_missing",
        `この添付の KEK version が設定にありません: ${version}`,
      )
    }

    return { version, key }
  }

  versions(): ReadonlyArray<number> {
    return [...this.keys.keys()].toSorted((a, b) => a - b)
  }
}
