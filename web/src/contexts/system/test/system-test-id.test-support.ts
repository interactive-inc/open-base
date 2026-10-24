import { createHash } from "node:crypto"
import { uuidSchema } from "@/lib/validation/uuid.schema"

/**
 * テストの Account と関連する識別子を UUID にそろえる。
 *
 * 数字の ID は決まった接頭辞と番号の 16 進で写し、それ以外の文字列は値から決まる UUID にする。UUID はそのまま返す。
 */
export function testLiteralId(value: string): string {
  const hash = createHash("md5").update(`f-identity:${value}`).digest("hex")
  const variant = "89ab"[Number.parseInt(hash.charAt(16), 16) & 3]
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`
}

/** 数字の ID を `<prefix>-0000-7000-8000-<番号の 16 進>` の UUID にする。UUID と数字以外は testLiteralId と同じ。 */
export function testSerialId(prefix: string, value: number | string): string {
  const text = String(value)
  if (uuidSchema.safeParse(text).success) return text
  return /^\d+$/u.test(text)
    ? `${prefix}-0000-7000-8000-${Number(text).toString(16).padStart(12, "0")}`
    : testLiteralId(text)
}

export function testAccountId(value: number | string): string {
  return testSerialId("01900061", value)
}

/** Account などから導く識別子。同じ入力には同じ UUID を返す。 */
export function testDerivedId(kind: string, ...parts: ReadonlyArray<number | string>): string {
  return testLiteralId(`${kind}:${parts.join(":")}`)
}
