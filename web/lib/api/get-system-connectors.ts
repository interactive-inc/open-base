import { createClient } from "@/lib/api/hc-client"
import type { SystemConnector } from "@/lib/api/types/system-operation-types"

/**
 * GET /system/connectors。外部境界の Connector 定義を返す。
 * 応答の作成・更新時刻は画面で使わないので落とす。
 */
export async function getSystemConnectors(): Promise<ReadonlyArray<SystemConnector> | Error> {
  const client = await createClient()

  const response = await client.system.connectors.$get()

  if (response.status >= 400) {
    return new Error("failed to load system connectors")
  }

  const body = await response.json()

  return body.connectors.map((connector) => ({
    id: connector.id,
    key: connector.key,
    name: connector.name,
    direction: connector.direction,
    transport: connector.transport,
    status: connector.status,
    revision: connector.revision,
  }))
}
