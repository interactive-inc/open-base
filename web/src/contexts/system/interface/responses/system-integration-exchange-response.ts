import type { IntegrationExchangeEntity } from "@system/domain/entities/integration-exchange.entity"

export function systemIntegrationExchangeResponse(exchange: IntegrationExchangeEntity) {
  return {
    id: exchange.id,
    connector_id: exchange.connectorId,
    direction: exchange.direction,
    operation_key: exchange.operationKey,
    idempotency_key: exchange.idempotencyKey,
    payload_digest: exchange.payloadDigest,
    status: exchange.status,
    attempt: exchange.attempt,
    external_reference: exchange.externalReference,
    last_error_code: exchange.lastErrorCode,
    created_at: exchange.createdAt.toISOString(),
    updated_at: exchange.updatedAt.toISOString(),
    completed_at: exchange.completedAt?.toISOString() ?? null,
  }
}
