import {
  toSystemAccountInvitationRecord,
  type SystemAccountInvitationRecord,
  type SystemAccountInvitationStorageRow,
} from "@system/interface/iam/system-account-invitation-record"

/** 保存されたtokenの候補をSystemの公開読み取り境界から取得する。照合方針は呼び出し側が決める。 */
export async function readSystemAccountInvitationCandidates(
  database: D1Database,
  storedTokens: ReadonlyArray<string>,
): Promise<ReadonlyArray<SystemAccountInvitationRecord> | Error> {
  const tokens = [...new Set(storedTokens)]
  if (
    tokens.length < 1 ||
    tokens.length > 2 ||
    tokens.some((token) => token.length < 1 || token.length > 255)
  ) {
    return new Error("Invalid System account invitation token candidates")
  }

  try {
    const placeholders = tokens.map((_, index) => `?${index + 1}`).join(", ")
    const rows = await database
      .prepare(
        `SELECT id, token, subject, role_id, resource_type, resource_id, related_resource_id,
                accepted_by_account_id, expires_at, revoked_at, created_at, updated_at
         FROM system_account_invitations WHERE token IN (${placeholders}) ORDER BY id`,
      )
      .bind(...tokens)
      .all<SystemAccountInvitationStorageRow>()
    if (!rows.success) return new Error("System account invitation lookup failed")
    const records: SystemAccountInvitationRecord[] = []
    for (const row of rows.results) {
      const record = toSystemAccountInvitationRecord(row)
      if (record instanceof Error) return record
      records.push(record)
    }
    return records
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System account invitation lookup failed")
  }
}
