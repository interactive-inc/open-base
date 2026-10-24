export type SystemAccountInvitationRevocationResult =
  | "revoked"
  | "not_found"
  | "used"
  | "already_revoked"

/** 未使用の招待だけを取り消し、使用済み招待の履歴は保全する。 */
export async function revokeSystemAccountInvitation(
  database: D1Database,
  input: Readonly<{ id: string; writtenAt: Date }>,
): Promise<SystemAccountInvitationRevocationResult | Error> {
  const writtenAt = input.writtenAt.getTime()
  if (input.id.length < 1 || input.id.length > 255 || !Number.isSafeInteger(writtenAt)) {
    return new Error("Invalid System account invitation revocation")
  }

  try {
    const revoked = await database
      .prepare(
        `UPDATE system_account_invitations
         SET revoked_at = ?2, updated_at = ?2
         WHERE id = ?1 AND accepted_by_account_id IS NULL AND revoked_at IS NULL
           AND created_at <= ?2
         RETURNING id`,
      )
      .bind(input.id, writtenAt)
      .all<{ id: string }>()
    if (!revoked.success) return new Error("System account invitation revocation failed")
    if (revoked.results.length > 0) return "revoked"

    const invitation = await database
      .prepare("SELECT accepted_by_account_id FROM system_account_invitations WHERE id = ?1")
      .bind(input.id)
      .first<{ accepted_by_account_id: string | null }>()
    if (invitation === null) return "not_found"
    return invitation.accepted_by_account_id === null ? "already_revoked" : "used"
  } catch (cause) {
    return cause instanceof Error ? cause : new Error("System account invitation revocation failed")
  }
}
