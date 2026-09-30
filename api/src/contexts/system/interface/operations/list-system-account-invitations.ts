import {
  toSystemAccountInvitationRecord,
  type SystemAccountInvitationRecord,
  type SystemAccountInvitationStorageRow,
} from "@system/interface/iam/system-account-invitation-record"

/** 未受諾のSystem招待を新しい順に取得する。業務固有のプロフィールは含めない。 */
export async function listSystemAccountInvitations(
  database: D1Database,
  limit = 300,
): Promise<ReadonlyArray<SystemAccountInvitationRecord> | Error> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 300) {
    return new Error("Invalid System account invitation list limit")
  }

  try {
    const rows = await database
      .prepare(
        `SELECT id, token, subject, role_id, resource_type, resource_id, related_resource_id,
                accepted_by_account_id, expires_at, revoked_at, created_at, updated_at
         FROM system_account_invitations
         WHERE accepted_by_account_id IS NULL
         ORDER BY created_at DESC LIMIT ?1`,
      )
      .bind(limit)
      .all<SystemAccountInvitationStorageRow>()
    if (!rows.success) return new Error("System account invitation list failed")
    const records: SystemAccountInvitationRecord[] = []
    for (const row of rows.results) {
      const record = toSystemAccountInvitationRecord(row)
      if (record instanceof Error) return record
      records.push(record)
    }
    return records
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System account invitation list failed")
  }
}
