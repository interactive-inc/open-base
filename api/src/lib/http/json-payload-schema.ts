import { z } from "zod"

/**
 * JSON シリアライズ後のバイト長（文字数）で上限を課す zod スキーマを返す。
 * `z.unknown()` や `z.record(...)` のように構造を強制しないフィールドに対して
 * 巨大ペイロードによる DoS を防ぐために使う。
 *
 * `z.unknown()` は zod 上で「省略可能」扱いになるため、未指定（undefined）も
 * 弾きたいケースでは別途 refine で弾く（既存テストとの整合性を保つため）。
 */
export function jsonPayloadSchema(maxStringifiedLength: number) {
  return z
    .unknown()
    .refine((value) => value !== undefined, { message: "payload is required" })
    .refine(
      (value) => {
        try {
          return JSON.stringify(value ?? null).length <= maxStringifiedLength
        } catch {
          return false
        }
      },
      { message: `payload exceeds ${maxStringifiedLength} characters when serialized` },
    )
}
