import { createClient } from "@/lib/api/hc-client"
import type {
  SystemDelivery,
  SystemDeliveryKind,
  SystemDeliveryStatus,
} from "@/lib/api/types/system-operation-types"

type Props = {
  kind: SystemDeliveryKind
  status: SystemDeliveryStatus | null
}

/**
 * GET /system/deliveries。api は kind を必須にするので、job と outbox は別々に読む。
 */
export async function getSystemDeliveries(
  props: Props,
): Promise<ReadonlyArray<SystemDelivery> | Error> {
  const client = await createClient()

  const response = await client.system.deliveries.$get({
    query:
      props.status === null ? { kind: props.kind } : { kind: props.kind, status: props.status },
  })

  if (response.status >= 400) {
    return new Error("failed to load system deliveries")
  }

  const body = await response.json()

  return body.deliveries.map(toDelivery)
}

function toDelivery(delivery: SystemDelivery): SystemDelivery {
  return {
    id: delivery.id,
    kind: delivery.kind,
    operation_key: delivery.operation_key,
    payload_digest: delivery.payload_digest,
    idempotency_key: delivery.idempotency_key,
    status: delivery.status,
    attempt: delivery.attempt,
    max_attempts: delivery.max_attempts,
    available_at: delivery.available_at,
    lease_account_id: delivery.lease_account_id,
    lease_expires_at: delivery.lease_expires_at,
    last_error_code: delivery.last_error_code,
    created_at: delivery.created_at,
    updated_at: delivery.updated_at,
    completed_at: delivery.completed_at,
  }
}
