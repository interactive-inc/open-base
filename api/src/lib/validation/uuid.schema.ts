import { z } from "zod"

/**
 * 主キーとID参照に使うUUID。
 *
 * 版は RFC 9562 の v1〜v8 を受け入れ、variant は 0b10 に固定する。新規採番は
 * `crypto.randomUUID()` の v4 を使う。v7 のように時刻を埋め込む版は作成順と作成時刻を
 * ID から漏らすので採番に使わないが、検査は版を限定しない。
 *
 * 正規形は小文字に固定する。DB の CHECK 制約が小文字の16進だけを許すので、大文字を
 * 入口で通すと保存時に初めて失敗する。nil UUID と max UUID は `z.uuid()` を素通りするが、
 * どちらも番兵であって識別子ではないので拒否する。
 */
export const uuidSchema = z
  .uuid()
  .refine((value) => value === value.toLowerCase(), "UUID は小文字で指定してください")
  .refine(
    (value) =>
      value !== "00000000-0000-0000-0000-000000000000" &&
      value !== "ffffffff-ffff-ffff-ffff-ffffffffffff",
    "nil UUID と max UUID は識別子として使えません",
  )

/**
 * `uuidSchema` と同じ集合を表す SQLite の CHECK 述語。
 *
 * migration と Drizzle の `check()` はこの 1 か所を参照し、入口と保存で受け入れる集合を
 * ずらさない。SQLite に正規表現が無いため GLOB を使うが、`[0-9a-f]` を36個並べた GLOB は
 * D1 が "LIKE or GLOB pattern too complex" で拒否する。bun:sqlite は通すので in-memory の
 * test では気づけない。否定クラス1つと位置指定に分けて短く保ち、D1 での成立は
 * `uuid.schema.d1.test.ts` で確かめる。
 *
 * @param column 検査対象の列名。SQL 識別子としてそのまま埋め込むので、固定の列名だけを渡す
 */
export function uuidCheckPredicate(column: string): string {
  if (/^[a-z_][a-z0-9_]*$/.test(column) === false) {
    throw new Error(`UUID の CHECK 述語に使えない列名です: ${column}`)
  }

  return [
    `length(${column}) = 36`,
    // 16進と区切り以外の文字を含まない。
    `${column} NOT GLOB '*[^0-9a-f-]*'`,
    // 区切りは定位置の4か所だけ。区切りを除いて32文字なら、区切りはちょうど4個になる。
    `substr(${column}, 9, 1) = '-'`,
    `substr(${column}, 14, 1) = '-'`,
    `substr(${column}, 19, 1) = '-'`,
    `substr(${column}, 24, 1) = '-'`,
    `length(replace(${column}, '-', '')) = 32`,
    // version は v1〜v8、variant は 0b10。nil UUID (v0) と max UUID (vf) はここで外れる。
    `substr(${column}, 15, 1) GLOB '[1-8]'`,
    `substr(${column}, 20, 1) GLOB '[89ab]'`,
  ].join(" AND ")
}
