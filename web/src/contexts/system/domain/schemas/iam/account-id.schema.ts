import { z } from "zod"

/**
 * AccountEntity の同一性を表す値オブジェクト。
 *
 * adapter や JWT との境界で余計な変換を生まないよう、不変な branded string として
 * 表現する。値は UUID で、正規化せず、等価性は文字列値だけで決まる。
 */
export const zAccountId = z.uuid().brand<"AccountId">()

export type AccountId = z.infer<typeof zAccountId>
