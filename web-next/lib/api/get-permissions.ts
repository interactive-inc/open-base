import { createClient } from "@/lib/api/hc-client"

/** GET /permission-definitions。製品権限カタログ全件（iam:write が必要）。 */
export async function getPermissions() {
  const client = await createClient()

  const response = await client["system"]["permission-definitions"].$get()

  if (response.status >= 400) {
    return new Error("failed to load permissions")
  }

  const body = await response.json()

  return body.data
}
