import { createClient } from "@/lib/api/hc-client"
import type { SystemIntegrationExchange } from "@/lib/api/types/system-operation-types"

/**
 * GET /system/integration-exchanges。api は connector_id を必須にするので、
 * Connector を選ばずに全件を読む手段はない。
 */
export async function getSystemIntegrationExchanges(
  connectorId: string,
): Promise<ReadonlyArray<SystemIntegrationExchange> | Error> {
  const client = await createClient()

  const response = await client.system["integration-exchanges"].$get({
    query: { connector_id: connectorId },
  })

  if (response.status >= 400) {
    return new Error("failed to load system integration exchanges")
  }

  const body = await response.json()

  return body.exchanges.map(
    (exchange): SystemIntegrationExchange => ({
      id: exchange.id,
      connectorId: exchange.connector_id,
      direction: exchange.direction,
      operationKey: exchange.operation_key,
      idempotencyKey: exchange.idempotency_key,
      payloadDigest: exchange.payload_digest,
      status: exchange.status,
      attempt: exchange.attempt,
      externalReference: exchange.external_reference,
      lastErrorCode: exchange.last_error_code,
    }),
  )
}
