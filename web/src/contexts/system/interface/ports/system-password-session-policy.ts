import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"

/** パスワード照合後、セッション発行前に合成側の追加の認証制約を確認する。 */
export type SystemPasswordSessionPolicy = Readonly<{
  allows(input: Readonly<{ accountId: AccountId }>): Promise<boolean | Error>
}>
