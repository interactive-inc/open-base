import { createClient } from "@/lib/api/hc-client"

/** GET /departments/tree を session トークン付きで呼び、部署ツリー（再帰ノード配列）を返す。 */
export async function getOrgTree() {
  const client = await createClient()

  const response = await client.company["organization-tree"].$get()

  if (response.status >= 400) {
    return new Error("failed to load org tree")
  }

  return response.json()
}
