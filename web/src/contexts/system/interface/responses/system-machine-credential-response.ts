import type { SystemMachineCredentialEntity } from "@system/domain/entities/system-machine-credential.entity"

export function systemMachineCredentialResponse(credential: SystemMachineCredentialEntity) {
  return {
    id: credential.id,
    principal_id: credential.principalId,
    name: credential.name,
    status: credential.status,
    created_at: credential.createdAt.toISOString(),
    updated_at: credential.updatedAt.toISOString(),
    expires_at: credential.expiresAt?.toISOString() ?? null,
    last_used_at: credential.lastUsedAt?.toISOString() ?? null,
    revoked_at: credential.revokedAt?.toISOString() ?? null,
  }
}
