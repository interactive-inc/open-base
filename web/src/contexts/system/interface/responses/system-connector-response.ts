import type { SystemConnectorEntity } from "@system/domain/entities/system-connector.entity"

export function systemConnectorResponse(connector: SystemConnectorEntity) {
  return {
    id: connector.id,
    key: connector.key,
    name: connector.name,
    direction: connector.direction,
    transport: connector.transport,
    status: connector.status,
    revision: connector.revision,
    created_at: connector.createdAt.toISOString(),
    updated_at: connector.updatedAt.toISOString(),
  }
}
