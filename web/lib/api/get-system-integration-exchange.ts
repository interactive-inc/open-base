import { createClient } from "@/lib/api/hc-client"
import type { SystemIntegrationExchange } from "@/lib/api/types/system-operation-types"

/** GET /system/integration-exchanges/:exchangeId。1 件の外部交換を返す。 */
export async function getSystemIntegrationExchange(
  exchangeId: string,
): Promise<SystemIntegrationExchange | Error> {
  const client = await createClient()

  const response = await client.system["integration-exchanges"][":exchangeId"].$get({
    param: { exchangeId },
  })

  if (response.status >= 400) {
    return new Error("failed to load system integration exchange")
  }

  const body = await response.json()

  return {
    id: body.exchange.id,
    connectorId: body.exchange.connectorId,
    direction: body.exchange.direction,
    operationKey: body.exchange.operationKey,
    idempotencyKey: body.exchange.idempotencyKey,
    payloadDigest: body.exchange.payloadDigest,
    status: body.exchange.status,
    attempt: body.exchange.attempt,
    externalReference: body.exchange.externalReference,
    lastErrorCode: body.exchange.lastErrorCode,
  }
}
