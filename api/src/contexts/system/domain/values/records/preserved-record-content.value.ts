import type { PreservedRecordSourceValue } from "@system/domain/values/records/preserved-record-source.value"

/** 原記録のバイト列を変換せず、確認済みdigestと照合して固定する。 */
export class PreservedRecordContentValue {
  readonly #bytes: Uint8Array

  private constructor(bytes: Uint8Array) {
    this.#bytes = bytes
    Object.freeze(this)
  }

  static async create(
    source: PreservedRecordSourceValue,
    content: Uint8Array,
  ): Promise<PreservedRecordContentValue | Error> {
    try {
      const snapshot = new Uint8Array(content)
      const digest = await crypto.subtle.digest("SHA-256", snapshot)
      const hexadecimal = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
      if (hexadecimal !== source.props.contentDigest) {
        return new Error("preserved record content does not match source digest")
      }
      return new PreservedRecordContentValue(snapshot)
    } catch (cause) {
      return new Error("preserved record content verification failed", { cause })
    }
  }

  toBytes(): Uint8Array<ArrayBuffer> {
    return new Uint8Array(this.#bytes)
  }
}
