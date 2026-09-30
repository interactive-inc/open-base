import { createClient } from "@/lib/api/hc-client"
import type { SystemPermissionDefinition } from "@/lib/api/types/system-operation-types"

/**
 * GET /system/permission-definitions。有効な機能の権限カタログを返す。
 * 無効化された App の権限は api 側で除かれる。
 */
export async function getSystemPermissionDefinitions(): Promise<
  ReadonlyArray<SystemPermissionDefinition> | Error
> {
  const client = await createClient()

  const response = await client.system["permission-definitions"].$get()

  if (response.status >= 400) {
    return new Error("failed to load system permission definitions")
  }

  const body = await response.json()

  return body.data.map((definition) => ({
    key: definition.key,
    description: definition.description,
    category: definition.category,
  }))
}
