import { createClient } from "@/lib/api/hc-client"

/** GET /system/roles/:roleId。System Role 詳細を取得する。 */
export async function getRole(roleId: string) {
  const client = await createClient()

  const response = await client.system.roles[":roleId"].$get({
    param: { roleId },
  })

  if (response.status !== 200) {
    return new Error("failed to load role")
  }

  const role = await response.json()

  return { ...role, is_system: role.kind === "managed" }
}
