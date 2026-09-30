import { zAccountId } from "@system/domain/schemas/iam/account-id.schema"

export type SystemAccountSnapshot = Readonly<{
  id: string
  status: "active" | "suspended" | "locked"
  tokenVersion: number
  closedAt: Date | null
  updatedAt: Date
}>

/** 登録前の再利用判定と登録後の版取得に必要なAccount snapshotを返す。 */
export async function readSystemAccountSnapshot(
  database: D1Database,
  accountId: string,
): Promise<SystemAccountSnapshot | null | Error> {
  const id = zAccountId.safeParse(accountId)
  if (!id.success) return new Error("Invalid System Account ID")
  try {
    const row = await database
      .prepare(
        `SELECT id, status, token_version, closed_at, updated_at
         FROM system_accounts WHERE id = ?1`,
      )
      .bind(id.data)
      .first<{
        id: string
        status: string
        token_version: number
        closed_at: number | null
        updated_at: number
      }>()
    if (row === null) return null
    if (
      !["active", "suspended", "locked"].includes(row.status) ||
      !Number.isSafeInteger(row.token_version) ||
      row.token_version < 0 ||
      (row.closed_at !== null && !Number.isSafeInteger(row.closed_at)) ||
      !Number.isSafeInteger(row.updated_at)
    ) {
      return new Error("Invalid System Account snapshot")
    }
    return {
      id: row.id,
      status: row.status as SystemAccountSnapshot["status"],
      tokenVersion: row.token_version,
      closedAt: row.closed_at === null ? null : new Date(row.closed_at),
      updatedAt: new Date(row.updated_at),
    }
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System Account lookup failed")
  }
}
