import { z } from "zod"

/**
 * System AccountEntity の認証可否を表す状態。
 *
 * suspended は管理上の停止、locked は認証上の保護を表す。Account の不可逆な終了は
 * status と直交する system_accounts.closed_at で表し、通常の状態遷移から再開できないようにする。
 */
export const accountStatusSchema = z.enum(["active", "suspended", "locked"])

export type AccountStatus = z.infer<typeof accountStatusSchema>
