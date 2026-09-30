/** 招待本体の保存境界。業務固有の付随情報は呼び出し側が同じ D1 batch に加える。 */
export function prepareSystemAccountInvitationCreation(
  database: D1Database,
  input: Readonly<{
    id: string
    token: string
    subject: string | null
    roleId: string
    resourceType: string | null
    resourceId: string | null
    relatedResourceId: string | null
    expiresAt: Date
    createdAt: Date
  }>,
): D1PreparedStatement | Error {
  const createdAt = input.createdAt.getTime()
  const expiresAt = input.expiresAt.getTime()
  if (
    input.id.length < 1 ||
    input.id.length > 255 ||
    !/^[a-f0-9]{64}$/.test(input.token) ||
    input.roleId.length < 1 ||
    input.roleId.length > 255 ||
    (input.subject !== null && input.subject.length > 320) ||
    (input.resourceType === null) !== (input.resourceId === null) ||
    (input.resourceType !== null &&
      (!/^[a-z][a-z0-9_]*(?::[a-z][a-z0-9_]*)+$/.test(input.resourceType) ||
        input.resourceType.length > 100 ||
        input.resourceId === null ||
        input.resourceId.length < 1 ||
        input.resourceId.length > 255)) ||
    (input.relatedResourceId !== null &&
      (input.resourceType === null ||
        input.relatedResourceId.length < 1 ||
        input.relatedResourceId.length > 255)) ||
    !Number.isSafeInteger(createdAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= createdAt
  ) {
    return new Error("Invalid System account invitation")
  }

  return database
    .prepare(
      `INSERT INTO system_account_invitations
        (id, token, subject, role_id, resource_type, resource_id, related_resource_id,
         accepted_by_account_id, expires_at, revoked_at, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, NULL, ?8, NULL, ?9, ?9)`,
    )
    .bind(
      input.id,
      input.token,
      input.subject,
      input.roleId,
      input.resourceType,
      input.resourceId,
      input.relatedResourceId,
      expiresAt,
      createdAt,
    )
}
