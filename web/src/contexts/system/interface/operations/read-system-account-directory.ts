import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"
import { ReadSystemAccountDirectoryAdapter } from "@system/infrastructure/adapters/iam/read-system-account-directory.adapter"
import type { SystemAccountDirectoryEntry } from "@system/domain/definitions/system-iam-read-models.definition"

/** 他contextへAccount状態と有効なログインIdentityの連絡先だけを公開する。 */
export async function readSystemAccountDirectory(
  input: Readonly<{ database: D1Database; accountIds: ReadonlyArray<string> }>,
): Promise<ReadonlyArray<SystemAccountDirectoryEntry> | Error> {
  const ids = [] as string[]
  for (const value of input.accountIds) {
    const parsed = zAccountId.safeParse(value)
    if (!parsed.success) return new Error("invalid System Account ID")
    ids.push(parsed.data)
  }
  if (ids.length === 0) return Object.freeze([])
  return new ReadSystemAccountDirectoryAdapter(input.database).read([...new Set(ids)])
}
