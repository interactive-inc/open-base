import { CanonicalSystemJsonValue } from "@system/domain/values/audit/canonical-system-json.value"
import { SystemWorkItemError } from "@system/domain/errors"

/** 作業の対象と内容を同じ正規化規則で固定する。 */
export class SystemWorkDigestValue {
  private constructor(private readonly digest: string) {
    Object.freeze(this)
  }

  toString(): string {
    return this.digest
  }

  static async create(value: unknown): Promise<SystemWorkDigestValue | SystemWorkItemError> {
    const canonical = CanonicalSystemJsonValue.create(value)
    if (canonical instanceof Error) return new SystemWorkItemError("invalid", canonical)
    try {
      const bytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(canonical.toString()),
      )
      return new SystemWorkDigestValue(
        [...new Uint8Array(bytes)].map((value) => value.toString(16).padStart(2, "0")).join(""),
      )
    } catch (cause) {
      return new SystemWorkItemError("unavailable", cause)
    }
  }
}
