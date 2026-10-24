import type { SystemPrincipalEntity } from "@system/domain/entities/system-principal.entity"

export function systemPrincipalResponse(principal: SystemPrincipalEntity) {
  return {
    id: principal.id,
    account_id: principal.accountId,
    kind: principal.kind,
    name: principal.name,
    connector_id: principal.connectorId,
    revision: principal.revision,
    created_at: principal.createdAt.toISOString(),
    updated_at: principal.updatedAt.toISOString(),
  }
}
