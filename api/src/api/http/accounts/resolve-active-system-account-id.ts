import type { Context } from "@/env"
import type { AccountId } from "@system/domain/schemas/iam/account-id.schema"
import { readSystemAccountSnapshot } from "@system/interface/operations/read-system-account-snapshot"

/** Sessionが指すcanonical Accountの存在と現在の有効性を確認する。 */
export async function resolveActiveSystemAccountId(
  c: Context,
  accountId: AccountId,
): Promise<AccountId | Error> {
  const account = await readSystemAccountSnapshot(c.env.DB, accountId)
  if (account instanceof Error) {
    return new Error("failed to resolve canonical System Account", { cause: account })
  }

  return account?.status === "active"
    ? accountId
    : new Error("canonical System Account is not active")
}
