import { createClient } from "@/lib/api/hc-client"

/**
 * GET /system/health。api の応答は status だけで、版や依存先の内訳は持たない。
 */
export async function getSystemHealth(): Promise<string | Error> {
  const client = await createClient()

  const response = await client.system.health.$get()

  if (response.status >= 400) {
    return new Error("failed to load system health")
  }

  const body = await response.json()

  return body.status
}
