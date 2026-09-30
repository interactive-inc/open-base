import type { SystemDeliveryEntity } from "@system/domain/entities/system-delivery.entity"

export function systemDeliveryResponse(delivery: SystemDeliveryEntity) {
  return {
    id: delivery.id,
    kind: delivery.kind,
    operation_key: delivery.operationKey,
    handler_key: delivery.handlerKey,
    payload_digest: delivery.payloadDigest,
    idempotency_key: delivery.idempotencyKey,
    status: delivery.status,
    attempt: delivery.attempt,
    max_attempts: delivery.maxAttempts,
    available_at: delivery.availableAt.toISOString(),
    lease_account_id: delivery.leaseAccountId,
    lease_expires_at: delivery.leaseExpiresAt?.toISOString() ?? null,
    last_error_code: delivery.lastErrorCode,
    created_at: delivery.createdAt.toISOString(),
    updated_at: delivery.updatedAt.toISOString(),
    completed_at: delivery.completedAt?.toISOString() ?? null,
  }
}
