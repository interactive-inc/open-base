export type SystemAccountInvitationRecord = Readonly<{
  id: string
  token: string
  email: string | null
  roleId: string
  resourceType: string | null
  resourceId: string | null
  relatedResourceId: string | null
  usedBy: string | null
  expiresAt: Date
  revokedAt: Date | null
  createdAt: Date
  updatedAt: Date
}>

export type SystemAccountInvitationStorageRow = Readonly<{
  id: string
  token: string
  subject: string | null
  role_id: string
  resource_type: string | null
  resource_id: string | null
  related_resource_id: string | null
  accepted_by_account_id: string | null
  expires_at: number
  revoked_at: number | null
  created_at: number
  updated_at: number
}>

/** D1の整数時刻をSystem招待の公開recordへ変換する。 */
export function toSystemAccountInvitationRecord(
  row: SystemAccountInvitationStorageRow,
): SystemAccountInvitationRecord | Error {
  if (
    !Number.isSafeInteger(row.expires_at) ||
    (row.revoked_at !== null && !Number.isSafeInteger(row.revoked_at)) ||
    !Number.isSafeInteger(row.created_at) ||
    !Number.isSafeInteger(row.updated_at)
  ) {
    return new Error("System account invitation has invalid timestamps")
  }

  return {
    id: row.id,
    token: row.token,
    email: row.subject,
    roleId: row.role_id,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    relatedResourceId: row.related_resource_id,
    usedBy: row.accepted_by_account_id,
    expiresAt: new Date(row.expires_at),
    revokedAt: row.revoked_at === null ? null : new Date(row.revoked_at),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  }
}
